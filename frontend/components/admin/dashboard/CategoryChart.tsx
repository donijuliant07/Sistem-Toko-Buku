"use client"

import * as React from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { analyticsService, CategorySalesItem } from "@/lib/services"

const colors = ["#1F6F54", "#C8A24A", "#2A7F86", "#2E7D4F", "#5B5FA8", "#B45309"]

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
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.6} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis
                dataKey="category"
                type="category"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-md text-xs font-semibold">
                        <p className="text-[var(--foreground)]">{payload[0].payload.category}: <span className="text-[var(--primary)] font-bold">{payload[0].value} terjual</span></p>
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
