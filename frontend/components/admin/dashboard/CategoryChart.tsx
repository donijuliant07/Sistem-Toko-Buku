"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCategorySales } from "@/lib/api"

type CategoryPoint = { category: string; sales: number }

const colors = ["#18181B", "#2563EB", "#10B981", "#3B82F6", "#8B5CF6", "#64748B"]

export function CategoryChart() {
  const [data, setData] = React.useState<CategoryPoint[]>([])

  React.useEffect(() => {
    let mounted = true
    getCategorySales()
      .then((rows) => {
        if (mounted) {
          setData(rows.map((row) => ({ category: row.category_name, sales: row.sales_count })))
        }
      })
      .catch((error: unknown) => {
        console.error("Gagal memuat penjualan per kategori", error)
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card className="h-full border-zinc-200/80 bg-white rounded-2xl shadow-xs">
      <CardHeader className="p-5 pb-4 border-b border-zinc-100">
        <CardTitle className="text-base font-bold text-zinc-900 tracking-tight">Kategori Terlaris</CardTitle>
        <CardDescription className="text-xs text-zinc-500 mt-0.5">
          Jumlah eksemplar/item terjual berdasarkan kategori produk
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E4E4E7" opacity={0.7} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#71717A" }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="category"
                type="category"
                tick={{ fontSize: 11, fill: "#71717A" }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-zinc-200/80 bg-white p-3 shadow-lg text-xs font-semibold">
                        <p className="text-zinc-900">{payload[0].payload.category}: <span className="text-blue-600 font-bold">{payload[0].value} terjual</span></p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="sales" radius={[0, 6, 6, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
