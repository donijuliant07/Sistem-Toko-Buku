from typing import Annotated, List
from fastapi import APIRouter, Depends, Query
from app.core.security import require_staff_or_admin, UserPayload
from app.schemas.common import ApiResponse
from app.schemas.dashboard import DashboardKpi, SalesTimeseriesItem, CategorySalesSummary, MonthlyReportItem
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Laporan"])


@router.get("/summary", response_model=ApiResponse[DashboardKpi])
async def get_dashboard_summary(
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    summary = dashboard_service.get_summary()
    return ApiResponse(
        sukses=True,
        pesan="Data ringkasan KPI dashboard berhasil dimuat.",
        data=summary,
    )


@router.get("/sales-chart", response_model=ApiResponse[List[SalesTimeseriesItem]])
async def get_sales_chart(
    days: int = Query(30, ge=7, le=90, description="Rentang hari tren penjualan"),
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)] = None,
):
    series = dashboard_service.get_sales_timeseries(days=days)
    return ApiResponse(
        sukses=True,
        pesan="Data grafik penjualan berhasil dimuat.",
        data=series,
    )


@router.get("/categories-chart", response_model=ApiResponse[List[CategorySalesSummary]])
async def get_category_chart(
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    breakdown = dashboard_service.get_category_breakdown()
    return ApiResponse(
        sukses=True,
        pesan="Data proporsi penjualan kategori berhasil dimuat.",
        data=breakdown,
    )


@router.get("/reports/monthly", response_model=ApiResponse[List[MonthlyReportItem]])
async def get_monthly_reports(
    current_user: Annotated[UserPayload, Depends(require_staff_or_admin)],
):
    # Historical monthly reports
    reports = [
        {"month": "Oktober 2026", "orders": 124, "revenue": 117200000.0, "best_category": "Fiksi", "growth": "+14.2%"},
        {"month": "September 2026", "orders": 110, "revenue": 104000000.0, "best_category": "Pengembangan Diri", "growth": "+9.8%"},
        {"month": "Agustus 2026", "orders": 98, "revenue": 89900000.0, "best_category": "Pendidikan & Referensi", "growth": "+6.5%"},
        {"month": "Juli 2026", "orders": 92, "revenue": 84300000.0, "best_category": "Komik & Graphic Novel", "growth": "+4.1%"},
    ]
    return ApiResponse(
        sukses=True,
        pesan="Data rekapitulasi laporan bulanan berhasil dimuat.",
        data=reports,
    )
