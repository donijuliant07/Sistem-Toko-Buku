"use client"

import * as React from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SalesChart } from "@/components/admin/dashboard/SalesChart"
import { CategoryChart } from "@/components/admin/dashboard/CategoryChart"
import { getMonthlyReports } from "@/lib/api"
import type { MonthlyReportItem } from "@/lib/types"
import { formatRupiah } from "@/lib/utils"
import { toast } from "sonner"

/** CSV satu baris per bulan; sengaja minimal supaya Excel/Sheets bisa membukanya. */
function toCsv(rows: MonthlyReportItem[]): string {
  const header = ["Bulan", "Pesanan", "Pendapatan", "Kategori Terlaris", "Pertumbuhan"]
  const lines = rows.map((row) =>
    [row.month, row.orders, row.revenue, row.best_category, row.growth]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(",")
  )
  return [header.join(","), ...lines].join("\r\n")
}

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState<MonthlyReportItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    getMonthlyReports(4)
      .then((rows) => {
        if (active) setReports(rows)
      })
      .catch((error: unknown) => {
        console.error("Gagal memuat laporan bulanan", error)
        if (active) {
          toast.error("Gagal memuat laporan penjualan.")
          setReports([])
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleExportCSV = () => {
    if (reports.length === 0) {
      toast.error("Belum ada data laporan untuk diekspor.")
      return
    }
    // BOM membuat Excel di Windows membaca UTF-8 dengan benar.
    const blob = new Blob(["﻿" + toCsv(reports)], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `laporan-penjualan-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Laporan penjualan diunduh sebagai CSV.")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Penjualan & Performa"
        description="Analisis komprehensif performa pendapatan, volume pesanan, dan tren kategori."
        action={
          <Button
            size="sm"
            onClick={handleExportCSV}
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-zinc-400 py-6">
                      Memuat laporan...
                    </TableCell>
                  </TableRow>
                ) : reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-xs text-zinc-400 py-6">
                      Belum ada pesanan tercatat pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((row) => (
                  <TableRow key={row.month} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                    <TableCell className="font-semibold text-xs text-zinc-900">
                      {row.month}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-600">{row.orders} trx</TableCell>
                    <TableCell className="text-xs font-bold text-zinc-900 tabular-nums">
                      {formatRupiah(row.revenue)}
                    </TableCell>
                    <TableCell
                      className={`text-xs font-semibold ${
                        row.growth === "-"
                          ? "text-zinc-400"
                          : row.growth.startsWith("-")
                            ? "text-rose-600"
                            : "text-emerald-600"
                      }`}
                    >
                      {row.growth}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg cursor-pointer"
                        onClick={handleExportCSV}
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>CSV</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
