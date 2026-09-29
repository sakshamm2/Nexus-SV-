"""Async engine, session factory and the get_db FastAPI dependency."""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# postgresql+asyncpg:// gives non-blocking access to Supabase.
# statement_cache_size=0 keeps this compatible with Supabase's pgbouncer pooler (port 6543).
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield one session per request and close it afterwards."""
    async with AsyncSessionLocal() as session:
        yield session
