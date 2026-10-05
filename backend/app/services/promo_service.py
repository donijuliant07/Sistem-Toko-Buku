from typing import Optional, Dict, Any, List
from app.core.supabase import supabase_admin
from app.schemas.promo import PromoCreate, PromoUpdate


class PromoService:
    @staticmethod
    def get_all(status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        query = supabase_admin.table("promos").select("*")
        if status_filter:
            query = query.eq("status", status_filter)
        res = query.order("created_at", desc=True).execute()
        return res.data or []

    @staticmethod
    def get_by_code(code: str) -> Optional[Dict[str, Any]]:
        res = supabase_admin.table("promos").select("*").ilike("code", code).single().execute()
        return res.data

    @staticmethod
    def create(payload: PromoCreate) -> Dict[str, Any]:
        data = payload.model_dump()
        if isinstance(data.get("start_date"), str):
            data["start_date"] = data["start_date"]
        if isinstance(data.get("end_date"), str):
            data["end_date"] = data["end_date"]
        res = supabase_admin.table("promos").insert(data).execute()
        return res.data[0]

    @staticmethod
    def update(promo_id: str, payload: PromoUpdate) -> Dict[str, Any]:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        res = supabase_admin.table("promos").update(update_data).eq("id", promo_id).execute()
        return res.data[0]

    @staticmethod
    def toggle_status(promo_id: str, is_active: bool) -> Dict[str, Any]:
        new_status = "Aktif" if is_active else "Nonaktif"
        res = supabase_admin.table("promos").update({"status": new_status}).eq("id", promo_id).execute()
        return res.data[0]


promo_service = PromoService()
