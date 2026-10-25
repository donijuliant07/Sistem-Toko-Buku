"use client"

import * as React from "react"
import {
  Boxes,
  Search,
  PackagePlus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Product } from "@/types"
import { productService } from "@/lib/services"
import { toast } from "sonner"

export default function AdminInventoryPage() {
  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [stockStatusFilter, setStockStatusFilter] = React.useState<"all" | "safe" | "low" | "out">("all")

  // Modal Penyesuaian Stok
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
  const [adjustAmount, setAdjustAmount] = React.useState<number>(0)
  const [reason, setReason] = React.useState<string>("Restock pengadaan penerbit")
  const [adjustOpen, setAdjustOpen] = React.useState(false)

  const loadData = React.useCallback(() => {
    productService.getAll().then((res) => {
      setProducts(res)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    let active = true
    productService.getAll().then((res) => {
      if (active) {
        setProducts(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return
    // `POST /inventory/adjust` menghitung stok akhir di server dari stok yang
    // tersimpan (bukan stok yang mungkin sudah basi di layar) dan menolak hasil
    // negatif, alih-alih diam-diam menimpanya dengan 0.
    if (adjustAmount === 0) {
      toast.error("Perubahan stok tidak boleh nol.")
      return
    }
    try {
      const adjusted = await productService.adjustStock(selectedProduct.id, adjustAmount, reason)
      toast.success(
        `Stok "${selectedProduct.title}" disesuaikan: ${adjusted.stock_before} → ${adjusted.stock_after} unit. Alasan: ${reason}`
      )
      loadData()
      setAdjustOpen(false)
    } catch {
      toast.error("Gagal memperbarui stok")
    }
  }

  const filtered = React.useMemo(() => {
    return products
      .filter((p) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return p.title.toLowerCase().includes(q) || p.isbn.toLowerCase().includes(q)
      })
      .filter((p) => {
        if (stockStatusFilter === "all") return true
        if (stockStatusFilter === "low") return p.stock <= 5 && p.stock > 0
        if (stockStatusFilter === "out") return p.stock <= 0
        if (stockStatusFilter === "safe") return p.stock > 5
        return true
      })
  }, [products, searchQuery, stockStatusFilter])

  const totalStock = products.reduce((acc, curr) => acc + curr.stock, 0)
  const lowStockCount = products.filter((p) => p.stock <= 5 && p.stock > 0).length
  const outOfStockCount = products.filter((p) => p.stock <= 0).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventori & Manajemen Stok"
        description="Pantau ketersediaan fisik buku, peringatan ambang batas stok, dan penyesuaian opname."
      />

      {/* 3 Summary Mini Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-zinc-500">Total Stok Fisik</p>
              <p className="text-2xl font-bold tracking-tight text-zinc-900 tabular-nums">{totalStock} Unit</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-zinc-500">Stok Menipis (≤5)</p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 tabular-nums">{lowStockCount} Judul</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-zinc-500">Stok Habis / Kosong</p>
              <p className="text-2xl font-bold tracking-tight text-rose-600 tabular-nums">{outOfStockCount} Judul</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200/60">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Cari judul produk atau SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {(
              [
                { label: "Semua", val: "all" },
                { label: "Aman", val: "safe" },
                { label: "Menipis", val: "low" },
                { label: "Habis", val: "out" },
              ] as const
            ).map((item) => (
              <Button
                key={item.val}
                variant={stockStatusFilter === item.val ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs rounded-xl cursor-pointer ${
                  stockStatusFilter === item.val
                    ? "bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
                onClick={() => setStockStatusFilter(item.val)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Inventori */}
      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/75">
                <TableRow className="border-b border-zinc-200/80 hover:bg-transparent">
                  <TableHead className="font-semibold text-xs text-zinc-600">Judul & SKU</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Kategori</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Tipe</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Stok Saat Ini</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs text-zinc-600">Aksi Penyesuaian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-100">
                      <TableCell colSpan={6} className="h-12">
                        <div className="h-4 w-full bg-zinc-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-xs text-zinc-500">
                      Tidak ada produk ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prod) => (
                    <TableRow key={prod.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-xs text-zinc-900">
                          {prod.title}
                        </div>
                        <div className="text-[11px] text-zinc-500">SKU: {prod.isbn}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">
                        {prod.category}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">{prod.type}</TableCell>
                      <TableCell className="font-bold text-xs tabular-nums text-zinc-900">
                        {prod.stock} unit
                      </TableCell>
                      <TableCell>
                        {prod.stock <= 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Habis
                          </span>
                        ) : prod.stock <= 5 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Menipis ({prod.stock})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Aman
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 rounded-lg border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                          onClick={() => {
                            setSelectedProduct(prod)
                            setAdjustAmount(20)
                            setAdjustOpen(true)
                          }}
                        >
                          <PackagePlus className="h-3.5 w-3.5 text-zinc-600" />
                          <span>Sesuaikan Stok</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialog Penyesuaian Stok */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white border border-zinc-200/80 text-zinc-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-zinc-900">Penyesuaian Stok Fisik</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Ubah atau tambahkan stok gudang untuk produk ini.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
                <p className="font-semibold text-zinc-900">{selectedProduct.title}</p>
                <p className="text-zinc-500 mt-0.5">Stok Saat Ini: <span className="font-bold text-zinc-900">{selectedProduct.stock} unit</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">
                  Perubahan Stok (+/- unit)
                </label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                  placeholder="Contoh: 20 atau -5"
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
                <p className="text-[11px] text-zinc-500">
                  Stok akhir setelah penyesuaian:{" "}
                  <strong className="text-zinc-900">
                    {Math.max(0, selectedProduct.stock + adjustAmount)} unit
                  </strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">
                  Alasan Penyesuaian
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan (misal: restock penerbit, barang rusak, stok opname)"
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button type="button" variant="outline" size="sm" className="rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer" onClick={() => setAdjustOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer">
                  Simpan Penyesuaian
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
