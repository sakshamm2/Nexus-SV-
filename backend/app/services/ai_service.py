"""Thin wrapper around the Google GenAI SDK so the rest of the app never touches it directly."""
from google import genai
from google.genai import types

from app.core.config import settings

EMBED_BATCH = 50  # texts per embedding request


class AIService:
    def __init__(self) -> None:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL

    async def generate_response(self, prompt: str) -> str:
        """Send a prompt to Gemini and return the text reply (uses the SDK's async client)."""
        response = await self.client.aio.models.generate_content(model=self.model, contents=prompt)
        return response.text or ""

    async def embed_texts(self, texts: list[str], task_type: str) -> list[list[float]]:
        """Turn texts into vectors. task_type: RETRIEVAL_DOCUMENT for stored chunks,
        RETRIEVAL_QUERY for the user's question."""
        vectors: list[list[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            result = await self.client.aio.models.embed_content(
                model=settings.EMBEDDING_MODEL,
                contents=texts[i : i + EMBED_BATCH],
                config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=settings.EMBEDDING_DIM),
            )
            vectors.extend(list(e.values) for e in result.embeddings)
        return vectors


# Single shared instance (the client is reusable and thread-safe).
ai_service = AIService()
