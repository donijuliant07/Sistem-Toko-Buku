"""KPI, grafik, dan laporan untuk dashboard admin. Khusus admin.

Seluruh nilai berasal dari agregasi data nyata lewat `DashboardService`.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.security import UserPayload, require_admin
from app.schemas.common import ApiResponse
from app.schemas.dashboard import (
    CategorySalesSummary,
    DashboardKpi,
    MonthlyReportItem,
    SalesTimeseriesItem,
)
from app.services.dashboard_service import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard & Laporan"])


@router.get("/summary", response_model=ApiResponse[DashboardKpi])
async def get_dashboard_summary(
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    summary = dashboard_service.get_summary()
    return ApiResponse(
        sukses=True,
        pesan="Data ringkasan KPI dashboard berhasil dimuat.",
        data=summary,
    )


@router.get("/sales-chart", response_model=ApiResponse[list[SalesTimeseriesItem]])
async def get_sales_chart(
    days: int = Query(30, ge=7, le=90, description="Rentang hari tren penjualan"),
    current_user: Annotated[UserPayload, Depends(require_admin)] = None,
):
    series = dashboard_service.get_sales_timeseries(days=days)
    return ApiResponse(
        sukses=True,
        pesan="Data grafik penjualan berhasil dimuat.",
        data=series,
    )


@router.get("/categories-chart", response_model=ApiResponse[list[CategorySalesSummary]])
async def get_category_chart(
    current_user: Annotated[UserPayload, Depends(require_admin)],
):
    breakdown = dashboard_service.get_category_breakdown()
    return ApiResponse(
        sukses=True,
        pesan="Data proporsi penjualan kategori berhasil dimuat.",
        data=breakdown,
    )


@router.get("/reports/monthly", response_model=ApiResponse[list[MonthlyReportItem]])
async def get_monthly_reports(
    months: int = Query(4, ge=1, le=24, description="Jumlah bulan terakhir yang direkap"),
    current_user: Annotated[UserPayload, Depends(require_admin)] = None,
):
    reports = dashboard_service.get_monthly_reports(months=months)
    return ApiResponse(
        sukses=True,
        pesan="Data rekapitulasi laporan bulanan berhasil dimuat.",
        data=reports,
    )
