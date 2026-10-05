from typing import Optional, List, Dict, Any
from app.core.supabase import supabase_admin
from app.schemas.category import CategoryCreate, CategoryUpdate


class CategoryService:
    @staticmethod
    def get_all() -> List[Dict[str, Any]]:
        res = supabase_admin.table("categories").select("*").order("name").execute()
        return res.data or []

    @staticmethod
    def get_by_id(category_id: str) -> Optional[Dict[str, Any]]:
        res = supabase_admin.table("categories").select("*").eq("id", category_id).single().execute()
        return res.data

    @staticmethod
    def create(payload: CategoryCreate) -> Dict[str, Any]:
        data = payload.model_dump()
        res = supabase_admin.table("categories").insert(data).execute()
        return res.data[0]

    @staticmethod
    def update(category_id: str, payload: CategoryUpdate) -> Dict[str, Any]:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        res = supabase_admin.table("categories").update(update_data).eq("id", category_id).execute()
        return res.data[0]

    @staticmethod
    def delete(category_id: str) -> bool:
        supabase_admin.table("categories").delete().eq("id", category_id).execute()
        return True


category_service = CategoryService()
