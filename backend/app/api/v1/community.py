"""Endpoint Book Community (grup diskusi + chat).

Semua endpoint wajib login (`get_current_user`): admin maupun pelanggan boleh
masuk, karena grup dibaca dan diikuti keduanya. Pembuatan grup dibatasi ke
admin (`require_admin`).

Router hanya menerjemahkan HTTP ↔ service:

- service melempar `CommunityError(status, pesan)` → diterjemahkan menjadi
  `HTTPException` dengan detail Bahasa Indonesia yang sama;
- tidak ada keputusan izin di sini — semuanya di `app.services.community`;
- `sender_id`, role, dan `created_at` **tidak pernah** dibaca dari body.

Rate limit pengiriman pesan (`SendRateLimiter`) in-memory per proses; lihat
`app/services/community/rate_limit.py`.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import UserPayload, get_current_user, require_admin
from app.db.session import get_db
from app.schemas.common import ApiResponse
from app.schemas.community import (
    GroupCategory,
    GroupCreate,
    GroupDetail,
    GroupMemberRead,
    GroupPage,
    GroupUpdate,
    HelpfulResult,
    MemberAddRequest,
    MemberRoleUpdate,
    MessageCreate,
    MessageModeration,
    MessagePage,
    MessageRead,
    TransferOwnerRequest,
    UserSearchResult,
)
from app.services.community.errors import CommunityError
from app.services.community.group_service import GroupService
from app.services.community.member_service import MemberService
from app.services.community.message_service import (
    MAX_PAGE_SIZE,
    MessageService,
)
from app.services.community.rate_limit import SendRateLimiter
from app.services.community.repository import (
    OrmGroupRepository,
    OrmMemberRepository,
    OrmMessageInteractionRepository,
    OrmMessageRepository,
)
from app.services.rewards.service import rewards_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/community", tags=["community"])

#: Satu pembatas untuk satu proses; dibagi semua permintaan.
send_limiter = SendRateLimiter()

CurrentUser = Annotated[UserPayload, Depends(get_current_user)]
Db = Annotated[AsyncSession, Depends(get_db)]


def get_group_service(db: Db) -> GroupService:
    """Service grup; provider terpisah agar mudah diganti repository palsu di tes."""
    return GroupService(OrmGroupRepository(db), OrmMemberRepository(db))


def get_member_service(
    db: Db, groups: Annotated[GroupService, Depends(get_group_service)]
) -> MemberService:
    """Service keanggotaan."""
    return MemberService(groups, OrmMemberRepository(db))


def get_message_service(
    db: Db, groups: Annotated[GroupService, Depends(get_group_service)]
) -> MessageService:
    """Service pesan dengan pembatas laju proses dan hook Book Rewards."""
    return MessageService(
        groups,
        OrmMemberRepository(db),
        OrmMessageRepository(db),
        send_limiter,
        OrmMessageInteractionRepository(db),
        on_contribution_approved=_reward_contribution,
        on_helpful=_reward_helpful,
    )


async def _reward_contribution(
    moderator: UserPayload,
    message_id: UUID,
    author_id: UUID,
    payload: MessageModeration,
) -> None:
    """Hook Book Rewards: poin kontribusi untuk pesan yang disetujui.

    Kegagalan reward (mis. cap harian) tidak menggagalkan moderasi — pesan
    tetap disetujui, hanya poinnya yang tidak diberikan. Backfill admin dapat
    menyusulkan reward yang tertinggal.
    """
    try:
        await asyncio.to_thread(
            rewards_service.reward_contribution,
            message_id=message_id,
            author_id=author_id,
            reviewer=moderator.id,
        )
    except Exception:
        logger.exception("Reward kontribusi %s gagal", message_id)


async def _reward_helpful(message_id: UUID) -> None:
    """Hook Book Rewards: poin penulis jawaban setelah tanda "membantu" cukup."""
    try:
        await asyncio.to_thread(rewards_service.reward_helpful_answer, message_id=message_id)
    except Exception:
        logger.exception("Reward jawaban membantu %s gagal", message_id)


GroupSvc = Annotated[GroupService, Depends(get_group_service)]
MemberSvc = Annotated[MemberService, Depends(get_member_service)]
MessageSvc = Annotated[MessageService, Depends(get_message_service)]


def _http(exc: CommunityError) -> HTTPException:
    headers = (
        {"Retry-After": "5"} if exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS else None
    )
    return HTTPException(status_code=exc.status_code, detail=exc.message, headers=headers)


def _ok(data: Any, pesan: str) -> ApiResponse[Any]:
    """Bungkus payload dalam envelope `ApiResponse`."""
    return ApiResponse(sukses=True, pesan=pesan, data=data)


# ---------------------------------------------------------------------------
# Grup
# ---------------------------------------------------------------------------


@router.get("/groups", response_model=ApiResponse[GroupPage])
async def list_groups(
    current_user: CurrentUser,
    service: GroupSvc,
    q: Annotated[str | None, Query(max_length=80)] = None,
    category: GroupCategory | None = None,
    mine: Annotated[bool, Query(description="Hanya grup yang saya ikuti")] = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ApiResponse[GroupPage]:
    """Daftar grup publik (+ grup privat yang saya ikuti)."""
    try:
        data = await service.list(
            current_user,
            q=q,
            category=category.value if category else None,
            only_mine=mine,
            page=page,
            page_size=page_size,
        )
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Daftar grup berhasil diambil.")


@router.get("/groups/{group_id}", response_model=ApiResponse[GroupDetail])
async def get_group(
    group_id: UUID, current_user: CurrentUser, service: GroupSvc
) -> ApiResponse[GroupDetail]:
    """Detail grup; grup privat di luar keanggotaan dijawab 404."""
    try:
        data = await service.detail(current_user, group_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Detail grup berhasil diambil.")


@router.post(
    "/groups",
    response_model=ApiResponse[GroupDetail],
    status_code=status.HTTP_201_CREATED,
)
async def create_group(
    payload: GroupCreate,
    current_user: Annotated[UserPayload, Depends(require_admin)],
    service: GroupSvc,
) -> ApiResponse[GroupDetail]:
    """Buat grup komunitas (admin). Pembuat otomatis menjadi owner."""
    try:
        data = await service.create(current_user, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Grup berhasil dibuat.")


@router.patch("/groups/{group_id}", response_model=ApiResponse[GroupDetail])
async def update_group(
    group_id: UUID, payload: GroupUpdate, current_user: CurrentUser, service: GroupSvc
) -> ApiResponse[GroupDetail]:
    """Ubah nama/deskripsi/kategori (owner atau admin)."""
    try:
        data = await service.update(current_user, group_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Grup berhasil diperbarui.")


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: UUID, current_user: CurrentUser, service: GroupSvc
) -> Response:
    """Hapus grup beserta pesannya (owner atau admin)."""
    try:
        await service.delete(current_user, group_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/groups/{group_id}/join", response_model=ApiResponse[GroupDetail])
async def join_group(
    group_id: UUID, current_user: CurrentUser, service: GroupSvc
) -> ApiResponse[GroupDetail]:
    """Gabung grup publik; idempoten."""
    try:
        data = await service.join(current_user, group_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Berhasil bergabung ke grup.")


@router.post("/groups/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: UUID, current_user: CurrentUser, service: GroupSvc
) -> Response:
    """Keluar grup; owner harus memindahkan kepemilikan lebih dulu (409)."""
    try:
        await service.leave(current_user, group_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Anggota
# ---------------------------------------------------------------------------


@router.get(
    "/groups/{group_id}/members", response_model=ApiResponse[list[GroupMemberRead]]
)
async def list_members(
    group_id: UUID, current_user: CurrentUser, service: MemberSvc
) -> ApiResponse[list[GroupMemberRead]]:
    """Daftar anggota grup (anggota/admin)."""
    try:
        data = await service.list_members(current_user, group_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Daftar anggota berhasil diambil.")


@router.get(
    "/groups/{group_id}/member-candidates",
    response_model=ApiResponse[list[UserSearchResult]],
)
async def search_member_candidates(
    group_id: UUID,
    current_user: CurrentUser,
    service: MemberSvc,
    q: Annotated[str, Query(min_length=2, max_length=100)],
) -> ApiResponse[list[UserSearchResult]]:
    """Cari pengguna untuk ditambahkan (owner/moderator saja)."""
    try:
        data = await service.search_users(current_user, group_id, q)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Hasil pencarian pengguna.")


@router.post(
    "/groups/{group_id}/members",
    response_model=ApiResponse[GroupMemberRead],
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    group_id: UUID,
    payload: MemberAddRequest,
    current_user: CurrentUser,
    service: MemberSvc,
) -> ApiResponse[GroupMemberRead]:
    """Tambahkan anggota (owner/moderator)."""
    try:
        data = await service.add_member(current_user, group_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Anggota berhasil ditambahkan.")


@router.patch(
    "/groups/{group_id}/members/{user_id}",
    response_model=ApiResponse[GroupMemberRead],
)
async def update_member_role(
    group_id: UUID,
    user_id: UUID,
    payload: MemberRoleUpdate,
    current_user: CurrentUser,
    service: MemberSvc,
) -> ApiResponse[GroupMemberRead]:
    """Ubah role member ↔ moderator (owner)."""
    try:
        data = await service.change_role(current_user, group_id, user_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Role anggota berhasil diubah.")


@router.delete(
    "/groups/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    current_user: CurrentUser,
    service: MemberSvc,
) -> Response:
    """Keluarkan anggota (owner/moderator sesuai matriks)."""
    try:
        await service.remove_member(current_user, group_id, user_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/groups/{group_id}/transfer-owner", response_model=ApiResponse[GroupDetail]
)
async def transfer_owner(
    group_id: UUID,
    payload: TransferOwnerRequest,
    current_user: CurrentUser,
    service: MemberSvc,
) -> ApiResponse[GroupDetail]:
    """Pindahkan kepemilikan (owner)."""
    try:
        data = await service.transfer_owner(current_user, group_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Kepemilikan grup berhasil dipindahkan.")


# ---------------------------------------------------------------------------
# Pesan
# ---------------------------------------------------------------------------


@router.get("/groups/{group_id}/messages", response_model=ApiResponse[MessagePage])
async def list_messages(
    group_id: UUID,
    current_user: CurrentUser,
    service: MessageSvc,
    cursor: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = 30,
) -> ApiResponse[MessagePage]:
    """Riwayat pesan kronologis; `cursor` untuk memuat pesan lebih lama."""
    try:
        data = await service.list_messages(
            current_user, group_id, cursor=cursor, limit=limit
        )
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Riwayat pesan berhasil diambil.")


@router.post(
    "/groups/{group_id}/messages", response_model=ApiResponse[MessageRead]
)
async def send_message(
    group_id: UUID,
    payload: MessageCreate,
    current_user: CurrentUser,
    service: MessageSvc,
    response: Response,
) -> ApiResponse[MessageRead]:
    """Kirim pesan. 201 untuk pesan baru, 200 bila mengulang `client_message_id`."""
    try:
        data, created = await service.send_message(current_user, group_id, payload)
    except CommunityError as exc:
        raise _http(exc) from None
    response.status_code = (
        status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )
    return _ok(data, "Pesan terkirim." if created else "Pesan sudah terkirim.")


@router.delete(
    "/groups/{group_id}/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_message(
    group_id: UUID,
    message_id: UUID,
    current_user: CurrentUser,
    service: MessageSvc,
) -> Response:
    """Hapus pesan (pengirim, moderator, owner, atau admin)."""
    try:
        await service.delete_message(current_user, group_id, message_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post(
    "/groups/{group_id}/messages/{message_id}/moderate",
    response_model=ApiResponse[MessageRead],
)
async def moderate_message(
    group_id: UUID,
    message_id: UUID,
    payload: MessageModeration,
    current_user: CurrentUser,
    service: MessageSvc,
) -> ApiResponse[MessageRead]:
    """Setujui/tolak usulan reward kontribusi (moderator/owner, bukan pengirim)."""
    try:
        data = await service.moderate_message(
            current_user, group_id, message_id, payload
        )
    except CommunityError as exc:
        raise _http(exc) from None
    pesan = "Kontribusi disetujui." if payload.status == "approved" else "Kontribusi ditolak."
    return _ok(data, pesan)


@router.post(
    "/groups/{group_id}/messages/{message_id}/helpful",
    response_model=ApiResponse[HelpfulResult],
)
async def mark_helpful(
    group_id: UUID,
    message_id: UUID,
    current_user: CurrentUser,
    service: MessageSvc,
) -> ApiResponse[HelpfulResult]:
    """Tandai balasan "membantu" (anggota lain; idempoten)."""
    try:
        data = await service.mark_helpful(current_user, group_id, message_id)
    except CommunityError as exc:
        raise _http(exc) from None
    return _ok(data, "Tanda membantu tersimpan.")
