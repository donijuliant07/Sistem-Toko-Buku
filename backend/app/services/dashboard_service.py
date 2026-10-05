from typing import Dict, Any, List
from app.core.supabase import supabase_admin


class DashboardService:
    @staticmethod
    def get_summary() -> Dict[str, Any]:
        res = supabase_admin.rpc("dashboard_summary").execute()
        return res.data or {
            "total_omset": 0,
            "total_orders": 0,
            "total_books_sold": 0,
            "active_customers": 0,
            "low_stock_count": 0,
        }

    @staticmethod
    def get_sales_timeseries(days: int = 30) -> List[Dict[str, Any]]:
        res = supabase_admin.rpc("sales_timeseries", {"p_days": days}).execute()
        return res.data or []

    @staticmethod
    def get_category_breakdown() -> List[Dict[str, Any]]:
        # Fetch completed order items grouped by category
        res = (
            supabase_admin.table("order_items")
            .select("quantity, total_price, products(category_id, categories(name))")
            .execute()
        )
        data = res.data or []
        cat_map: Dict[str, Dict[str, Any]] = {}
        total_rev = 0.0

        for row in data:
            prod = row.get("products") or {}
            cat = prod.get("categories") or {}
            cat_name = cat.get("name", "Lainnya")

            qty = row.get("quantity", 0)
            rev = float(row.get("total_price", 0))
            total_rev += rev

            if cat_name not in cat_map:
                cat_map[cat_name] = {"category_name": cat_name, "sales_count": 0, "revenue": 0.0}

            cat_map[cat_name]["sales_count"] += qty
            cat_map[cat_name]["revenue"] += rev

        result = []
        for cat_name, val in cat_map.items():
            pct = round((val["revenue"] / total_rev * 100), 2) if total_rev > 0 else 0
            result.append({
                "category_name": cat_name,
                "sales_count": val["sales_count"],
                "revenue": val["revenue"],
                "percentage": pct,
            })

        result.sort(key=lambda x: x["revenue"], reverse=True)
        return result


dashboard_service = DashboardService()
