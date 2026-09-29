"""Utility routes: GET /api/v1/db-test and POST /api/v1/documents."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("/db-test")
async def db_test(db: AsyncSession = Depends(get_db)) -> dict:
    """Verify the database connection and whether pgvector is installed."""
    try:
        await db.execute(text("SELECT 1"))
        ext = await db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
        return {"status": "connected", "pgvector": ext.scalar() is not None}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}") from exc


@router.post("/documents")
async def upload_document(file: UploadFile = File(...)) -> dict:
    """Receive a document from the sidebar.

    STUB: ingestion is not built yet. Next steps: extract text, chunk it, embed each chunk
    with google-genai, and store vectors in a pgvector column for retrieval in /chat.
    """
    content = await file.read()
    return {"filename": file.filename, "size_bytes": len(content), "status": "received"}
