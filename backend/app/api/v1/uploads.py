import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from app.core.config import settings
from app.core.security import require_staff_or_admin, UserPayload
from app.core.supabase import supabase_admin
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/uploads", tags=["Unggah Berkas"])

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.post("/product-image", response_model=ApiResponse[dict])
async def upload_product_cover(
    file: UploadFile = File(...),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipe file tidak didukung. Hanya JPEG, PNG, dan WebP yang diperbolehkan.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ukuran berkas terlalu besar. Maksimal 5MB.",
        )

    ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    unique_name = f"covers/{uuid.uuid4().hex}.{ext}"

    try:
        res = supabase_admin.storage.from_(settings.STORAGE_BUCKET_PRODUCTS).upload(
            path=unique_name,
            file=file_bytes,
            file_options={"content-type": file.content_type},
        )
        public_url = supabase_admin.storage.from_(settings.STORAGE_BUCKET_PRODUCTS).get_public_url(unique_name)

        return ApiResponse(
            sukses=True,
            pesan="Gambar sampul produk berhasil diunggah.",
            data={
                "path": unique_name,
                "url": public_url,
            },
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengunggah gambar ke Supabase Storage: {str(e)}",
        )
