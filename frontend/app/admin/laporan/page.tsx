"use client"

import * as React from "react"
import { Download, FileSpreadsheet, TrendingUp, Calendar } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SalesChart } from "@/components/admin/dashboard/SalesChart"
import { CategoryChart } from "@/components/admin/dashboard/CategoryChart"
import { formatRupiah } from "@/lib/utils"
import { toast } from "sonner"

const monthlyReports = [
  { month: "Oktober 2026", orders: 124, revenue: 117200000, bestCategory: "Fiksi", growth: "+14.2%" },
  { month: "September 2026", orders: 110, revenue: 104000000, bestCategory: "Pengembangan Diri", growth: "+9.8%" },
  { month: "Agustus 2026", orders: 98, revenue: 89900000, bestCategory: "Pendidikan & SNBT", growth: "+6.5%" },
  { month: "Juli 2026", orders: 92, revenue: 84300000, bestCategory: "Komik & Graphic Novel", growth: "+4.1%" },
]

export default function AdminReportsPage() {
  const handleExportCSV = (month: string) => {
    toast.success(`Mengunduh file laporan keuangan CSV untuk periode ${month}...`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Penjualan & Performa"
        description="Analisis komprehensif performa pendapatan, volume pesanan, dan tren kategori."
        action={
          <Button
            size="sm"
            onClick={() => handleExportCSV("Semua Periode")}
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor Semua (CSV)</span>
          </Button>
        }
      />

      {/* Visual Analytics */}
      <SalesChart />

      <div className="grid gap-6 md:grid-cols-2">
        <CategoryChart />

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold">Ringkasan Omset Bulanan</CardTitle>
            <CardDescription className="text-xs">
              Histori pendapatan bruto dan pertumbuhan volume order per bulan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Bulan</TableHead>
                  <TableHead className="font-semibold">Pesanan</TableHead>
                  <TableHead className="font-semibold">Pendapatan</TableHead>
                  <TableHead className="font-semibold">Pertumbuhan</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReports.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {row.month}
                    </TableCell>
                    <TableCell className="text-xs">{row.orders} trx</TableCell>
                    <TableCell className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {formatRupiah(row.revenue)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-emerald-600">
                      {row.growth}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600"
                        onClick={() => handleExportCSV(row.month)}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>CSV</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
