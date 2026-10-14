"""Agregasi data dashboard dan laporan admin.

RPC `dashboard_summary`, `sales_timeseries`, dan view rekap tidak ada di
database live, jadi seluruh agregasi dihitung di Python dari tabel `orders`,
`order_items`, `books`, dan `profiles`. Nilai yang dibaca selalu dari data
nyata; tidak ada angka contoh yang disajikan sebagai laporan.

Service ini mewarisi `ReportService` (`app/services/base.py`), yang memusatkan
satu aturan lintas-laporan: pesanan berstatus `cancelled` tidak pernah dihitung
sebagai penjualan. Method publiknya sengaja tetap `@staticmethod` karena
laporan tidak menyimpan state — yang diwarisi adalah **kontrak dan aturan**,
bukan state.
"""

from datetime import date, timedelta
from typing import Any

from app.core.supabase import supabase_admin
from app.services.base import ReportService

# Nama bulan Indonesia; sengaja tidak bergantung pada locale sistem.
_MONTH_NAMES_ID = (
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
)

# Ambang stok kritis, selaras `InventoryService.get_low_stock_products`.
_LOW_STOCK_THRESHOLD = 5


class DashboardService(ReportService):
    """Agregasi KPI, tren penjualan, proporsi kategori, dan rekap bulanan."""

    @staticmethod
    def get_summary() -> dict[str, Any]:
        # RPC `dashboard_summary` tidak ada di database live, jadi agregasi
        # dihitung dari `orders` + `order_items` + `books`.
        orders = supabase_admin.table("orders").select("id, status, total").execute().data or []
        items = supabase_admin.table("order_items").select("order_id, quantity, price").execute().data or []
        low_stock = (
            supabase_admin.table("books").select("id").lte("stock", _LOW_STOCK_THRESHOLD).execute().data or []
        )
        customers = supabase_admin.table("profiles").select("id").eq("role", "user").execute().data or []

        # Aturan «pesanan batal bukan penjualan» diwarisi dari `ReportService`,
        # jadi hanya ada di satu tempat (lihat `_is_revenue_order`).
        active_orders = [row for row in orders if ReportService._is_revenue_order(row)]
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
    def get_sales_timeseries(days: int = 30) -> list[dict[str, Any]]:
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

        per_day: dict[str, float] = {}
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
    def get_category_breakdown() -> list[dict[str, Any]]:
        """Proporsi penjualan per kategori, diurutkan dari pendapatan terbesar."""
        res = (
            supabase_admin.table("order_items")
            .select("quantity, price, books(category_id, categories(name))")
            .execute()
        )
        data = res.data or []
        cat_map: dict[str, dict[str, Any]] = {}
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

    @staticmethod
    def get_monthly_reports(months: int = 4) -> list[dict[str, Any]]:
        """Rekap penjualan per bulan dari `orders` + `order_items` + `categories`.

        Satu bulan tambahan sebelum rentang ikut diambil supaya bulan tertua
        yang ditampilkan tetap punya pembanding untuk kolom `growth`. Bila
        pembandingnya tidak ada atau nol, `growth` dikosongkan ("-") alih-alih
        mengarang angka.
        """
        today = date.today()

        def month_start(offset: int) -> date:
            """Awal bulan `offset` bulan sebelum bulan berjalan (0 = bulan ini)."""
            index = (today.year * 12 + today.month - 1) - offset
            return date(index // 12, index % 12 + 1, 1)

        rows = (
            supabase_admin.table("orders")
            .select(
                "created_at, status, total, "
                "items:order_items(quantity, price, books(categories(name)))"
            )
            .gte("created_at", month_start(months).isoformat())
            .execute()
            .data
            or []
        )

        order_counts: dict[str, int] = {}
        revenue: dict[str, float] = {}
        category_revenue: dict[str, dict[str, float]] = {}

        for row in rows:
            # Pesanan batal tidak pernah dihitung sebagai penjualan (aturan diwarisi).
            if not ReportService._is_revenue_order(row):
                continue
            created = str(row.get("created_at") or "")
            if len(created) < 7:
                continue

            key = created[:7]  # YYYY-MM
            order_counts[key] = order_counts.get(key, 0) + 1
            revenue[key] = revenue.get(key, 0.0) + float(row.get("total") or 0)

            per_category = category_revenue.setdefault(key, {})
            for item in row.get("items") or []:
                category = ((item.get("books") or {}).get("categories") or {}).get("name") or "Lainnya"
                amount = float(item.get("price") or 0) * int(item.get("quantity") or 0)
                per_category[category] = per_category.get(category, 0.0) + amount

        reports: list[dict[str, Any]] = []
        for offset in range(months - 1, -1, -1):
            start = month_start(offset)
            key = start.strftime("%Y-%m")
            current = revenue.get(key, 0.0)
            previous = revenue.get(month_start(offset + 1).strftime("%Y-%m"), 0.0)

            if previous > 0:
                growth_label = f"{(current - previous) / previous * 100:+.1f}%"
            else:
                growth_label = "-"

            per_category = category_revenue.get(key) or {}
            reports.append({
                "month": f"{_MONTH_NAMES_ID[start.month - 1]} {start.year}",
                "orders": order_counts.get(key, 0),
                "revenue": round(current, 2),
                "best_category": max(per_category, key=per_category.get) if per_category else "-",
                "growth": growth_label,
            })

        return reports


dashboard_service = DashboardService()
