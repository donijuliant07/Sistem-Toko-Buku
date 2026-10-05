from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin


class CustomerService:
    @staticmethod
    def get_list(
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        query = supabase_admin.table("profiles").select("*", count="exact").eq("role", "customer")

        if search:
            query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%,phone.ilike.%{search}%")

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        total = res.count if res.count is not None else len(res.data or [])
        customers = res.data or []

        # Enrich with total_orders & total_spent
        for c in customers:
            orders_res = (
                supabase_admin.table("orders")
                .select("total_amount")
                .eq("customer_id", c["id"])
                .neq("status", "Dibatalkan")
                .execute()
            )
            orders_data = orders_res.data or []
            c["total_orders"] = len(orders_data)
            c["total_spent"] = sum(float(o.get("total_amount", 0)) for o in orders_data)

        return customers, total


customer_service = CustomerService()
