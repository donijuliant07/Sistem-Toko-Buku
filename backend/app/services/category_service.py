"""Kategori produk (`categories`).

CRUD sederhana tanpa aturan bisnis tambahan: validasi bentuk payload dilakukan
schema Pydantic (`app.schemas.category`), dan pembatasan peran admin dilakukan
di layer API (`require_admin`). Service ini hanya menerjemahkan DTO ke operasi
tabel.

Service ini mewarisi `SupabaseTableService` (`app/services/base.py`), jadi
`get_all`/`create`/`update`/`delete` tidak ditulis ulang di sini — hanya tiga
implementasi yang memang khas `categories` yang diisi: urutan (`name`), bentuk
respons (baris apa adanya), dan semantik "tidak ada" (`.single()` melempar error).
"""

from typing import Any

from app.core.supabase import supabase_admin
from app.schemas.category import CategoryCreate, CategoryUpdate
from app.services.base import SupabaseTableService


class CategoryService(SupabaseTableService):
    """Akses tabel `categories`. Mewarisi kerangka CRUD dari `SupabaseTableService`."""

    TABLE = "categories"

    # --- Implementasi kontrak abstract -------------------------------

    def _client(self) -> Any:
        """Klien PostgREST, dibaca dari global modul ini **tiap kali dipanggil**.

        Harus lookup modul, bukan disalin ke atribut instance saat `__init__`:
        pengujian mengganti `app.services.category_service.supabase_admin`, dan
        singleton `category_service` sudah terbentuk sebelum penggantian itu.
        """
        return supabase_admin

    def _order_clause(self) -> tuple[str, bool]:
        """Kategori diurutkan menurut nama, menaik."""
        return ("name", False)

    def _serialize(self, row: dict[str, Any]) -> dict[str, Any]:
        """Baris kategori dikembalikan apa adanya — tidak ada nilai turunan."""
        return row

    def get_by_id(self, category_id: str) -> dict[str, Any] | None:
        """Satu kategori; `None` bila tidak ada.

        Memakai `.single()` sehingga PostgREST melempar error ketika barisnya
        kosong — perilaku ini dipertahankan persis seperti sebelumnya.
        """
        res = self._table().select(self.COLUMNS).eq("id", category_id).single().execute()
        return res.data

    def update(self, category_id: str, payload: CategoryUpdate) -> dict[str, Any]:
        """Perubahan parsial: field yang bernilai `None` tidak ikut dikirim.

        Sengaja di-override (bukan memakai kerangka induk yang memakai
        `exclude_unset`) karena kontrak API kategori selama ini memperlakukan
        `null` sebagai "jangan ubah".
        """
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        res = self._table().update(update_data).eq("id", category_id).execute()
        return res.data[0]


category_service = CategoryService()


# Impor `CategoryCreate` dipertahankan sebagai bagian kontrak modul, meski
# pembuatan baris kini dilayani kerangka induk (`SupabaseTableService.create`).
__all__ = ["CategoryCreate", "CategoryService", "category_service"]
