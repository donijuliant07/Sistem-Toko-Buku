"""Service grup: daftar, detail, buat, ubah, hapus, gabung, keluar.

Router hanya menerjemahkan HTTP ↔ service. Setiap aksi mengikuti urutan yang
sama:

1. muat data (grup + keanggotaan pemanggil);
2. putuskan izin lewat `permissions` (404 bila grup disembunyikan, 403 bila
   terlihat tetapi tidak diizinkan);
3. jalankan perubahan lewat repository (`flush()`), lalu `commit()` **sekali**
   di akhir — sehingga grup dan kepemilikan owner-nya tidak pernah terpisah.

Identitas pemanggil datang dari token (`UserPayload`); body permintaan tidak
pernah dibaca untuk `sender_id`/role.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.core.security import UserPayload
from app.schemas.community import (
    GroupCreate,
    GroupDetail,
    GroupPage,
    GroupSummary,
    GroupUpdate,
)
from app.services.community import permissions
from app.services.community.errors import (
    CommunityError,
    conflict,
    forbidden,
    not_found_group,
)
from app.services.community.repository import (
    GroupRow,
    OrmGroupRepository,
    OrmMemberRepository,
)


def _user_uuid(user: UserPayload) -> UUID:
    """Id pemanggil dari token; `get_current_user` sudah menjamin `sub` ada."""
    return UUID(user.id)


def _is_admin(user: UserPayload) -> bool:
    return user.role == "admin"


def summary_from_row(row: GroupRow) -> GroupSummary:
    """Bentuk ringkas grup untuk daftar."""
    group = row.group
    return GroupSummary(
        id=group.id,
        name=group.name,
        description=group.description or "",
        category=group.category,
        visibility=group.visibility,
        avatar_url=group.avatar_url,
        member_count=row.member_count,
        is_member=row.my_role is not None,
        my_role=row.my_role,
        created_at=group.created_at,
    )


def detail_from_row(row: GroupRow, user: UserPayload) -> GroupDetail:
    """Bentuk detail grup beserta izin yang dihitung backend untuk pemanggil."""
    base = summary_from_row(row)
    admin = _is_admin(user)
    return GroupDetail(
        **base.model_dump(),
        created_by=row.group.created_by,
        can_manage_group=permissions.can_manage_group(row.my_role, admin),
        can_manage_members=permissions.can_manage_members(row.my_role),
        can_send=permissions.can_send(row.my_role),
    )


class GroupService:
    """Aturan grup dan keanggotaan miliknya.

    `members` disuntikkan agar operasi yang mengubah keanggotaan (join/leave)
    tetap memakai satu repository anggota; `commit`/`rollback` tetap lewat
    repository grup karena keduanya berbagi sesi yang sama.
    """

    def __init__(
        self, groups: OrmGroupRepository, members: OrmMemberRepository
    ) -> None:
        self._groups = groups
        self._members = members

    async def load_visible(self, group_id: UUID, user: UserPayload) -> GroupRow:
        """Grup yang boleh dilihat pemanggil; selain itu 404.

        Dipakai juga `MemberService` dan `MessageService` supaya aturan
        "privat = tidak terlihat" hanya ditulis sekali.
        """
        row = await self._groups.get(group_id, user_id=_user_uuid(user))
        if row is None or not permissions.can_view_group(
            row.group.visibility, row.my_role, _is_admin(user)
        ):
            raise not_found_group()
        return row

    async def lock(self, group_id: UUID) -> None:
        """Kunci baris grup untuk mutasi keanggotaan (dipakai `MemberService`)."""
        await self._groups.get_for_update(group_id)

    async def commit(self) -> None:
        """Komit unit kerja bersama (dipakai `MemberService`/`MessageService`)."""
        await self._groups.commit()

    async def rollback(self) -> None:
        """Batalkan unit kerja setelah pelanggaran constraint."""
        await self._groups.rollback()

    async def list(
        self,
        user: UserPayload,
        *,
        q: str | None,
        category: str | None,
        only_mine: bool,
        page: int,
        page_size: int,
    ) -> GroupPage:
        """Daftar grup berhalaman sesuai akses pemanggil."""
        rows, total = await self._groups.list_page(
            user_id=_user_uuid(user),
            is_admin=_is_admin(user),
            q=q,
            category=category,
            only_mine=only_mine,
            page=page,
            page_size=page_size,
        )
        return GroupPage(
            items=[summary_from_row(row) for row in rows],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def detail(self, user: UserPayload, group_id: UUID) -> GroupDetail:
        """Detail grup; grup privat di luar keanggotaan dijawab 404."""
        row = await self.load_visible(group_id, user)
        return detail_from_row(row, user)

    async def create(self, user: UserPayload, payload: GroupCreate) -> GroupDetail:
        """Buat grup (admin saja) dan jadikan pembuatnya owner."""
        if not permissions.can_create_group(_is_admin(user)):
            raise forbidden("Hanya administrator yang dapat membuat grup komunitas.")
        if await self._groups.name_exists(payload.name):
            raise conflict("Nama grup sudah dipakai.")
        try:
            group = await self._groups.create(
                name=payload.name,
                description=payload.description,
                category=payload.category.value,
                visibility=payload.visibility.value,
                created_by=_user_uuid(user),
            )
            await self._groups.commit()
        except IntegrityError:
            # Dua admin membuat nama sama hampir bersamaan: unique index
            # `uq_chat_groups_name_lower` yang menangkapnya.
            await self._groups.rollback()
            raise conflict("Nama grup sudah dipakai.") from None
        row = await self._groups.get(group.id, user_id=_user_uuid(user))
        if row is None:  # pragma: no cover - baris baru selalu terbaca
            raise not_found_group()
        return detail_from_row(row, user)

    async def update(
        self, user: UserPayload, group_id: UUID, payload: GroupUpdate
    ) -> GroupDetail:
        """Ubah nama/deskripsi/kategori/foto profil (owner atau admin)."""
        row = await self.load_visible(group_id, user)
        if not permissions.can_manage_group(row.my_role, _is_admin(user)):
            raise forbidden("Hanya owner grup atau administrator yang dapat mengubah grup.")
        changes: dict[str, Any] = {}
        if payload.name is not None:
            if await self._groups.name_exists(payload.name, exclude_id=group_id):
                raise conflict("Nama grup sudah dipakai.")
            changes["name"] = payload.name
        if payload.description is not None:
            changes["description"] = payload.description
        if payload.category is not None:
            changes["category"] = payload.category.value
        # --- TAMBAHKAN KONDISI INI ---
        if payload.avatar_url is not None:
            changes["avatar_url"] = payload.avatar_url

        if not changes:
            raise CommunityError(422, "Tidak ada perubahan yang dikirim.")
        try:
            await self._groups.update(row.group, changes)
            await self._groups.commit()
        except IntegrityError:
            await self._groups.rollback()
            raise conflict("Nama grup sudah dipakai.") from None
        updated = await self._groups.get(group_id, user_id=_user_uuid(user))
        if updated is None:  # pragma: no cover
            raise not_found_group()
        return detail_from_row(updated, user)

    async def delete(self, user: UserPayload, group_id: UUID) -> None:
        """Hapus grup beserta pesannya (owner atau admin)."""
        row = await self.load_visible(group_id, user)
        if not permissions.can_manage_group(row.my_role, _is_admin(user)):
            raise forbidden("Hanya owner grup atau administrator yang dapat menghapus grup.")
        await self._groups.delete(group_id)
        await self._groups.commit()

    async def join(self, user: UserPayload, group_id: UUID) -> GroupDetail:
        """Gabung grup publik; idempoten (anggota yang mengulang tetap 200)."""
        row = await self.load_visible(group_id, user)
        if row.my_role is None:
            if row.group.visibility != "public":
                raise not_found_group()
            await self._members.add(group_id, _user_uuid(user), permissions.ROLE_MEMBER)
            await self._groups.commit()
        refreshed = await self._groups.get(group_id, user_id=_user_uuid(user))
        if refreshed is None:  # pragma: no cover
            raise not_found_group()
        return detail_from_row(refreshed, user)

    async def leave(self, user: UserPayload, group_id: UUID) -> None:
        """Keluar grup; owner ditolak 409 sampai kepemilikan dipindahkan."""
        user_id = _user_uuid(user)
        row = await self.load_visible(group_id, user)
        if row.my_role is None:
            raise not_found_group()
        if not permissions.can_leave(row.my_role):
            raise conflict(
                "Pemilik grup harus memindahkan kepemilikan atau menghapus grup "
                "sebelum keluar."
            )
        # Kunci baris grup agar transfer/hapus yang berjalan bersamaan menunggu.
        await self._groups.get_for_update(group_id)
        await self._members.remove(group_id, user_id)
        await self._groups.commit()
