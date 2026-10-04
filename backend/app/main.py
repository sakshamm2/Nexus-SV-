"""FastAPI application factory. Run: uvicorn app.main:app --reload --port 8000"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import chat, conversations, routes
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import chat_model, document_model, user_model  # noqa: F401  (registers tables on Base.metadata)

TABLES = ("users", "documents", "document_chunks", "conversations", "messages")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """On startup: enable pgvector, create tables, and lock them from Supabase's public REST API.
    Failures are printed, not fatal, so plain chat still works while you sort out database access."""
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await conn.run_sync(Base.metadata.create_all)
            # Keyword search support: an auto-maintained searchable-text column plus an index
            await conn.execute(text(
                "ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector "
                "GENERATED ALWAYS AS (to_tsvector('english', content)) STORED"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS document_chunks_tsv_idx ON document_chunks USING gin (content_tsv)"
            ))
            # Row Level Security with no policies: the public API key cannot read these tables.
            # This backend connects as the database owner, which is not affected.
            for table in TABLES:
                await conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        print("[startup] Database ready (pgvector + tables)")
    except Exception as exc:
        print(f"[startup] Database init skipped: {exc}")
    yield
    await engine.dispose()


def get_application() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME, version="0.3.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat.router, prefix=settings.API_V1_PREFIX, tags=["chat"])
    app.include_router(conversations.router, prefix=settings.API_V1_PREFIX, tags=["chats"])
    app.include_router(routes.router, prefix=settings.API_V1_PREFIX, tags=["system"])
    return app


app = get_application()
