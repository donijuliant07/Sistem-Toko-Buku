"""Unggah berkas ke Supabase Storage. Khusus admin."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core import uploads
from app.core.config import settings
from app.core.errors import SERVICE_ERRORS
from app.core.security import UserPayload, require_admin
from app.core.supabase import supabase_admin
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/uploads", tags=["Unggah Berkas"])


@router.post("/product-image", response_model=ApiResponse[dict])
async def upload_product_cover(
    file: Annotated[UploadFile, File()],
    current_user: Annotated[UserPayload, Depends(require_admin)] = None,
):
    # Batas ukuran/format dari `app.core.uploads` — sama dengan bukti pembayaran.
    file_bytes = await file.read()
    try:
        content_type, extension = uploads.validate_image(file_bytes, file.content_type)
    except ValueError as exc:
        raise HTTPException(
            status_code=(
                status.HTTP_413_CONTENT_TOO_LARGE
                if "terlalu besar" in str(exc)
                else status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            ),
            detail=str(exc),
        ) from None

    unique_name = f"covers/{uuid.uuid4().hex}.{extension}"

    try:
        supabase_admin.storage.from_(settings.STORAGE_BUCKET_PRODUCTS).upload(
            path=unique_name,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": "false"},
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
    except SERVICE_ERRORS as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal mengunggah gambar ke Supabase Storage: {e!s}",
        )
