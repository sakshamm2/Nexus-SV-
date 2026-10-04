import httpx
from fastapi import Depends, Header, HTTPException
from app.core.config import settings

async def get_optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(f"{settings.SUPABASE_URL}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": settings.SUPABASE_ANON_KEY})
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")
    return res.json()

async def get_current_user(user: dict | None = Depends(get_optional_user)) -> dict:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in to use this feature.")
    return user
