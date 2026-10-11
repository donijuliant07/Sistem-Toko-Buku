from typing import Dict, Any, List
from datetime import date, timedelta
from app.core.supabase import supabase_admin


class DashboardService:
    @staticmethod
    def get_summary() -> Dict[str, Any]:
        # RPC `dashboard_summary` tidak ada di database live, jadi agregasi
        # dihitung dari `orders` + `order_items` + `books`.
        orders = supabase_admin.table("orders").select("id, status, total").execute().data or []
        items = supabase_admin.table("order_items").select("order_id, quantity, price").execute().data or []
        low_stock = supabase_admin.table("books").select("id").lte("stock", 5).execute().data or []
        customers = supabase_admin.table("profiles").select("id").eq("role", "user").execute().data or []

        # `cancelled` adalah nilai yang diterima CHECK constraint database live
        # (`orders_status_check`); "dibatalkan" tidak pernah tersimpan.
        active_orders = [row for row in orders if row.get("status") != "cancelled"]
        active_ids = {row["id"] for row in active_orders}
        sold_items = [item for item in items if item.get("order_id") in active_ids]

        return {
            "total_omset": sum(float(row.get("total") or 0) for row in active_orders),
            "total_orders": len(active_orders),
            "total_books_sold": sum(int(item.get("quantity") or 0) for item in sold_items),
            "active_customers": len(customers),
            "low_stock_count": len(low_stock),
        }

    @staticmethod
    def get_sales_timeseries(days: int = 30) -> List[Dict[str, Any]]:
        # RPC `sales_timeseries` tidak ada di database live.
        since = (date.today() - timedelta(days=days - 1)).isoformat()
        orders = (
            supabase_admin.table("orders")
            .select("created_at, status, items:order_items(quantity, price)")
            .gte("created_at", since)
            .execute()
            .data
            or []
        )

        per_day: Dict[str, float] = {}
        for row in orders:
            if row.get("status") == "cancelled":
                continue
            label = str(row.get("created_at", ""))[:10]
            amount = sum(
                float(item.get("price") or 0) * int(item.get("quantity") or 0)
                for item in (row.get("items") or [])
            )
            per_day[label] = per_day.get(label, 0.0) + amount

        series = []
        for offset in range(days):
            day = date.today() - timedelta(days=days - 1 - offset)
            amount = per_day.get(day.isoformat(), 0.0)
            series.append({
                "date_label": day.strftime("%d %b"),
                # Skema live tidak menandai jenis produk per item; seluruh
                # penjualan dilaporkan pada kolom buku.
                "buku_amount": amount,
                "non_buku_amount": 0.0,
                "total_amount": amount,
            })
        return series

    @staticmethod
    def get_category_breakdown() -> List[Dict[str, Any]]:
        # Fetch completed order items grouped by category
        res = (
            supabase_admin.table("order_items")
            .select("quantity, price, books(category_id, categories(name))")
            .execute()
        )
        data = res.data or []
        cat_map: Dict[str, Dict[str, Any]] = {}
        total_rev = 0.0

        for row in data:
            prod = row.get("books") or {}
            cat = prod.get("categories") or {}
            cat_name = cat.get("name", "Lainnya")

            qty = row.get("quantity", 0)
            rev = float(row.get("price", 0)) * qty
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
