"use client"

import * as React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyticsService, SalesDataItem } from "@/lib/services"
import { formatRupiah } from "@/lib/utils"

export function SalesChart() {
  const [period, setPeriod] = React.useState<"7d" | "30d" | "90d">("7d")
  const [data, setData] = React.useState<SalesDataItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    analyticsService.getSalesChartData(period).then((res) => {
      if (active) {
        setData(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [period])

  const totalBuku = data.reduce((acc, curr) => acc + (curr.buku || 0), 0)
  const totalNonBuku = data.reduce((acc, curr) => acc + (curr.nonBuku || 0), 0)

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-bold">Tren Penjualan Toko</CardTitle>
          <CardDescription className="text-xs">
            Perbandingan pendapatan kategori Buku vs Non-Buku
          </CardDescription>
        </div>

        {/* Toggle Range Desktop / Mobile */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {(
            [
              { label: "7 Hari", value: "7d" },
              { label: "30 Hari", value: "30d" },
              { label: "3 Bulan", value: "90d" },
            ] as const
          ).map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                setLoading(true)
                setPeriod(btn.value)
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                period === btn.value
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-blue-400"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {/* Ringkasan Angka */}
        <div className="mb-4 flex flex-wrap gap-6 text-xs">
          <div>
            <span className="text-slate-400">Total Buku: </span>
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {formatRupiah(totalBuku)}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Total Non-Buku: </span>
            <span className="font-bold text-amber-500">{formatRupiah(totalNonBuku)}</span>
          </div>
        </div>

        <div className="h-[280px] w-full">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
              Memuat data grafik...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBuku" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0052cc" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0052cc" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorNonBuku" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={(val) => `Rp${val / 1000000}jt`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900 text-xs">
                          <p className="font-bold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
                          {payload.map((item, idx) => (
                            <p key={idx} style={{ color: item.color }} className="font-semibold">
                              {item.name}: {formatRupiah(Number(item.value))}
                            </p>
                          ))}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  verticalAlign="top"
                  height={36}
                  formatter={(val) => <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{val}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="buku"
                  name="Buku & Literatur"
                  stroke="#0052cc"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorBuku)"
                />
                <Area
                  type="monotone"
                  dataKey="nonBuku"
                  name="Alat Tulis & Aksesori"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorNonBuku)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
