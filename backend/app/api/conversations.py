"""Saved chats: list, open and delete. Login required; users only ever see their own."""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.chat_model import Conversation, Message

router = APIRouter()


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    sources: list[dict[str, Any]] = []


class ConversationDetail(BaseModel):
    id: int
    title: str
    messages: list[MessageOut]


def _db_down(exc: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail=f"Database unavailable: {exc}")


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        rows = await db.scalars(
            select(Conversation)
            .where(Conversation.user_id == user["id"])
            .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
            .limit(100)
        )
        return list(rows)
    except (SQLAlchemyError, OSError) as exc:
        raise _db_down(exc) from exc


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
async def get_conversation(conv_id: int, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        conv = await db.scalar(select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user["id"]))
        if conv is None:
            raise HTTPException(status_code=404, detail="Chat not found.")
        rows = await db.scalars(select(Message).where(Message.conversation_id == conv.id).order_by(Message.id))
        return ConversationDetail(
            id=conv.id, title=conv.title, messages=[MessageOut.model_validate(m) for m in rows]
        )
    except (SQLAlchemyError, OSError) as exc:
        raise _db_down(exc) from exc


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(conv_id: int, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(delete(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user["id"]))
        await db.commit()  # messages are removed automatically (ON DELETE CASCADE)
    except (SQLAlchemyError, OSError) as exc:
        await db.rollback()
        raise _db_down(exc) from exc
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Chat not found.")
