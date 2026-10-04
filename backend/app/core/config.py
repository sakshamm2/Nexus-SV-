"""Central configuration. Values come from environment variables or backend/.env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus SV"
    API_V1_PREFIX: str = "/api/v1"

    # Required secrets (set in .env)
    GEMINI_API_KEY: str
    DATABASE_URL: str  # must start with postgresql+asyncpg://
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str

    GEMINI_MODEL: str = "gemini-2.5-flash"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Documents / RAG ---
    EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIM: int = 768          # changing this later means recreating the document_chunks table
    MAX_UPLOAD_MB: int = 10
    MAX_DOCS_PER_USER: int = 20
    MAX_CHUNKS_PER_DOC: int = 400
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_MAX_DISTANCE: float = 0.65  # cosine distance; lower = stricter. Tune if sources look wrong.
    RETRIEVAL_CANDIDATES: int = 20    # how many hits each search (meaning + keyword) contributes before merging
    HISTORY_MESSAGES: int = 6         # how many earlier messages the chatbot remembers

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
