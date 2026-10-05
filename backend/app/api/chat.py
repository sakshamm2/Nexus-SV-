"""Chat endpoints. POST /chat returns the whole reply; POST /chat/stream sends it piece by piece.
Guests get a daily limit. Signed-in users also get answers from their documents, and their chats are saved."""
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_optional_user
from app.db.session import AsyncSessionLocal, get_db
from app.models.chat_model import Conversation, Message
from app.services.ai_service import ai_service, friendly_error
from app.services.document_service import build_prompt, retrieve

router = APIRouter()
log = logging.getLogger("nexus")

GUEST_DAILY_LIMIT = 5
# In-memory counter: resets when the server restarts. Move to Redis/DB for production.
_guest_usage: dict[tuple[str, date], int] = defaultdict(int)

SYSTEM_PREAMBLE = "You are Nexus SV, a helpful AI knowledge assistant. Answer clearly and concisely.\n\n"


class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=6000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    history: list[HistoryItem] = Field(default_factory=list, max_length=20)  # used for guests only
    conversation_id: int | None = None  # continue a saved chat (signed-in users)


class Source(BaseModel):
    document_id: int
    filename: str
    page: int | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[Source] = []
    conversation_id: int | None = None


@dataclass
class Prepared:
    prompt: str
    sources: list[dict] = field(default_factory=list)
    conversation_id: int | None = None
    title: str | None = None
    guest_key: tuple | None = None  # set only for guests


async def prepare(payload: ChatRequest, request: Request, user: dict | None, db: AsyncSession) -> Prepared:
    """Everything that must happen before the AI starts answering: limits, memory, document search,
    and saving the user's message."""
    n = settings.HISTORY_MESSAGES
    guest_key = None
    if user is None:
        guest_key = (request.client.host if request.client else "unknown", date.today())
        if _guest_usage[guest_key] >= GUEST_DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"Guest limit reached ({GUEST_DAILY_LIMIT} messages per day). Sign in to keep chatting.",
            )

    history = [{"role": m.role, "content": m.content[:2000]} for m in payload.history[-n:]]
    conversation_id = title = None
    hits: list = []

    if user is not None:
        uid = user["id"]
        db_ok = True
        try:  # signed-in users: memory comes from the saved chat, not from the browser
            if payload.conversation_id is not None:
                conv = await db.scalar(
                    select(Conversation).where(Conversation.id == payload.conversation_id, Conversation.user_id == uid)
                )
                if conv is None:
                    raise HTTPException(status_code=404, detail="Chat not found.")
                rows = (
                    await db.scalars(
                        select(Message).where(Message.conversation_id == conv.id).order_by(Message.id.desc()).limit(n)
                    )
                ).all()
                history = [{"role": m.role, "content": m.content[:2000]} for m in reversed(rows)]
                conversation_id, title = conv.id, conv.title
        except (SQLAlchemyError, OSError) as exc:  # a database problem must not break chatting
            log.warning("Saved chats unavailable: %s", exc)
            db_ok = False

        try:
            hits = await retrieve(db, uid, payload.message, history)
        except Exception as exc:
            log.warning("Document search skipped: %s", exc)

        if db_ok:  # save the user's message (creating the chat if it is new)
            try:
                if conversation_id is None:
                    conv = Conversation(user_id=uid, title=" ".join(payload.message.split())[:60] or "New chat")
                    db.add(conv)
                    await db.flush()
                    conversation_id, title = conv.id, conv.title
                db.add(Message(conversation_id=conversation_id, role="user", content=payload.message))
                await db.execute(
                    update(Conversation).where(Conversation.id == conversation_id).values(updated_at=func.now())
                )
                await db.commit()
            except (SQLAlchemyError, OSError) as exc:
                await db.rollback()
                log.warning("Could not save message: %s", exc)
                conversation_id = title = None

    sources, seen = [], set()
    for h in hits:
        if (h.document_id, h.page) not in seen:
            seen.add((h.document_id, h.page))
            sources.append({"document_id": h.document_id, "filename": h.filename, "page": h.page})
    return Prepared(
        prompt=build_prompt(SYSTEM_PREAMBLE, payload.message, hits, history),
        sources=sources,
        conversation_id=conversation_id,
        title=title,
        guest_key=guest_key,
    )


async def finish(prep: Prepared, reply: str) -> None:
    """After a successful answer: save it, and count it against the guest limit."""
    if prep.conversation_id is not None:
        try:
            async with AsyncSessionLocal() as session:  # own session: the request's one may be closed already
                session.add(Message(conversation_id=prep.conversation_id, role="assistant", content=reply, sources=prep.sources))
                await session.execute(
                    update(Conversation).where(Conversation.id == prep.conversation_id).values(updated_at=func.now())
                )
                await session.commit()
        except (SQLAlchemyError, OSError) as exc:
            log.warning("Could not save reply: %s", exc)
    if prep.guest_key is not None:
        _guest_usage[prep.guest_key] += 1  # count only successful replies


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    prep = await prepare(payload, request, user, db)
    try:
        reply = await ai_service.generate_response(prep.prompt)
    except Exception as exc:
        log.warning("Gemini failed: %s", exc)
        raise HTTPException(status_code=502, detail=friendly_error(exc)) from exc
    await finish(prep, reply)
    return ChatResponse(
        reply=reply, sources=[Source(**s) for s in prep.sources], conversation_id=prep.conversation_id
    )


@router.post("/chat/stream")
async def chat_stream(
    payload: ChatRequest,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    prep = await prepare(payload, request, user, db)  # errors here (429, 404) are normal HTTP errors

    async def events():
        yield sse("meta", {"conversation_id": prep.conversation_id, "title": prep.title, "sources": prep.sources})
        parts: list[str] = []
        try:
            async for piece in ai_service.stream_response(prep.prompt):
                parts.append(piece)
                yield sse("token", {"text": piece})
        except Exception as exc:  # the response has started, so errors travel as an event
            log.warning("Gemini failed: %s", exc)
            yield sse("error", {"detail": friendly_error(exc)})
            return
        reply = "".join(parts)
        if not reply.strip():
            yield sse("error", {"detail": "The AI returned an empty reply. Try rephrasing your question."})
            return
        await finish(prep, reply)
        yield sse("done", {})

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},  # no buffering, so text appears live
    )
