
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Password pengguna")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, description="Nama lengkap pengguna")
    phone: str | None = None


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    avatar_url: str | None = None
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileResponse
