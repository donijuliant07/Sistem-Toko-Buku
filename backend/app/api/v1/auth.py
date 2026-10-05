from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user, UserPayload
from app.core.supabase import supabase_anon, supabase_admin
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfileResponse
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/auth", tags=["Autentikasi"])


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(payload: LoginRequest):
    try:
        res = supabase_anon.auth.sign_in_with_password({
            "email": payload.email,
            "password": payload.password,
        })
        if not res.session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email atau kata sandi tidak cocok.",
            )

        user_id = res.user.id
        # Query profile table
        profile_res = supabase_admin.table("profiles").select("*").eq("id", user_id).single().execute()
        profile_data = profile_res.data or {}

        user_profile = UserProfileResponse(
            id=user_id,
            email=res.user.email or "",
            full_name=profile_data.get("full_name", res.user.user_metadata.get("full_name", "Pengguna")),
            role=profile_data.get("role", res.user.app_metadata.get("role", "customer")),
            avatar_url=profile_data.get("avatar_url"),
            created_at=res.user.created_at,
        )

        return ApiResponse(
            sukses=True,
            pesan="Login berhasil",
            data=TokenResponse(
                access_token=res.session.access_token,
                token_type="bearer",
                user=user_profile,
            ),
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal melakukan login: {str(e)}",
        )


@router.post("/register", response_model=ApiResponse[UserProfileResponse])
async def register(payload: RegisterRequest):
    try:
        res = supabase_anon.auth.sign_up({
            "email": payload.email,
            "password": payload.password,
            "options": {
                "data": {
                    "full_name": payload.full_name,
                    "phone": payload.phone,
                    "role": "customer",
                }
            }
        })
        if not res.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pendaftaran akun gagal diproses.",
            )

        return ApiResponse(
            sukses=True,
            pesan="Registrasi akun berhasil.",
            data=UserProfileResponse(
                id=res.user.id,
                email=res.user.email or payload.email,
                full_name=payload.full_name,
                role="customer",
                avatar_url=None,
                created_at=res.user.created_at,
            ),
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal registrasi: {str(e)}",
        )


@router.get("/me", response_model=ApiResponse[UserProfileResponse])
async def get_my_profile(current_user: Annotated[UserPayload, Depends(get_current_user)]):
    profile_res = supabase_admin.table("profiles").select("*").eq("id", current_user.id).single().execute()
    data = profile_res.data or {}

    return ApiResponse(
        sukses=True,
        pesan="Data profil berhasil dimuat.",
        data=UserProfileResponse(
            id=current_user.id,
            email=current_user.email or "",
            full_name=data.get("full_name", current_user.user_metadata.get("full_name", "Pengguna")),
            role=data.get("role", current_user.role),
            avatar_url=data.get("avatar_url"),
            created_at=data.get("created_at", ""),
        ),
    )
