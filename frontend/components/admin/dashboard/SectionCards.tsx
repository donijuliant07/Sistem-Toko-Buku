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
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 rounded" />
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
          <Card key={idx} className="relative overflow-hidden transition-all hover:shadow-md border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {kpi.title}
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums">
                {kpi.value}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs">
                <span
                  className={`inline-flex items-center font-bold px-1.5 py-0.5 rounded text-[11px] ${
                    kpi.isPositive
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400"
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
                <span className="text-slate-400 truncate">{kpi.description}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
