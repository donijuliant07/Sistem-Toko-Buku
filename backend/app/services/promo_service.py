from typing import Any, Dict, List, Optional
from datetime import date

from app.core.supabase import supabase_admin
from app.schemas.promo import PromoCreate, PromoUpdate

# Kolom yang dibaca/ditulis; `discount_value` dll. returned as numeric-as-string.
_COLUMNS = (
    "id, code, name, discount_type, discount_value, min_purchase, max_discount, "
    "quota, used_count, is_active, start_date, end_date, created_at, updated_at"
)


class PromoNotFound(ValueError):
    """Promo tidak ada. Dipetakan ke 404, bukan 400, oleh layer API."""


def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
    """Ubah numeric-as-string PostgREST jadi angka, dan expose `status` turunan.

    Status tidak disimpan di DB: ia dihitung dari `is_active` + rentang tanggal,
    jadi tidak bisa basi (basi = sumber bug seperti `expires_at` di poin 5).
    """
    row = dict(row)
    for key in ("discount_value", "min_purchase", "max_discount"):
        if row.get(key) is not None:
            row[key] = float(row[key])

    today = date.today()
    start = date.fromisoformat(str(row["start_date"]))
    end = date.fromisoformat(str(row["end_date"]))
    if not row.get("is_active"):
        status = "Nonaktif"
    elif today > end:
        status = "Kadaluarsa"
    elif today < start:
        status = "Jadwal"
    else:
        status = "Aktif"
    row["status"] = status
    return row


class PromoService:
    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        """Daftar promo. Semua promo (termasuk nonaktif & terjadwal) untuk admin."""
        query = supabase_admin.table("promos").select(_COLUMNS)
        res = query.order("created_at", desc=True).execute()
        return [_serialize(row) for row in (res.data or [])]

    @staticmethod
    def get_by_id(promo_id: str) -> Optional[Dict[str, Any]]:
        res = supabase_admin.table("promos").select(_COLUMNS).eq("id", promo_id).execute()
        rows = res.data or []
        return _serialize(rows[0]) if rows else None

    @staticmethod
    def create(payload: PromoCreate) -> Dict[str, Any]:
        data = payload.model_dump(mode="json")
        res = supabase_admin.table("promos").insert(data).execute()
        if not res.data:
            raise ValueError("Promo gagal dibuat.")
        return _serialize(res.data[0])

    @staticmethod
    def update(promo_id: str, payload: PromoUpdate) -> Dict[str, Any]:
        current = PromoService.get_by_id(promo_id)
        if not current:
            raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")

        changes = payload.model_dump(mode="json", exclude_unset=True)
        if not changes:
            return current

        # Validasi rentang tanggal setelah patch, karena start/end boleh dikirim
        # salah satu saja.
        start = changes.get("start_date", current["start_date"])
        end = changes.get("end_date", current["end_date"])
        if str(end) < str(start):
            raise ValueError("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.")

        res = supabase_admin.table("promos").update(changes).eq("id", promo_id).execute()
        if not res.data:
            raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")
        return _serialize(res.data[0])

    @staticmethod
    def delete(promo_id: str) -> None:
        if not PromoService.get_by_id(promo_id):
            raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")
        supabase_admin.table("promos").delete().eq("id", promo_id).execute()


promo_service = PromoService()
