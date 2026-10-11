from typing import Annotated, Any, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer(auto_error=False)

# Supabase menandatangani access token dengan kunci asimetris (ES256/RS256) dan
# menerbitkan public key-nya lewat JWKS. Projek ini sudah memakai model kunci
# baru — `frontend/.env` berisi anon key `sb_publishable_...` dan JWT secret
# legacy sudah tidak menandatangani token — sehingga verifikasi HS256 saja
# menolak setiap token dengan
# "The specified alg value is not allowed".
# HS256 tetap dicoba sebagai jalur transisi; percobaan pertama saja yang
# menghasilkan error, bukan gabungan keduanya.
_JWKS_URL = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
_ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]

_jwks_client: Optional[jwt.PyJWKClient] = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(_JWKS_URL)
    return _jwks_client


def _decode_token(token: str) -> dict[str, Any]:
    """Verifikasi token Supabase: JWKS untuk alg asimetris, HS256 untuk token legacy.

    `alg` dibaca dari header dulu (belum diverifikasi) supaya token HS256 tidak
    memicu pengambilan JWKS sama sekali, dan supaya tiap jalur hanya menerima
    keluarga algoritma yang cocok — bukan campuran yang bisa disalahgunakan.
    """
    alg = jwt.get_unverified_header(token).get("alg", "")

    if alg in _ASYMMETRIC_ALGORITHMS:
        key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=_ASYMMETRIC_ALGORITHMS,
            audience="authenticated",
        )

    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )


class UserPayload(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "user"
    app_metadata: dict = {}
    user_metadata: dict = {}


# Satu-satunya nilai role yang sah — sama dengan CHECK constraint
# `ck_profiles_role` di tabel `profiles`.
VALID_ROLES = {"user", "admin"}


async def resolve_user_role(user_id: str) -> str:
    """Baca role dari `profiles` — satu-satunya sumber otorisasi yang tepercaya.

    Metadata di dalam JWT (`user_metadata`) dapat diubah sendiri oleh pemilik
    akun, jadi tidak pernah dipakai untuk menentukan hak akses. Bila profil
    tidak ada atau rolenya di luar `VALID_ROLES`, akses ditolak (fail closed)
    alih-alih memberi role default yang permisif.
    """
    # Import lokal: `supabase` mengimpor konfigurasi yang juga dipakai modul ini,
    # dan pemisahan ini menjaga urutan impor tetap sederhana.
    from app.core.supabase import supabase_admin

    try:
        row = (
            supabase_admin.table("profiles")
            .select("role")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Gagal memverifikasi peran pengguna. Coba lagi beberapa saat lagi.",
        )

    role = (row.data or {}).get("role") if row else None
    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak memiliki peran yang sah. Hubungi administrator toko.",
        )
    return role


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
        payload = _decode_token(token)
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tidak memiliki klaim 'sub' pengguna yang valid.",
            )

        app_metadata = payload.get("app_metadata", {})
        user_metadata = payload.get("user_metadata", {})

        # Role tidak pernah diambil dari klaim token (dapat dimodifikasi user);
        # selalu dari tabel `profiles` lewat kredensial tepercaya di server.
        role = await resolve_user_role(user_id)

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


async def require_user(
    current_user: Annotated[UserPayload, Depends(get_current_user)]
) -> UserPayload:
    """Hanya pelanggan (`role = 'user'`) yang boleh bertransaksi.

    Administrator mengelola toko lewat dashboard dan tidak berbelanja dengan
    akunnya; kalau ingin membeli, ia memakai akun pelanggan terpisah.
    """
    if current_user.role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini hanya untuk akun pelanggan.",
        )
    return current_user
