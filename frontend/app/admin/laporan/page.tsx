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
            className="gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-xl cursor-pointer"
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

        <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs overflow-hidden">
          <CardHeader className="p-5 border-b border-zinc-100">
            <CardTitle className="text-base font-bold tracking-tight text-zinc-900">Ringkasan Omset Bulanan</CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Histori pendapatan bruto dan pertumbuhan volume order per bulan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-zinc-50/75">
                <TableRow className="border-b border-zinc-200/80 hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-zinc-600">Bulan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Pesanan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Pendapatan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Pertumbuhan</TableHead>
                  <TableHead className="text-right font-semibold text-xs text-zinc-600">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReports.map((row, idx) => (
                  <TableRow key={idx} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                    <TableCell className="font-semibold text-xs text-zinc-900">
                      {row.month}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">{row.orders} trx</TableCell>
                    <TableCell className="text-xs font-bold text-zinc-900 tabular-nums">
                      {formatRupiah(row.revenue)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-emerald-600">
                      {row.growth}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg cursor-pointer"
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
