from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin
from app.schemas.inventory import StockAdjustmentRequest


class InventoryService:
    @staticmethod
    def get_movements(
        page: int = 1,
        limit: int = 10,
        product_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        query = supabase_admin.table("stock_movements").select("*, products(title)", count="exact")

        if product_id:
            query = query.eq("product_id", product_id)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        total = res.count if res.count is not None else len(res.data or [])
        movements = res.data or []
        for m in movements:
            if m.get("products"):
                m["product_title"] = m["products"].get("title")

        return movements, total

    @staticmethod
    def adjust_stock(payload: StockAdjustmentRequest, user_id: str) -> Dict[str, Any]:
        res = supabase_admin.rpc(
            "adjust_stock",
            {
                "p_product_id": payload.product_id,
                "p_quantity": payload.quantity,
                "p_type": payload.type,
                "p_reason": payload.reason,
                "p_reference_id": payload.reference_id,
                "p_user_id": user_id,
            },
        ).execute()
        return res.data

    @staticmethod
    def get_low_stock_products() -> List[Dict[str, Any]]:
        res = supabase_admin.table("low_stock_products").select("*").execute()
        return res.data or []


inventory_service = InventoryService()
