"""Utility and document routes: /db-test and /documents (upload, list, delete). Login required for documents."""
import asyncio
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document_model import Document
from app.services.ai_service import ai_service
from app.services.document_service import INSERT_CHUNK, DocumentError, chunk_pages, extract_pages, to_vector_literal

router = APIRouter()


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    size_bytes: int
    chunk_count: int
    created_at: datetime


def _db_down(exc: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail=f"Database unavailable: {exc}")


@router.get("/db-test")
async def db_test(db: AsyncSession = Depends(get_db)) -> dict:
    """Verify the database connection and whether pgvector is installed."""
    try:
        await db.execute(text("SELECT 1"))
        ext = await db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
        return {"status": "connected", "pgvector": ext.scalar() is not None}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database error: {exc}") from exc


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        rows = await db.scalars(
            select(Document).where(Document.user_id == user["id"]).order_by(Document.created_at.desc())
        )
        return list(rows)
    except (SQLAlchemyError, OSError) as exc:
        raise _db_down(exc) from exc


@router.post("/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Read the file, split it into chunks, embed each chunk with Gemini, store everything for this user."""
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    filename = (file.filename or "document").strip()[:255]
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB.")

    try:
        count = await db.scalar(select(func.count()).select_from(Document).where(Document.user_id == user["id"]))
    except (SQLAlchemyError, OSError) as exc:
        raise _db_down(exc) from exc
    if (count or 0) >= settings.MAX_DOCS_PER_USER:
        raise HTTPException(status_code=409, detail=f"Document limit reached ({settings.MAX_DOCS_PER_USER}). Delete one first.")

    try:
        pages = await asyncio.to_thread(extract_pages, filename, data)  # keeps the server responsive
        chunks = chunk_pages(pages)
    except DocumentError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if len(chunks) > settings.MAX_CHUNKS_PER_DOC:
        raise HTTPException(status_code=413, detail="This document is too long. Split it into smaller files.")

    try:
        vectors = await ai_service.embed_texts([c for _, c in chunks], "RETRIEVAL_DOCUMENT")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Embedding failed: {exc}") from exc

    try:  # save the document and all its chunks in one transaction
        doc = Document(user_id=user["id"], filename=filename, size_bytes=len(data), chunk_count=len(chunks))
        db.add(doc)
        await db.flush()
        await db.execute(
            INSERT_CHUNK,
            [
                {
                    "document_id": doc.id,
                    "user_id": user["id"],
                    "chunk_index": i,
                    "page": page,
                    "content": body,
                    "embedding": to_vector_literal(vec),
                }
                for i, ((page, body), vec) in enumerate(zip(chunks, vectors))
            ],
        )
        await db.commit()
        await db.refresh(doc)
    except (SQLAlchemyError, OSError) as exc:
        await db.rollback()
        raise _db_down(exc) from exc
    return doc


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: int, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(delete(Document).where(Document.id == doc_id, Document.user_id == user["id"]))
        await db.commit()  # chunks are removed automatically (ON DELETE CASCADE)
    except (SQLAlchemyError, OSError) as exc:
        await db.rollback()
        raise _db_down(exc) from exc
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Document not found.")
