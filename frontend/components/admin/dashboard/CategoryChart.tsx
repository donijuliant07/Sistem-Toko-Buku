"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyticsService, CategorySalesItem } from "@/lib/services"

const colors = ["#0052cc", "#0284c7", "#f59e0b", "#10b981", "#6366f1", "#8b5cf6", "#ec4899"]

export function CategoryChart() {
  const [data, setData] = React.useState<CategorySalesItem[]>([])

  React.useEffect(() => {
    let mounted = true
    analyticsService.getCategorySales().then((res) => {
      if (mounted) setData(res)
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base font-bold">Kategori Terlaris</CardTitle>
        <CardDescription className="text-xs">
          Jumlah eksemplar/item terjual berdasarkan kategori produk
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="category"
                type="category"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold">
                        <p>{payload[0].payload.category}: <span className="text-blue-600 font-bold">{payload[0].value} terjual</span></p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="sales" radius={[0, 4, 4, 0]}>
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
