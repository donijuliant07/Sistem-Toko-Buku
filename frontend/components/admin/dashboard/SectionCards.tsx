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
        const isAccent = idx % 2 === 1
        return (
          <Card key={idx} className="relative overflow-hidden transition-all hover:shadow-md border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-[var(--muted-foreground)]">
                {kpi.title}
              </CardTitle>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isAccent ? "bg-[var(--accent-soft)] text-[var(--accent-hover)]" : "bg-[var(--primary-soft)] text-[var(--primary)]"}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-[var(--foreground)] tabular-nums">
                {kpi.value}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                    kpi.isPositive
                      ? "bg-[var(--success-soft)] text-[var(--success)]"
                      : "bg-[var(--danger-soft)] text-[var(--danger)]"
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
                <span className="text-[var(--muted-foreground)] truncate">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
