from typing import Any
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models import Profile

bearer_scheme = HTTPBearer(auto_error=False)


async def _supabase_signing_key(token: str) -> tuple[Any, str]:
    """Return verification key and allowed algorithm for a Supabase JWT."""
    header = jwt.get_unverified_header(token)
    algorithm = header.get("alg")
    if algorithm == "HS256":
        return settings.supabase_jwt_secret, algorithm
    if algorithm != "ES256" or not header.get("kid"):
        raise jwt.InvalidAlgorithmError("Unsupported JWT algorithm")

    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5) as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
    jwk = next((key for key in response.json().get("keys", []) if key.get("kid") == header["kid"]), None)
    if jwk is None:
        raise jwt.InvalidKeyError("Unknown JWT key ID")
    return jwt.algorithms.ECAlgorithm.from_jwk(jwk), algorithm


async def verify_supabase_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    """Verify Supabase JWT and return its claims."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    if not settings.supabase_url:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    try:
        key, algorithm = await _supabase_signing_key(credentials.credentials)
        return jwt.decode(
            credentials.credentials,
            key,
            algorithms=[algorithm],
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
        )
    except (httpx.HTTPError, jwt.PyJWTError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc


async def _profile_role(user_id: str, db: AsyncSession) -> str | None:
    """Return profile role for a Supabase Auth user ID."""
    try:
        profile_id = UUID(user_id)
    except (ValueError, AttributeError, TypeError):
        return None
    result = await db.execute(select(Profile.role).where(Profile.id == profile_id))
    return result.scalar_one_or_none()


async def require_admin(
    payload: dict[str, Any] = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Allow only users with an admin profile role."""
    user_id = payload.get("sub")
    if not user_id or await _profile_role(user_id, db) != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return payload
