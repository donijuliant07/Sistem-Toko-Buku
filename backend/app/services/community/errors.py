"""Kesalahan domain Book Community.

Service tidak boleh mengimpor FastAPI: ia hanya melempar `CommunityError`
dengan status HTTP yang sudah ditentukan. Router menerjemahkannya menjadi
`HTTPException` dengan detail yang sama.

Pilihan status sengaja berbeda per situasi supaya tidak membocorkan eksistensi:

- **404** — grup tidak ada, grup privat yang belum diikuti, atau resource yang
  berada di grup lain. Pemanggil tidak bisa membedakan "tidak ada" dari
  "tidak untuk Anda".
- **403** — resource terlihat (grup publik / sudah diikuti) tetapi aksi ini
  tidak diizinkan untuk role pemanggil.
- **409** — konflik aturan (nama grup sudah dipakai, sudah anggota, owner ingin
  keluar tanpa memindahkan kepemilikan, dst).
"""

from __future__ import annotations


class CommunityError(Exception):
    """Kesalahan yang sudah dipetakan ke status HTTP."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def not_found_group() -> CommunityError:
    """Grup tidak ada atau tidak boleh diketahui pemanggil."""
    return CommunityError(404, "Grup tidak ditemukan.")


def forbidden(message: str) -> CommunityError:
    """Aksi tidak diizinkan untuk role pemanggil."""
    return CommunityError(403, message)


def conflict(message: str) -> CommunityError:
    """Konflik aturan bisnis."""
    return CommunityError(409, message)


def invalid(message: str) -> CommunityError:
    """Kursor atau parameter yang tidak valid."""
    return CommunityError(422, message)


__all__ = [
    "CommunityError",
    "conflict",
    "forbidden",
    "invalid",
    "not_found_group",
]
