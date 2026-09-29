"""Central configuration. Values come from environment variables or backend/.env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus SV"
    API_V1_PREFIX: str = "/api/v1"

    # Required secrets (set in .env)
    GEMINI_API_KEY: str
    DATABASE_URL: str  # must start with postgresql+asyncpg://

    GEMINI_MODEL: str = "gemini-2.5-flash"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
