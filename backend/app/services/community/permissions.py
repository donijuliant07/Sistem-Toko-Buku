"""Matriks izin Book Community — murni, tanpa I/O.

Semua keputusan "boleh/tidak" ada di sini supaya bisa diuji sebagai tabel
kebenaran, terpisah dari SQL dan HTTP. Service memanggil fungsi-fungsi ini
**sebelum** menyentuh repository; router tidak pernah memutuskan izin.

Dua lapis role yang tidak boleh tercampur:

- **Role global** (`profiles.role`) — `admin` boleh membuat grup, melihat semua
  grup, menghapus grup, dan menghapus pesan. Admin **tidak** otomatis menjadi
  anggota: untuk mengirim pesan ia harus bergabung seperti pengguna lain.
- **Role grup** (`chat_group_members.role`) — `owner` / `moderator` / `member`
  menentukan aksi di dalam satu grup.

Ringkas:

| Aksi | member | moderator | owner | admin global |
|---|---|---|---|---|
| lihat grup/pesan | ✓ | ✓ | ✓ | ✓ |
| kirim pesan | ✓ | ✓ | ✓ | hanya jika anggota |
| hapus pesan sendiri | ✓ | ✓ | ✓ | ✓ |
| hapus pesan orang lain | — | ✓ | ✓ | ✓ |
| tambah anggota | — | ✓ (hanya `member`) | ✓ | — |
| keluarkan anggota | — | hanya `member` | ✓ (kecuali owner) | — |
| ubah role | — | — | ✓ | — |
| transfer owner | — | — | ✓ | — |
| ubah/hapus grup | — | — | ✓ | ✓ |
| keluar grup | ✓ | ✓ | ✗ (409) | — |
"""

from __future__ import annotations

ROLE_OWNER = "owner"
ROLE_MODERATOR = "moderator"
ROLE_MEMBER = "member"


def can_create_group(is_admin: bool) -> bool:
    """Hanya admin global yang membuat grup (keputusan produk)."""
    return is_admin


def can_view_group(visibility: str, my_role: str | None, is_admin: bool) -> bool:
    """Grup publik terlihat semua pengguna login; privat hanya anggota/admin."""
    return visibility == "public" or my_role is not None or is_admin


def can_read_messages(my_role: str | None, is_admin: bool) -> bool:
    """Riwayat pesan hanya untuk anggota (dan admin untuk moderasi)."""
    return my_role is not None or is_admin


def can_send(my_role: str | None) -> bool:
    """Mengirim pesan hanya sebagai anggota — admin tanpa keanggotaan ditolak."""
    return my_role is not None


def can_manage_group(my_role: str | None, is_admin: bool) -> bool:
    """Ubah metadata atau hapus grup: owner atau admin global."""
    return is_admin or my_role == ROLE_OWNER


def can_manage_members(my_role: str | None) -> bool:
    """Buka daftar anggota dan tambah/keluarkan anggota: owner atau moderator."""
    return my_role in (ROLE_OWNER, ROLE_MODERATOR)


def can_add_with_role(my_role: str | None, new_role: str) -> bool:
    """Moderator hanya boleh menambah `member`; owner boleh menambah moderator."""
    if new_role == ROLE_MODERATOR:
        return my_role == ROLE_OWNER
    return my_role in (ROLE_OWNER, ROLE_MODERATOR)


def can_remove_member(my_role: str | None, target_role: str) -> bool:
    """Owner mengeluarkan siapa pun selain owner; moderator hanya `member`."""
    if target_role == ROLE_OWNER:
        return False
    if my_role == ROLE_OWNER:
        return True
    return my_role == ROLE_MODERATOR and target_role == ROLE_MEMBER


def can_change_role(my_role: str | None, target_role: str, new_role: str) -> bool:
    """Ubah role hanya oleh owner; baris owner tidak diubah (pakai transfer)."""
    return (
        my_role == ROLE_OWNER
        and target_role != ROLE_OWNER
        and new_role in (ROLE_MODERATOR, ROLE_MEMBER)
    )


def can_transfer_owner(my_role: str | None) -> bool:
    """Hanya owner yang boleh memindahkan kepemilikan."""
    return my_role == ROLE_OWNER


def can_leave(my_role: str | None) -> bool:
    """Owner harus memindahkan kepemilikan atau menghapus grup lebih dulu."""
    return my_role is not None and my_role != ROLE_OWNER


def can_delete_message(
    my_role: str | None, is_admin: bool, is_sender: bool
) -> bool:
    """Pengirim selalu boleh; moderator/owner/admin boleh menghapus pesan lain."""
    return (
        is_sender
        or is_admin
        or my_role in (ROLE_OWNER, ROLE_MODERATOR)
    )
