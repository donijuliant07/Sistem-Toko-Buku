"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, BookOpen, ShoppingCart, Users, Tag, ArrowRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

interface SearchItem {
  title: string
  subtitle: string
  category: "Produk" | "Pesanan" | "Halaman"
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const staticItems: SearchItem[] = [
  { title: "Dashboard", subtitle: "Ringkasan metrik & KPI toko", category: "Halaman", href: "/admin/dashboard", icon: BookOpen },
  { title: "Daftar Produk", subtitle: "Katalog & manajemen stok", category: "Halaman", href: "/admin/produk", icon: BookOpen },
  { title: "Daftar Pesanan", subtitle: "Status dan pengiriman", category: "Halaman", href: "/admin/pesanan", icon: ShoppingCart },
  { title: "Inventori & Stok", subtitle: "Pemantauan stok menipis", category: "Halaman", href: "/admin/inventori", icon: BookOpen },
  { title: "Pelanggan", subtitle: "Daftar akun & riwayat belanja", category: "Halaman", href: "/admin/pelanggan", icon: Users },
  { title: "Promo & Voucher", subtitle: "Diskon 10.10 & kupon belanja", category: "Halaman", href: "/admin/promo", icon: Tag },
  { title: "Laut Bercerita", subtitle: "Leila S. Chudori • Stok 45", category: "Produk", href: "/admin/produk?search=Laut", icon: BookOpen },
  { title: "Atomic Habits", subtitle: "James Clear • Stok Kritis 4", category: "Produk", href: "/admin/produk?search=Atomic", icon: BookOpen },
  { title: "ORD-20261005-001", subtitle: "Ahmad Fauzi • Rp191.950", category: "Pesanan", href: "/admin/pesanan?search=1001", icon: ShoppingCart },
]

interface CommandSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandSearchDialog({ open, onOpenChange }: CommandSearchDialogProps) {
  const [query, setQuery] = React.useState("")
  const router = useRouter()

  const filtered = React.useMemo(() => {
    if (!query) return staticItems
    const q = query.toLowerCase()
    return staticItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    )
  }, [query])

  const handleSelect = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-xl">
        <DialogTitle className="sr-only">Pencarian Global</DialogTitle>
        <DialogDescription className="sr-only">Cari produk, pesanan, atau menu admin</DialogDescription>
        <div className="flex items-center px-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk, pesanan, pelanggan, atau menu... (Cmd+K)"
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 px-0 bg-transparent"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-400">Tidak ada hasil ditemukan.</p>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item.href)}
                  className="flex w-full items-center justify-between rounded-lg p-2.5 text-left text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                      <p className="text-[11px] text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                      {item.category}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
