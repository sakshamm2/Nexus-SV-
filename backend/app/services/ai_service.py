"""Thin wrapper around the Google GenAI SDK so the rest of the app never touches it directly.
Handles Gemini being temporarily overloaded: short automatic retries, then a backup model."""
import asyncio
import logging

from google import genai
from google.genai import errors, types

from app.core.config import settings

log = logging.getLogger("nexus")

EMBED_BATCH = 50                   # texts per embedding request
RETRY_CODES = {429, 500, 503, 504}  # overloaded / rate limited / temporary server trouble
RETRY_DELAYS = (1.0, 2.0)          # seconds to wait before the 2nd and 3rd attempt on each model


def is_retryable(exc: Exception) -> bool:
    return isinstance(exc, errors.APIError) and getattr(exc, "code", None) in RETRY_CODES


def model_unavailable(exc: Exception) -> bool:
    """404 means this model name is retired or not offered to this API key: retrying it is pointless."""
    return isinstance(exc, errors.APIError) and getattr(exc, "code", None) == 404


def friendly_error(exc: Exception) -> str:
    """A short message for the user. The full error goes to the backend log."""
    code = getattr(exc, "code", None)
    if code in (500, 503, 504):
        return "Gemini is very busy right now. Please try again in a moment."
    if code == 429:
        return "Gemini's usage limit was reached. Please wait a minute and try again."
    if code in (400, 401, 403):
        return "Gemini rejected the request. Check that GEMINI_API_KEY in backend/.env is valid."
    if code == 404:
        return "The Gemini model is not available. Set GEMINI_MODEL to a current model (for example gemini-3.8-flash)."
    return "The AI service had a problem. Please try again."


class AIService:
    def __init__(self) -> None:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL

    def _models(self) -> list[str]:
        backup = settings.GEMINI_FALLBACK_MODEL
        return [self.model] + ([backup] if backup and backup != self.model else [])

    async def generate_response(self, prompt: str) -> str:
        """Send a prompt to Gemini and return the text reply."""
        first_error: Exception | None = None
        for model in self._models():
            for delay in (0.0, *RETRY_DELAYS):
                if delay:
                    await asyncio.sleep(delay)
                try:
                    response = await self.client.aio.models.generate_content(model=model, contents=prompt)
                    return response.text or ""
                except Exception as exc:
                    if model_unavailable(exc):
                        first_error = first_error or exc
                        log.warning("Gemini model %s is not available; trying the backup model", model)
                        break  # skip to the next model
                    if not is_retryable(exc):
                        raise
                    first_error = first_error or exc
                    log.warning("Gemini %s busy (%s); retrying", model, getattr(exc, "code", "?"))
        raise first_error  # type: ignore[misc]

    async def stream_response(self, prompt: str):
        """Yield the reply piece by piece as Gemini writes it. Retries only until the first words
        arrive; after that a failure is reported, because the user has already seen part of the text."""
        first_error: Exception | None = None
        for model in self._models():
            for delay in (0.0, *RETRY_DELAYS):
                if delay:
                    await asyncio.sleep(delay)
                started = False
                try:
                    stream = await self.client.aio.models.generate_content_stream(model=model, contents=prompt)
                    async for chunk in stream:
                        if chunk.text:
                            started = True
                            yield chunk.text
                    return
                except Exception as exc:
                    if started:
                        raise
                    if model_unavailable(exc):
                        first_error = first_error or exc
                        log.warning("Gemini model %s is not available; trying the backup model", model)
                        break  # skip to the next model
                    if not is_retryable(exc):
                        raise
                    first_error = first_error or exc
                    log.warning("Gemini %s busy (%s); retrying", model, getattr(exc, "code", "?"))
        raise first_error  # type: ignore[misc]

    async def embed_texts(self, texts: list[str], task_type: str) -> list[list[float]]:
        """Turn texts into vectors. task_type: RETRIEVAL_DOCUMENT for stored chunks,
        RETRIEVAL_QUERY for the user's question."""
        vectors: list[list[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            for delay in (0.0, *RETRY_DELAYS):
                if delay:
                    await asyncio.sleep(delay)
                try:
                    result = await self.client.aio.models.embed_content(
                        model=settings.EMBEDDING_MODEL,
                        contents=texts[i : i + EMBED_BATCH],
                        config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=settings.EMBEDDING_DIM),
                    )
                    break
                except Exception as exc:
                    if not is_retryable(exc) or delay == RETRY_DELAYS[-1]:
                        raise
            vectors.extend(list(e.values) for e in result.embeddings)
        return vectors


# Single shared instance (the client is reusable and thread-safe).
ai_service = AIService()
