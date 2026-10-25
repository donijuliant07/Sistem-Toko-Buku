"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, PackagePlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { LowStockBook } from "@/lib/types"
import { adjustStock, getLowStockProducts } from "@/lib/api"
import { toast } from "sonner"

export function LowStockCard() {
  const [items, setItems] = React.useState<LowStockBook[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(() => {
    getLowStockProducts()
      .then((res) => setItems(res))
      .catch((error: unknown) => console.error("Gagal memuat stok menipis", error))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    let active = true
    getLowStockProducts()
      .then((res) => {
        if (active) setItems(res)
      })
      .catch((error: unknown) => console.error("Gagal memuat stok menipis", error))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleQuickRestock = async (product: LowStockBook) => {
    try {
      const result = await adjustStock({
        product_id: product.id,
        quantity: 20,
        type: "Restok",
        reason: "Restok cepat dari dashboard",
      })
      toast.success(`Stok "${product.title}" ditambah 20 unit (total ${result.stock_after}).`)
      loadData()
    } catch (error) {
      console.error("Gagal menambah stok", error)
      toast.error("Gagal menambah stok")
    }
  }

  return (
    <Card className="h-full flex flex-col justify-between border-zinc-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-3.5 border-b border-zinc-100">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-zinc-900 tracking-tight">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span>Peringatan Stok Menipis</span>
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 mt-0.5">
            Produk dengan stok di bawah ambang batas (≤5 eksemplar)
          </CardDescription>
        </div>
        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/60 px-2.5 py-0.5 rounded-full text-xs font-semibold">
          {items.length} Kritis
        </span>
      </CardHeader>

      <CardContent className="flex-1 p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <p className="text-xs text-zinc-400">Semua inventori dalam kondisi aman.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.slice(0, 5).map((prod) => (
              <div
                key={prod.id}
                className="flex items-center justify-between rounded-xl border border-zinc-100 p-3 bg-zinc-50/60 hover:bg-zinc-50 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate text-xs font-semibold text-zinc-900">
                    {prod.title}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {prod.author || "Tanpa penulis"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200/60">
                    Sisa {prod.stock}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-[11px] gap-1 bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200 rounded-lg cursor-pointer"
                    onClick={() => handleQuickRestock(prod)}
                  >
                    <PackagePlus className="h-3 w-3" />
                    <span>+20</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-zinc-100">
          <Button
            asChild
            variant="ghost"
            className="w-full text-xs text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 justify-between px-2.5 h-8.5 rounded-xl font-medium"
          >
            <Link href="/admin/inventori">
              <span>Kelola Semua Stok & Inventori</span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
