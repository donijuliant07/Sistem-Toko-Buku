"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KPICardData } from "@/types"
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Activity } from "lucide-react"

interface SectionCardsProps {
  data: KPICardData[]
  loading?: boolean
}

export function SectionCards({ data, loading }: SectionCardsProps) {
  const getIcon = (title: string) => {
    if (title.includes("Pendapatan")) return DollarSign
    if (title.includes("Pesanan")) return ShoppingBag
    if (title.includes("Pelanggan")) return Users
    return Activity
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse border-[var(--border)] bg-[var(--surface)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-[var(--surface-muted)] rounded" />
              <div className="h-8 w-8 bg-[var(--surface-muted)] rounded-lg" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-32 bg-[var(--surface-muted)] rounded mb-2" />
              <div className="h-3 w-40 bg-[var(--surface-muted)] rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {data.map((kpi, idx) => {
        const Icon = getIcon(kpi.title)
        return (
          <Card key={idx} className="relative overflow-hidden transition-all hover:border-zinc-300 hover:shadow-sm border-zinc-200/80 bg-white rounded-2xl shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-2">
              <CardTitle className="text-xs font-medium text-zinc-500 tracking-tight">
                {kpi.title}
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-900 tabular-nums">
                {kpi.value}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-flex items-center font-semibold px-2 py-0.5 rounded-full text-[11px] border ${
                    kpi.isPositive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                      : "bg-rose-50 text-rose-700 border-rose-200/60"
                  }`}
                >
                  {kpi.isPositive ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {kpi.isPositive ? "+" : ""}
                  {kpi.trendPercent}%
                </span>
                <span className="text-zinc-500 truncate">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
