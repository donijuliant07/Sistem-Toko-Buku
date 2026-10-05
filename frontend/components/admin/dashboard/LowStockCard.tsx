"use client"

import * as React from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, PackagePlus } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Product } from "@/types"
import { productService } from "@/lib/services"
import { toast } from "sonner"

export function LowStockCard() {
  const [items, setItems] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)

  const loadData = React.useCallback(() => {
    productService.getLowStock(5).then((res) => {
      setItems(res)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    let active = true
    productService.getLowStock(5).then((res) => {
      if (active) {
        setItems(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleQuickRestock = async (product: Product) => {
    try {
      const newStock = product.stock + 20
      await productService.adjustStock(product.id, newStock)
      toast.success(`Stok "${product.title}" berhasil ditambah +20 unit (Total: ${newStock})`)
      loadData()
    } catch {
      toast.error("Gagal menambah stok")
    }
  }

  return (
    <Card className="h-full flex flex-col justify-between border-[var(--border)] bg-[var(--surface)]">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--foreground)]">
            <AlertTriangle className="h-4 w-4 text-[var(--danger)]" />
            <span>Peringatan Stok Menipis</span>
          </CardTitle>
          <CardDescription className="text-xs text-[var(--muted-foreground)]">
            Produk dengan stok di bawah ambang batas (≤5 eksemplar)
          </CardDescription>
        </div>
        <span className="bg-[var(--danger-soft)] text-[var(--danger)] border border-[var(--danger)]/20 px-2 py-0.5 rounded text-[11px] font-bold">
          {items.length} Kritis
        </span>
      </CardHeader>

      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[var(--surface-muted)] animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Semua inventori dalam kondisi aman.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.slice(0, 5).map((prod) => (
              <div
                key={prod.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] border-l-4 border-l-[var(--danger)] p-2.5 bg-[var(--surface-muted)] hover:bg-[var(--surface-tint)] transition-colors"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                    {prod.title}
                  </p>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {prod.category} • SKU: {prod.isbn}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[var(--danger)] bg-[var(--danger-soft)] px-2 py-0.5 rounded border border-[var(--danger)]/20">
                    Sisa {prod.stock}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px] gap-1 hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] cursor-pointer"
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

        <div className="mt-4 pt-3 border-t border-[var(--border)]">
          <Button
            asChild
            variant="ghost"
            className="w-full text-xs text-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] justify-between px-2 h-8"
          >
            <Link href="/admin/inventori">
              <span>Kelola Semua Stok & Inventori</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
