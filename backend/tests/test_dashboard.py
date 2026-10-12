"""Regresi untuk laporan bulanan dashboard (agregasi nyata, bukan data contoh).

`supabase_admin` di-mock, jadi tes ini tidak menyentuh database nyata. Yang
diuji adalah perhitungan di `DashboardService.get_monthly_reports`: pesanan
batal dikecualikan, kategori terlaris dipilih dari item nyata, dan `growth`
tidak dikarang ketika bulan pembanding tidak punya pendapatan.
"""

from unittest.mock import MagicMock, patch

from app.services.dashboard_service import DashboardService


def build_admin(order_rows):
    """Mock `supabase_admin` untuk rantai `orders.select(...).gte(...).execute()`."""
    orders_table = MagicMock()
    orders_table.select.return_value.gte.return_value.execute.return_value.data = order_rows
    admin = MagicMock()
    admin.table.side_effect = lambda name: {"orders": orders_table}[name]
    return admin


def order(created_at, total, status="paid", items=None):
    return {
        "created_at": created_at,
        "status": status,
        "total": total,
        "items": items or [],
    }


def item(price, quantity, category):
    return {"price": price, "quantity": quantity, "books": {"categories": {"name": category}}}


def test_monthly_reports_are_derived_from_real_orders():
    rows = [
        order(
            "2026-09-10T09:00:00+00:00",
            100000,
            items=[item(50000, 2, "Fiksi")],
        ),
        order(
            "2026-10-05T09:00:00+00:00",
            300000,
            items=[item(150000, 2, "Non-Fiksi")],
        ),
    ]

    with patch("app.services.dashboard_service.supabase_admin", build_admin(rows)):
        reports = DashboardService.get_monthly_reports(months=2)

    assert [r["orders"] for r in reports] == [1, 1]
    assert reports[0]["revenue"] == 100000
    assert reports[1]["revenue"] == 300000
    assert reports[1]["best_category"] == "Non-Fiksi"
    # 300000 vs 100000 sebelumnya → +200.0%.
    assert reports[1]["growth"] == "+200.0%"


def test_monthly_reports_skip_cancelled_orders():
    """Pesanan batal tidak pernah dihitung sebagai penjualan."""
    rows = [order("2026-10-01T00:00:00+00:00", 999999, status="cancelled")]

    with patch("app.services.dashboard_service.supabase_admin", build_admin(rows)):
        reports = DashboardService.get_monthly_reports(months=1)

    assert reports[0]["orders"] == 0
    assert reports[0]["revenue"] == 0


def test_monthly_reports_leave_growth_blank_without_a_baseline():
    """Tanpa pendapatan bulan sebelumnya, `growth` dikosongkan, bukan dikarang."""
    rows = [order("2026-10-02T00:00:00+00:00", 50000)]

    with patch("app.services.dashboard_service.supabase_admin", build_admin(rows)):
        reports = DashboardService.get_monthly_reports(months=1)

    assert reports[0]["growth"] == "-"


def test_monthly_reports_returns_one_entry_per_requested_month():
    with patch("app.services.dashboard_service.supabase_admin", build_admin([])):
        reports = DashboardService.get_monthly_reports(months=3)

    assert len(reports) == 3
    assert all(r["revenue"] == 0 and r["best_category"] == "-" for r in reports)
