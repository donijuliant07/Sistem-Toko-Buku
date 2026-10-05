from typing import Annotated, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer(auto_error=False)


class UserPayload(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "customer"
    app_metadata: dict = {}
    user_metadata: dict = {}


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)]
) -> UserPayload:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header otentikasi Bearer token tidak ditemukan.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        # Supabase JWT signature validation with HMAC SHA256 using SUPABASE_JWT_SECRET
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tidak memiliki klaim 'sub' pengguna yang valid.",
            )

        app_metadata = payload.get("app_metadata", {})
        user_metadata = payload.get("user_metadata", {})

        # User role prioritization: app_metadata.role -> user_metadata.role -> "customer"
        role = app_metadata.get("role") or user_metadata.get("role") or "customer"

        return UserPayload(
            id=user_id,
            email=payload.get("email"),
            role=role,
            app_metadata=app_metadata,
            user_metadata=user_metadata,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi login telah kedaluwarsa. Silakan login kembali.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token otentikasi tidak valid: {str(e)}",
        )


async def require_admin(
    current_user: Annotated[UserPayload, Depends(get_current_user)]
) -> UserPayload:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator.",
        )
    return current_user


async def require_staff_or_admin(
    current_user: Annotated[UserPayload, Depends(get_current_user)]
) -> UserPayload:
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini membutuhkan hak akses Staff atau Administrator.",
        )
    return current_user
