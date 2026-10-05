from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin
from app.schemas.product import ProductCreate, ProductUpdate


class ProductService:
    @staticmethod
    def get_list(
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        category_id: Optional[str] = None,
        product_type: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        query = supabase_admin.table("products").select("*, category:categories(*)", count="exact")

        if search:
            query = query.or_(f"title.ilike.%{search}%,author.ilike.%{search}%,isbn.ilike.%{search}%")
        if category_id:
            query = query.eq("category_id", category_id)
        if product_type:
            query = query.eq("type", product_type)
        if status:
            query = query.eq("status", status)

        descending = sort_order.lower() == "desc"
        query = query.order(sort_by, desc=descending).range(offset, offset + limit - 1)
        res = query.execute()

        total = res.count if res.count is not None else len(res.data or [])
        return res.data or [], total

    @staticmethod
    def get_by_id(product_id: str) -> Optional[Dict[str, Any]]:
        res = supabase_admin.table("products").select("*, category:categories(*)").eq("id", product_id).single().execute()
        return res.data

    @staticmethod
    def create(payload: ProductCreate) -> Dict[str, Any]:
        data = payload.model_dump()
        res = supabase_admin.table("products").insert(data).execute()
        return res.data[0]

    @staticmethod
    def update(product_id: str, payload: ProductUpdate) -> Dict[str, Any]:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        res = supabase_admin.table("products").update(update_data).eq("id", product_id).execute()
        return res.data[0]

    @staticmethod
    def delete(product_id: str) -> bool:
        supabase_admin.table("products").delete().eq("id", product_id).execute()
        return True


product_service = ProductService()
