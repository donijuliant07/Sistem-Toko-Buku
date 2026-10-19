"""Voucher dan diskon (`promos`).

Status promo (`Aktif`/`Jadwal`/`Kadaluarsa`/`Nonaktif`) tidak pernah disimpan di
database: nilainya diturunkan dari `is_active` + rentang tanggal setiap kali
dibaca, supaya tidak bisa basi. `PromoNotFound` dibedakan dari `ValueError`
biasa agar layer API dapat memetakan 404 terpisah dari 400.

Service ini mewarisi `SupabaseTableService` (`app/services/base.py`) dan
meng-**override** `update` serta menitipkan pemeriksaan pada hook
`_before_delete()`. Keduanya tetap memanggil `super()`, jadi kerangka tulis/hapus
tetap satu sumber.
"""

from datetime import date
from typing import Any

from app.core.clock import store_today
from app.core.supabase import supabase_admin
from app.schemas.promo import PromoCreate, PromoUpdate
from app.services.base import SupabaseTableService

# Kolom yang dibaca/ditulis. PostgREST mengembalikan kolom numeric sebagai
# string, sehingga `PromoView` mengubahnya kembali menjadi float.
_COLUMNS = (
    "id, code, name, discount_type, discount_value, min_purchase, max_discount, "
    "quota, used_count, is_active, start_date, end_date, created_at, updated_at"
)

#: Kolom numeric yang harus diubah dari string PostgREST menjadi float.
_NUMERIC_FIELDS = ("discount_value", "min_purchase", "max_discount")


class PromoNotFound(ValueError):
    """Promo tidak ada. Dipetakan ke 404, bukan 400, oleh layer API."""


class PromoView:
    """Pandangan domain atas satu baris `promos`.

    Baris mentah disimpan sebagai atribut **private** (name-mangled), jadi hanya
    nilai yang memang boleh keluar — lewat `status` dan `to_dict()` — yang bisa
    dibaca pihak lain. Ini memindahkan logika turunan dari fungsi `_serialize`
    (yang dulu hanya melewatkan dict) ke objek yang memang memiliki datanya.
    """

    def __init__(self, row: dict[str, Any]) -> None:
        self.__row = dict(row)

    @property
    def status(self) -> str:
        """Status promo — diturunkan, tidak pernah disimpan.

        Urutannya penting: `Nonaktif` menang atas rentang tanggal, jadi promo
        yang dimatikan tetap terbaca `Nonaktif` meski tanggalnya masih berjalan.
        """
        if not self.__row.get("is_active"):
            return "Nonaktif"
        today = store_today()
        if today > date.fromisoformat(str(self.__row["end_date"])):
            return "Kadaluarsa"
        if today < date.fromisoformat(str(self.__row["start_date"])):
            return "Jadwal"
        return "Aktif"

    def to_dict(self) -> dict[str, Any]:
        """Bentuk respons: numeric-as-string jadi angka, plus `status` turunan."""
        row = dict(self.__row)
        for key in _NUMERIC_FIELDS:
            if row.get(key) is not None:
                row[key] = float(row[key])
        row["status"] = self.status
        return row


def _serialize(row: dict[str, Any]) -> dict[str, Any]:
    """Bentuk respons promo.

    Fungsi level-modul ini dipertahankan (bukan dihapus) karena tes lama
    mengimpornya langsung: `tests/test_promos.py`. Isinya kini mendelegasikan ke
    `PromoView`, sehingga tetap ada satu sumber kebenaran bentuk respons.
    """
    return PromoView(row).to_dict()


class PromoService(SupabaseTableService):
    """Akses tabel `promos`. Mewarisi kerangka CRUD dari `SupabaseTableService`."""

    TABLE = "promos"
    COLUMNS = _COLUMNS
    CREATE_FAILED_MESSAGE = "Promo gagal dibuat."

    # --- Implementasi kontrak abstract -------------------------------

    def _client(self) -> Any:
        """Klien PostgREST, dibaca dari global modul ini **tiap kali dipanggil**.

        Harus lookup modul, bukan disalin ke atribut instance saat `__init__`:
        pengujian mengganti `app.services.promo_service.supabase_admin`, dan
        singleton `promo_service` sudah terbentuk sebelum penggantian itu.
        """
        return supabase_admin

    def _order_clause(self) -> tuple[str, bool]:
        """Promo terbaru lebih dulu."""
        return ("created_at", True)

    def _serialize(self, row: dict[str, Any]) -> dict[str, Any]:
        """Delegasikan ke `PromoView` — numeric jadi float, tambah `status`."""
        return PromoView(row).to_dict()

    def get_by_id(self, promo_id: str) -> dict[str, Any] | None:
        """Satu promo; `None` bila tidak ada.

        Berbeda dari kategori: di sini baris kosong **bukan** error, melainkan
        mengembalikan `None`. Itulah sebabnya method ini abstract di induk.
        """
        res = self._table().select(self.COLUMNS).eq("id", promo_id).execute()
        rows = res.data or []
        return self._serialize(rows[0]) if rows else None

    # --- Override + super() -------------------------------------------

    def update(self, promo_id: str, payload: PromoUpdate) -> dict[str, Any]:
        """Perbarui promo, dengan validasi rentang tanggal setelah patch.

        Override ini menambah aturan bisnis **di atas** kerangka induk, lalu
        menyerahkan penulisan ke `super().update(...)`. Karena `start`/`end`
        boleh dikirim salah satu saja, validasinya memakai gabungan nilai lama
        dan patch.
        """
        current = self.get_by_id(promo_id)
        if not current:
            raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")

        changes = payload.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return current

        start = changes.get("start_date", current["start_date"])
        end = changes.get("end_date", current["end_date"])
        if str(end) < str(start):
            raise ValueError("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.")

        return super().update(promo_id, payload)

    def _before_delete(self, promo_id: str) -> None:
        """Hook dari induk: promo yang tidak ada tidak boleh dihapus diam-diam."""
        if not self.get_by_id(promo_id):
            raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")


promo_service = PromoService()


__all__ = [
    "PromoCreate",
    "PromoNotFound",
    "PromoService",
    "PromoUpdate",
    "PromoView",
    "promo_service",
]
