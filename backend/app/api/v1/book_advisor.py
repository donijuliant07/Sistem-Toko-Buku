"""Endpoint AI Book Advisor.

- **Chat** (`POST /book-advisor/chat`) — pelanggan login (`require_user`),
  sama seperti keranjang dan pembanding harga.
- **Riwayat, preferensi, feedback** — hanya untuk pemilik sesi.
  Kepemilikan diperiksa di service (`AdvisorSessionStore.get(..., user_id)`);
  sesi orang lain dijawab `404`, bukan `403`, supaya keberadaan sesi tidak
  bocor.

Router hanya menerjemahkan HTTP ↔ service; seluruh aturan ada di
`app.services.advisor`. Katalog dibaca lewat `AsyncSession` milik permintaan
(`get_db`), bukan koneksi baru.
"""

from __future__ import annotations

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserPayload, require_user
from app.db.session import get_db
from app.schemas.advisor_preferences import AdvisorPreferenceUpdate
from app.schemas.book_advisor import (
    AdvisorChatRequest,
    AdvisorChatResponse,
    AdvisorFeedbackRequest,
    AdvisorFeedbackResponse,
    AdvisorSessionRead,
    BookPreferences,
)
from app.schemas.common import ApiResponse
from app.services.advisor.catalog import SqlAdvisorCatalog
from app.services.advisor.service import BookAdvisorService, build_service
from app.services.advisor.session import InMemoryAdvisorSessionStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/book-advisor", tags=["book-advisor"])

#: Store proses tunggal, dibatasi ukuran dan TTL (`session.py`). Sesi hilang
#: saat restart — cukup untuk demo, bukan pengganti tabel database.
session_store: InMemoryAdvisorSessionStore = InMemoryAdvisorSessionStore()

#: Kegagalan baca katalog yang bukan bug pemrograman (DB tidak terjangkau).
CATALOG_UNREACHABLE = (SQLAlchemyError, OSError)

class _NoCatalog:
    """Katalog yang tidak boleh dipakai — untuk endpoint yang tidak membaca buku.

    Endpoint riwayat/preferensi/feedback tidak memindai katalog; memberi
    objek ini membuat pelanggaran kontrak terlihat saat pengujian, bukan
    diam-diam menjalankan kueri tak perlu.
    """

    async def search(self, *_args, **_kwargs):  # pragma: no cover - jaring pengaman
        raise RuntimeError("Endpoint ini tidak membaca katalog.")

def _session_service(db: AsyncSession | None) -> BookAdvisorService:
    """Service untuk satu permintaan; katalog hanya disuntikkan bila ada DB."""
    catalog = SqlAdvisorCatalog(db) if db is not None else _NoCatalog()
    return build_service(catalog, session_store)

def _not_found() -> HTTPException:
    """Respons seragam untuk sesi yang tidak ada maupun bukan milik pemanggil."""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Sesi percakapan tidak ditemukan.",
    )

@router.post("/chat", response_model=ApiResponse[AdvisorChatResponse])
async def chat(
    payload: AdvisorChatRequest,
    current_user: Annotated[UserPayload, Depends(require_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[AdvisorChatResponse]:
    """Kirim satu pesan; balas pertanyaan lanjutan atau rekomendasi dari katalog."""
    service = _session_service(db)
    try:
        result = await service.chat(current_user.id, payload)
    except CATALOG_UNREACHABLE:
        logger.exception("Katalog buku tidak dapat dibaca saat memproses book advisor")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Katalog buku sedang tidak dapat diakses. Coba lagi beberapa saat lagi.",
        ) from None
    return ApiResponse(sukses=True, pesan="Pesan berhasil diproses.", data=result)

@router.get("/sessions/{session_id}/messages", response_model=ApiResponse[AdvisorSessionRead])
async def get_session_messages(
    session_id: str,
    current_user: Annotated[UserPayload, Depends(require_user)],
) -> ApiResponse[AdvisorSessionRead]:
    """Riwayat percakapan milik pemanggil."""
    try:
        session_uuid = UUID(session_id)
    except ValueError:
        raise _not_found() from None
    try:
        data = _session_service(None).get_session(current_user.id, session_uuid)
    except KeyError:
        raise _not_found() from None
    return ApiResponse(sukses=True, pesan="Riwayat sesi berhasil dimuat.", data=data)

@router.get("/preferences", response_model=ApiResponse[BookPreferences])
async def get_preferences(
    current_user: Annotated[UserPayload, Depends(require_user)],
    session_id: Annotated[str | None, Query(description="Sesi yang diminta")] = None,
) -> ApiResponse[BookPreferences]:
    """Preferensi pada satu sesi; tanpa `session_id`, kembalikan profil kosong."""
    session_uuid: UUID | None = None
    if session_id is not None:
        try:
            session_uuid = UUID(session_id)
        except ValueError:
            raise _not_found() from None
    try:
        data = _session_service(None).get_preferences(current_user.id, session_uuid)
    except KeyError:
        raise _not_found() from None
    return ApiResponse(sukses=True, pesan="Preferensi berhasil dimuat.", data=data)

@router.patch("/preferences", response_model=ApiResponse[BookPreferences])
async def update_preferences(
    payload: AdvisorPreferenceUpdate,
    current_user: Annotated[UserPayload, Depends(require_user)],
) -> ApiResponse[BookPreferences]:
    """Perbarui preferensi milik pemilik sesi; daftar yang dikirim menggantikan daftar lama."""
    try:
        data = _session_service(None).update_preferences(
            current_user.id,
            payload.session_id,
            payload.model_dump(exclude={"session_id"}, exclude_unset=True),
        )
    except KeyError:
        raise _not_found() from None
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from None
    return ApiResponse(sukses=True, pesan="Preferensi berhasil diperbarui.", data=data)

@router.post("/feedback", response_model=ApiResponse[AdvisorFeedbackResponse])
async def submit_feedback(
    payload: AdvisorFeedbackRequest,
    current_user: Annotated[UserPayload, Depends(require_user)],
) -> ApiResponse[AdvisorFeedbackResponse]:
    """Catat suka/tidak cocok; 'not_relevant' mengecualikan buku dari pencarian berikutnya."""
    try:
        data = _session_service(None).add_feedback(current_user.id, payload)
    except KeyError:
        raise _not_found() from None
    return ApiResponse(sukses=True, pesan="Feedback berhasil dicatat.", data=data)
