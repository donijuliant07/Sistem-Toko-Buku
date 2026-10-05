"use client"

import * as React from "react"
import {
  Boxes,
  Search,
  PackagePlus,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
    try {
      const newStock = Math.max(0, selectedProduct.stock + adjustAmount)
      await productService.adjustStock(selectedProduct.id, newStock)
      toast.success(`Stok "${selectedProduct.title}" disesuaikan menjadi ${newStock} unit. Alasan: ${reason}`)
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
        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Total Stok Fisik</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{totalStock} Unit</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Stok Menipis (≤5)</p>
              <p className="text-2xl font-extrabold text-amber-600">{lowStockCount} Judul</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Stok Habis / Kosong</p>
              <p className="text-2xl font-extrabold text-red-600">{outOfStockCount} Judul</p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Cari judul produk atau SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-slate-50 dark:bg-slate-900"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
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
                className="h-8 text-xs"
                onClick={() => setStockStatusFilter(item.val)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabel Inventori */}
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Judul & SKU</TableHead>
                  <TableHead className="font-semibold">Kategori</TableHead>
                  <TableHead className="font-semibold">Tipe</TableHead>
                  <TableHead className="font-semibold">Stok Saat Ini</TableHead>
                  <TableHead className="font-semibold">Indikator</TableHead>
                  <TableHead className="text-right font-semibold">Aksi Penyesuaian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-12">
                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-xs text-slate-400">
                      Tidak ada produk ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell>
                        <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {prod.title}
                        </div>
                        <div className="text-[11px] text-slate-400">SKU: {prod.isbn}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {prod.category}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{prod.type}</TableCell>
                      <TableCell className="font-bold text-xs tabular-nums">
                        {prod.stock} unit
                      </TableCell>
                      <TableCell>
                        {prod.stock <= 0 ? (
                          <Badge variant="destructive">Habis</Badge>
                        ) : prod.stock <= 5 ? (
                          <Badge variant="warning">Menipis ({prod.stock})</Badge>
                        ) : (
                          <Badge variant="success">Aman</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => {
                            setSelectedProduct(prod)
                            setAdjustAmount(20)
                            setAdjustOpen(true)
                          }}
                        >
                          <PackagePlus className="h-3.5 w-3.5 text-blue-600" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Penyesuaian Stok Fisik</DialogTitle>
            <DialogDescription className="text-xs">
              Ubah atau tambahkan stok gudang untuk produk ini.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <form onSubmit={handleAdjustSubmit} className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="font-bold text-slate-800 dark:text-slate-200">{selectedProduct.title}</p>
                <p className="text-slate-400">Stok Saat Ini: <span className="font-bold text-blue-600">{selectedProduct.stock} unit</span></p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Perubahan Stok (+/- unit)
                </label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                  placeholder="Contoh: 20 atau -5"
                />
                <p className="text-[11px] text-slate-400">
                  Stok akhir setelah penyesuaian:{" "}
                  <strong className="text-slate-800 dark:text-slate-200">
                    {Math.max(0, selectedProduct.stock + adjustAmount)} unit
                  </strong>
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Alasan Penyesuaian
                </label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Alasan (misal: restock penerbit, barang rusak, stok opname)"
                />
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setAdjustOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
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
