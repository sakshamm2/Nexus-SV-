"""POST /api/v1/chat: guests get a daily limit; signed-in users also get answers from their documents."""
import logging
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_optional_user
from app.db.session import get_db
from app.services.ai_service import ai_service
from app.services.document_service import build_prompt, retrieve

router = APIRouter()
log = logging.getLogger("nexus")

GUEST_DAILY_LIMIT = 5
# In-memory counter: resets when the server restarts. Move to Redis/DB for production.
_guest_usage: dict[tuple[str, date], int] = defaultdict(int)

SYSTEM_PREAMBLE = "You are Nexus SV, a helpful AI knowledge assistant. Answer clearly and concisely.\n\n"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class Source(BaseModel):
    document_id: int
    filename: str
    page: int | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[Source] = []


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    user: dict | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    guest_key = (request.client.host if request.client else "unknown", date.today())
    if user is None and _guest_usage[guest_key] >= GUEST_DAILY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Guest limit reached ({GUEST_DAILY_LIMIT} messages per day). Sign in to keep chatting.",
        )

    prompt, sources = SYSTEM_PREAMBLE + payload.message, []
    if user is not None:
        try:
            hits = await retrieve(db, user["id"], payload.message)
        except Exception as exc:  # a database or embedding problem must not break plain chat
            log.warning("Document search skipped: %s", exc)
            hits = []
        if hits:
            prompt = build_prompt(SYSTEM_PREAMBLE, payload.message, hits)
            seen = set()
            for h in hits:
                if (h.document_id, h.page) not in seen:
                    seen.add((h.document_id, h.page))
                    sources.append(Source(document_id=h.document_id, filename=h.filename, page=h.page))

    try:
        reply = await ai_service.generate_response(prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}") from exc
    if user is None:
        _guest_usage[guest_key] += 1  # count only successful replies
    return ChatResponse(reply=reply, sources=sources)
