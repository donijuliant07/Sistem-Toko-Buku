from typing import List
from pydantic import BaseModel, Field


class DashboardKpi(BaseModel):
    total_omset: float = Field(..., description="Total omset pendapatan kotor")
    total_orders: int = Field(..., description="Total jumlah transaksi pesanan")
    total_books_sold: int = Field(..., description="Total buku/produk terjual")
    active_customers: int = Field(..., description="Jumlah pelanggan terdaftar")
    low_stock_count: int = Field(..., description="Jumlah produk dengan stok kritis <= 5")


class SalesTimeseriesItem(BaseModel):
    date_label: str = Field(..., description="Format tanggal DD Mon")
    buku_amount: float = Field(..., description="Total penjualan produk Buku")
    non_buku_amount: float = Field(..., description="Total penjualan produk Non-Buku")
    total_amount: float = Field(..., description="Total akumulasi penjualan harian")


class CategorySalesSummary(BaseModel):
    category_name: str
    sales_count: int
    revenue: float
    percentage: float


class MonthlyReportItem(BaseModel):
    month: str
    orders: int
    revenue: float
    best_category: str
    growth: str
