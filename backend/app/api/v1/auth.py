from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_admin, verify_supabase_token
from app.db.session import get_db
from app.models import Profile

router = APIRouter()


@router.get("/me")
async def get_current_user(
    payload: dict[str, Any] = Depends(verify_supabase_token),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return authenticated user claims and application profile role."""
    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user ID") from exc

    result = await db.execute(select(Profile).where(Profile.id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return {"id": str(profile.id), "email": payload.get("email"), "role": profile.role}


@router.get("/admin/check")
async def check_admin(payload: dict[str, Any] = Depends(require_admin)) -> dict[str, str]:
    """Verify that current user has an admin profile role."""
    return {"status": "ok"}
