"""Service keanggotaan: daftar, cari pengguna, tambah, keluarkan, ubah role,
transfer kepemilikan.

Urutan keamanan yang sama dengan `group_service`: identitas dan role pemanggil
dibaca dari token/database, **tidak pernah** dari body; target aksi dipilih
lewat id pengguna dari hasil pencarian, bukan username bebas.

Invariant yang dijaga:

- tepat satu **owner** per grup — keluar/keluarkan owner ditolak 409, dan
  transfer menurunkan owner lama lebih dulu sebelum menaikkan owner baru
  (unique partial index `uq_chat_group_members_single_owner`);
- moderator hanya menambah/keluarkan `member`, tidak bisa mengubah role;
- role `owner` tidak bisa di-set langsung; hanya lewat transfer kepemilikan.
"""

from __future__ import annotations

from uuid import UUID

from app.core.security import UserPayload
from app.schemas.community import (
    GroupDetail,
    GroupMemberRead,
    MemberAddRequest,
    MemberProfile,
    MemberRoleUpdate,
    TransferOwnerRequest,
    UserSearchResult,
)
from app.services.community import permissions
from app.services.community.errors import CommunityError, conflict, forbidden
from app.services.community.group_service import (
    GroupService,
    _is_admin,
    _user_uuid,
    detail_from_row,
)
from app.services.community.repository import MemberRow, OrmMemberRepository

#: Batas panjang kata kunci pencarian untuk membatasi kueri ILIKE.
MAX_SEARCH_LENGTH = 100


def _member_read(row: MemberRow) -> GroupMemberRead:
    """Bentuk anggota yang dikirim ke frontend."""
    return GroupMemberRead(
        user=MemberProfile(
            id=row.user_id,
            username=row.username,
            full_name=row.full_name,
            avatar_url=row.avatar_url,
        ),
        role=row.role,
        joined_at=row.joined_at,
    )


class MemberService:
    """Keanggotaan per grup; izin selalu dihitung backend."""

    def __init__(self, groups: GroupService, members: OrmMemberRepository) -> None:
        self._groups = groups
        self._members = members

    async def _role(self, user: UserPayload, group_id: UUID) -> str | None:
        """Role pemanggil di grup yang terlihat (404 bila tidak terlihat)."""
        row = await self._groups.load_visible(group_id, user)
        return row.my_role

    async def _require_manager(self, user: UserPayload, group_id: UUID) -> str:
        """Owner/moderator; selain itu 403 dengan pesan jelas."""
        role = await self._role(user, group_id)
        if not permissions.can_manage_members(role):
            raise forbidden(
                "Hanya pemilik atau moderator grup yang dapat mengelola anggota."
            )
        return role or ""

    async def list_members(
        self, user: UserPayload, group_id: UUID
    ) -> list[GroupMemberRead]:
        """Daftar anggota; untuk anggota grup (admin global boleh membaca)."""
        role = await self._role(user, group_id)
        if not permissions.can_read_messages(role, _is_admin(user)):
            raise forbidden("Gabung grup untuk melihat anggota.")
        return [_member_read(item) for item in await self._members.list(group_id)]

    async def search_users(
        self, user: UserPayload, group_id: UUID, q: str
    ) -> list[UserSearchResult]:
        """Pencarian pengguna untuk dialog tambah anggota.

        Dibatasi pada pengelola grup supaya endpoint ini tidak menjadi
        direktori pengguna terbuka. Anggota yang sudah ada disaring keluar.
        """
        await self._require_manager(user, group_id)
        term = q.strip()[:MAX_SEARCH_LENGTH]
        if len(term) < 2:
            raise CommunityError(422, "Kata kunci minimal 2 karakter.")
        candidates = await self._members.find_users(term)
        existing = {item.user_id for item in await self._members.list(group_id)}
        return [
            UserSearchResult(
                id=profile.id,
                username=profile.username,
                full_name=profile.full_name,
                avatar_url=profile.avatar_url,
            )
            for profile in candidates
            if profile.id not in existing
        ]

    async def add_member(
        self, user: UserPayload, group_id: UUID, payload: MemberAddRequest
    ) -> GroupMemberRead:
        """Tambahkan pengguna sebagai `member`; target harus punya profil."""
        role = await self._require_manager(user, group_id)
        if not permissions.can_add_with_role(role, permissions.ROLE_MEMBER):
            raise forbidden("Anda tidak dapat menambahkan anggota ke grup ini.")
        profile = await self._members.get_profile(payload.user_id)
        if profile is None:
            raise CommunityError(404, "Pengguna tidak ditemukan.")
        inserted = await self._members.add(
            group_id, payload.user_id, permissions.ROLE_MEMBER
        )
        if not inserted:
            raise conflict("Pengguna sudah menjadi anggota grup.")
        await self._groups.commit()
        added = {
            item.user_id: item for item in await self._members.list(group_id)
        }.get(payload.user_id)
        if added is None:  # pragma: no cover - baru disisipkan
            raise CommunityError(500, "Anggota gagal dibaca setelah ditambahkan.")
        return _member_read(added)

    async def remove_member(
        self, user: UserPayload, group_id: UUID, target_id: UUID
    ) -> None:
        """Keluarkan anggota; owner tidak bisa dikeluarkan (pakai transfer)."""
        role = await self._require_manager(user, group_id)
        target = await self._members.get(group_id, target_id)
        if target is None:
            raise CommunityError(404, "Anggota tidak ditemukan.")
        if not permissions.can_remove_member(role, target.role):
            if target.role == permissions.ROLE_OWNER:
                raise conflict("Pemilik grup tidak dapat dikeluarkan.")
            raise forbidden("Anda tidak dapat mengeluarkan anggota ini.")
        await self._groups.lock(group_id)
        await self._members.remove(group_id, target_id)
        await self._groups.commit()

    async def change_role(
        self,
        user: UserPayload,
        group_id: UUID,
        target_id: UUID,
        payload: MemberRoleUpdate,
    ) -> GroupMemberRead:
        """Ubah role member ↔ moderator (owner saja)."""
        role = await self._role(user, group_id)
        target = await self._members.get(group_id, target_id)
        if target is None:
            raise CommunityError(404, "Anggota tidak ditemukan.")
        if target.role == permissions.ROLE_OWNER:
            raise conflict("Kepemilikan dipindahkan lewat transfer kepemilikan.")
        if not permissions.can_change_role(role, target.role, payload.role.value):
            raise forbidden("Hanya pemilik grup yang dapat mengubah role anggota.")
        await self._members.set_role(group_id, target_id, payload.role.value)
        await self._groups.commit()
        refreshed = {
            item.user_id: item for item in await self._members.list(group_id)
        }.get(target_id)
        if refreshed is None:  # pragma: no cover
            raise CommunityError(404, "Anggota tidak ditemukan.")
        return _member_read(refreshed)

    async def transfer_owner(
        self, user: UserPayload, group_id: UUID, payload: TransferOwnerRequest
    ) -> GroupDetail:
        """Pindahkan kepemilikan ke anggota lain; owner lama menjadi moderator."""
        row = await self._groups.load_visible(group_id, user)
        if not permissions.can_transfer_owner(row.my_role):
            raise forbidden("Hanya pemilik grup yang dapat memindahkan kepemilikan.")
        if payload.user_id == _user_uuid(user):
            raise conflict("Anda sudah menjadi pemilik grup ini.")
        target = await self._members.get(group_id, payload.user_id)
        if target is None:
            raise CommunityError(404, "Pengguna bukan anggota grup.")
        # Kunci baris grup, lalu turunkan owner lama sebelum menaikkan yang baru:
        # unique partial index hanya mengizinkan satu owner per grup.
        await self._groups.lock(group_id)
        await self._members.transfer_owner(group_id, _user_uuid(user), payload.user_id)
        await self._groups.commit()
        refreshed = await self._groups.load_visible(group_id, user)
        return detail_from_row(refreshed, user)
