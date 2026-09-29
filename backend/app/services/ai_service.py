"""Thin wrapper around the Google GenAI SDK so the rest of the app never touches it directly."""
from google import genai

from app.core.config import settings


class AIService:
    def __init__(self) -> None:
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.GEMINI_MODEL

    async def generate_response(self, prompt: str) -> str:
        """Send a prompt to Gemini and return the text reply (uses the SDK's async client)."""
        response = await self.client.aio.models.generate_content(model=self.model, contents=prompt)
        return response.text or ""


# Single shared instance (the client is reusable and thread-safe).
ai_service = AIService()
