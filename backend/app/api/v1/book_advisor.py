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

Tagihan poin (Book Rewards)
---------------------------
Kebijakan, seluruhnya diputuskan backend:

1. Validasi input dan auth berjalan lebih dulu — request yang ditolak tidak
   menyentuh ledger.
2. Bila chat membutuhkan AI (`_will_use_model`), biaya dibaca dari
   `reward_rules` (`advisor_message_points`, awal 10) dan **dipotong dulu**
   lewat RPC atomik sebelum provider dipanggil. Saldo kurang → `400
   INSUFFICIENT_POINTS`, provider tidak dipanggil, saldo tidak berubah.
3. Bila provider dikonfigurasi tetapi gagal (timeout/5xx/JSON tidak sesuai),
   poin dikembalikan (`advisor:<message_id>:refund`) dan respons menandai
   `outcome=provider_failed` — pengguna tidak membayar balasan yang bukan AI.
4. Key idempotensi memakai `message_id` dari klien, jadi retry/kirim ulang
   tidak memotong poin dua kali.
5. Tidak ada transaksi database yang terbuka selama menunggu provider: RPC
   ledger adalah panggilan PostgREST terpisah yang selesai sebelum model
   dipanggil.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated
from uuid import UUID, uuid4

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
    AdvisorOutcome,
    AdvisorSessionRead,
    BookPreferences,
)
from app.schemas.common import ApiResponse
from app.services.advisor.catalog import SqlAdvisorCatalog
from app.services.advisor.service import BookAdvisorService, build_service
from app.services.advisor.session import InMemoryAdvisorSessionStore
from app.services.rewards.errors import RewardsError
from app.services.rewards.service import RewardsService, rewards_service

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


def get_rewards_service() -> RewardsService:
    """Provider terpisah agar tes dapat menyuntikkan ledger/repository palsu."""
    return rewards_service

RewardsSvc = Annotated[RewardsService, Depends(get_rewards_service)]

#: Perkiraan backend apakah pesan ini akan memanggil provider AI. Dipakai
#: hanya untuk memutuskan *perlu menagih*, bukan untuk menghitung biaya.
#: `False` yang keliru berarti pengguna tidak ditagih (aman baginya); `True`
#: yang keliru berarti ditagih lalu di-refund karena hasil `unconfigured`.
def _will_use_model(service: BookAdvisorService) -> bool:
    return service.ai_enabled


def _http(exc: RewardsError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.detail)


def _balance(service: RewardsService, user: UserPayload) -> int | None:
    """Saldo terbaru; kegagalan baca tidak boleh membatalkan balasan yang sah."""
    try:
        return service.get_balance(user)
    except RewardsError:
        return None


@router.get("/pricing", response_model=ApiResponse[dict])
async def advisor_pricing(
    current_user: Annotated[UserPayload, Depends(require_user)],
    rewards: RewardsSvc,
) -> ApiResponse[dict]:
    """Biaya per pesan dan saldo pengguna, untuk ditampilkan sebelum mengirim."""
    try:
        cost = await asyncio.to_thread(rewards.advisor_message_cost)
        balance = await asyncio.to_thread(rewards.get_balance, current_user)
    except RewardsError as exc:
        raise _http(exc) from exc
    return ApiResponse(
        sukses=True,
        pesan="Biaya pesan advisor berhasil dimuat.",
        data={"points_cost": cost, "points_balance": balance},
    )


@router.post("/chat", response_model=ApiResponse[AdvisorChatResponse])
async def chat(
    payload: AdvisorChatRequest,
    current_user: Annotated[UserPayload, Depends(require_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    rewards: RewardsSvc,
) -> ApiResponse[AdvisorChatResponse]:
    """Kirim satu pesan; balas pertanyaan lanjutan atau rekomendasi dari katalog.

    Validasi Pydantic (pesan kosong) dan auth sudah berjalan di atas — keduanya
    tidak menyentuh ledger. Urutan selanjutnya: biaya → cek saldo → potong →
    panggil AI → refund bila provider gagal.
    """
    message_id = payload.message_id or uuid4()
    service = _session_service(db)

    cost = 0
    if _will_use_model(service):
        try:
            cost = await asyncio.to_thread(rewards.advisor_message_cost)
        except RewardsError as exc:
            raise _http(exc) from exc
        if cost > 0:
            try:
                # Reservasi: dipotong sebelum AI dipanggil. Bila saldo kurang,
                # RPC menolak dan tidak ada yang berubah — provider tidak
                # pernah dipanggil.
                await asyncio.to_thread(
                    rewards.charge_advisor_message,
                    current_user,
                    message_id=message_id,
                    cost=cost,
                )
            except RewardsError as exc:
                raise _http(exc) from exc

    try:
        result = await service.chat(current_user.id, payload)
    except CATALOG_UNREACHABLE:
        logger.exception("Katalog buku tidak dapat dibaca saat memproses book advisor")
        # Poin sudah dipotong tetapi provider tidak pernah dipanggil: kembalikan.
        await _refund(rewards, current_user, message_id, cost, "catalog_unreachable")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Katalog buku sedang tidak dapat diakses. Coba lagi beberapa saat lagi.",
        ) from None

    refunded = 0
    if result.outcome is AdvisorOutcome.PROVIDER_FAILED and cost > 0:
        refunded = await _refund(rewards, current_user, message_id, cost, "provider_failed")
    elif result.outcome is AdvisorOutcome.UNCONFIGURED and cost > 0:
        # Perkiraan `_will_use_model` salah: tidak ada panggilan AI, tidaklah pantas ditagih.
        refunded = await _refund(rewards, current_user, message_id, cost, "ai_not_invoked")

    data = result.model_copy(
        update={
            "message_id": message_id,
            "points_cost": cost,
            "points_charged": max(0, cost - refunded),
            "points_refunded": refunded,
            "points_balance": await asyncio.to_thread(_balance, rewards, current_user),
        }
    )
    return ApiResponse(sukses=True, pesan="Pesan berhasil diproses.", data=data)


async def _refund(
    rewards: RewardsService,
    user: UserPayload,
    message_id: UUID,
    charged: int,
    reason: str,
) -> int:
    """Refund idempoten; mengembalikan jumlah poin yang dikembalikan (0 bila gagal)."""
    if charged <= 0:
        return 0
    try:
        await asyncio.to_thread(
            rewards.refund_advisor_message,
            user,
            message_id=message_id,
            charged=charged,
            reason=reason,
        )
    except RewardsError:
        # Refund yang gagal tidak boleh menghapus balasan; ledger tetap
        # konsisten dan admin dapat menyesuaikan secara manual.
        logger.exception("Refund pesan advisor %s gagal", message_id)
        return 0
    return charged

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
