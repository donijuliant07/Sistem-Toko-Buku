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
  /** Halaman tujuan membaca kata kunci yang sama dengan yang diketik di sini. */
  acceptsQuery?: boolean
  icon: React.ComponentType<{ className?: string }>
}

const staticItems: SearchItem[] = [
  { title: "Dashboard", subtitle: "Ringkasan metrik & KPI toko", category: "Halaman", href: "/admin/dashboard", icon: BookOpen },
  { title: "Daftar Produk", subtitle: "Katalog & manajemen stok", category: "Halaman", href: "/admin/produk", icon: BookOpen },
  { title: "Daftar Pesanan", subtitle: "Status dan pengiriman", category: "Halaman", href: "/admin/pesanan", icon: ShoppingCart },
  { title: "Inventori & Stok", subtitle: "Pemantauan stok menipis", category: "Halaman", href: "/admin/inventori", icon: BookOpen },
  { title: "Pelanggan", subtitle: "Daftar akun & riwayat belanja", category: "Halaman", href: "/admin/pelanggan", icon: Users },
  { title: "Promo & Voucher", subtitle: "Diskon 10.10 & kupon belanja", category: "Halaman", href: "/admin/promo", icon: Tag },
  { title: "Laporan Penjualan", subtitle: "Rekap bulanan & ekspor CSV", category: "Halaman", href: "/admin/laporan", icon: BookOpen },
  { title: "Verifikasi Pembayaran", subtitle: "Setujui atau tolak bukti QRIS", category: "Halaman", href: "/admin/pembayaran", icon: ShoppingCart },
  { title: "Poin & Reward", subtitle: "Aturan poin dan akses ulasan AI", category: "Halaman", href: "/admin/rewards", icon: Tag },
  { title: "Link Harga Marketplace", subtitle: "URL produk per marketplace", category: "Halaman", href: "/admin/marketplace-sources", icon: Tag },
  { title: "Pengaturan", subtitle: "Profil admin dan preferensi toko", category: "Halaman", href: "/admin/pengaturan", icon: Users },
  // Daftar produk/pesanan sebelumnya ditulis tangan (judul, stok, dan nomor
  // pesanan karangan) dengan href rusak seperti `?seartomic`. Keduanya kini
  // membuka halaman tujuan dan melanjutkan dengan kata kunci yang diketik.
  { title: "Cari produk", subtitle: "Cari judul atau penulis di katalog", category: "Produk", href: "/admin/produk", icon: BookOpen, acceptsQuery: true },
  { title: "Cari pesanan", subtitle: "Cari nomor pesanan atau pelanggan", category: "Pesanan", href: "/admin/pesanan", icon: ShoppingCart, acceptsQuery: true },
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

  const handleSelect = (item: SearchItem) => {
    onOpenChange(false)
    const target =
      item.acceptsQuery && query.trim()
        ? `${item.href}?q=${encodeURIComponent(query.trim())}`
        : item.href
    router.push(target)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-xl rounded-2xl border-zinc-200/80 shadow-2xl bg-white">
        <DialogTitle className="sr-only">Pencarian Global</DialogTitle>
        <DialogDescription className="sr-only">Cari produk, pesanan, atau menu admin</DialogDescription>
        <div className="flex items-center px-4 border-b border-zinc-100">
          <Search className="h-4 w-4 text-zinc-400 mr-2 shrink-0" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk, pesanan, pelanggan, atau menu... (Cmd+K)"
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-12 px-0 bg-transparent text-zinc-900 placeholder:text-zinc-400"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-zinc-400">Tidak ada hasil ditemukan.</p>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center justify-between rounded-xl p-2.5 text-left text-xs transition-colors hover:bg-zinc-100 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="text-[11px] text-zinc-500">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-zinc-100 border border-zinc-200/60 px-1.5 py-0.5 text-[10px] text-zinc-600 font-medium">
                      {item.category}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
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
