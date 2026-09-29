"""POST /api/v1/chat"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai_service import ai_service

router = APIRouter()

# TODO (RAG): embed `message`, run a pgvector similarity search over uploaded document chunks,
# and prepend the top matches to the prompt below as context.
SYSTEM_PREAMBLE = "You are Nexus SV, a helpful AI knowledge assistant. Answer clearly and concisely.\n\n"


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    try:
        reply = await ai_service.generate_response(SYSTEM_PREAMBLE + payload.message)
    except Exception as exc:  # surface upstream API errors as a 502
        raise HTTPException(status_code=502, detail=f"AI service error: {exc}") from exc
    return ChatResponse(reply=reply)
