"use client"

import * as React from "react"
import { PageHeader } from "@/components/admin/PageHeader"
import { SectionCards } from "@/components/admin/dashboard/SectionCards"
import { SalesChart } from "@/components/admin/dashboard/SalesChart"
import { CategoryChart } from "@/components/admin/dashboard/CategoryChart"
import { LowStockCard } from "@/components/admin/dashboard/LowStockCard"
import { RecentOrdersTable } from "@/components/admin/dashboard/RecentOrdersTable"
import { analyticsService } from "@/lib/services"
import { KPICardData } from "@/types"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function DashboardPage() {
  const [kpiData, setKpiData] = React.useState<KPICardData[]>([])
  const [loading, setLoading] = React.useState(true)

  const fetchKpi = React.useCallback(async () => {
    try {
      const res = await analyticsService.getKPIData()
      setKpiData(res)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let active = true
    analyticsService.getKPIData().then((res) => {
      if (active) {
        setKpiData(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleRefresh = () => {
    setLoading(true)
    fetchKpi().then(() => {
      toast.success("Data dashboard diperbarui")
    })
  }

  const handleExportSummary = () => {
    toast.info("Mengunduh ringkasan eksekutif PDF...")
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman Dashboard */}
      <PageHeader
        title="Dashboard Penjualan"
        description="Pantau performa pendapatan, pesanan harian, dan inventori buku Anda."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Segarkan</span>
            </Button>
            <Button
              size="sm"
              onClick={handleExportSummary}
              className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor Ringkasan</span>
            </Button>
          </div>
        }
      />

      {/* 1. Section 4 KPI Cards */}
      <SectionCards data={kpiData} loading={loading} />

      {/* 2. Interactive Sales Area Chart */}
      <SalesChart />

      {/* 3. Baris Kedua: Grid 2 Kolom (Category Chart & Low Stock Warning) */}
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryChart />
        <LowStockCard />
      </div>

      {/* 4. Data Table Pesanan Terbaru */}
      <RecentOrdersTable />
    </div>
  )
}
