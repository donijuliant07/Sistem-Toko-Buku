"use client"

import * as React from "react"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  ArrowUpDown,
  BookOpen,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProductStatusBadge } from "@/components/admin/StatusBadge"
import { ProductFormSheet } from "@/components/admin/products/ProductFormSheet"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Product } from "@/types"
import { productService } from "@/lib/services"
import { formatRupiah } from "@/lib/utils"
import { toast } from "sonner"

export default function AdminProductsPage() {
  // `useSearchParams` wajib berada di dalam <Suspense> agar halaman tetap
  // bisa di-prerender (sama seperti halaman pesanan admin).
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat data produk…</div>}>
      <AdminProductsContent />
    </React.Suspense>
  )
}

function AdminProductsContent() {
  const searchParams = useSearchParams()
  // Kata kunci dari pencarian global (Cmd+K) → `/admin/produk?q=...`.
  const initialQuery = searchParams.get("q") ?? ""

  const [products, setProducts] = React.useState<Product[]>([])
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState(initialQuery)
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")
  const [stockFilter, setStockFilter] = React.useState<string>("all")
  const [sortField, setSortField] = React.useState<"title" | "price" | "stock" | "sold">("title")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc")

  // Modals state
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [deleteProduct, setDeleteProduct] = React.useState<Product | null>(null)
  const [deleteLoading, setDeleteLoading] = React.useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const pageSize = 10

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

  const filteredProducts = React.useMemo(() => {
    return products
      .filter((p) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          p.title.toLowerCase().includes(q) ||
          p.author.toLowerCase().includes(q) ||
          p.isbn.toLowerCase().includes(q)
        )
      })
      .filter((p) => {
        if (categoryFilter === "all") return true
        return p.category === categoryFilter
      })
      .filter((p) => {
        if (typeFilter === "all") return true
        return p.type === typeFilter
      })
      .filter((p) => {
        if (stockFilter === "all") return true
        if (stockFilter === "low") return p.stock <= 5 && p.stock > 0
        if (stockFilter === "empty") return p.stock <= 0
        if (stockFilter === "available") return p.stock > 5
        return true
      })
      .sort((a, b) => {
        // Harga memakai finalPrice (setelah diskon); field lain dibaca apa adanya.
        const valA = sortField === "price" ? a.finalPrice : a[sortField]
        const valB = sortField === "price" ? b.finalPrice : b[sortField]
        if (valA < valB) return sortOrder === "asc" ? -1 : 1
        if (valA > valB) return sortOrder === "asc" ? 1 : -1
        return 0
      })
  }, [products, searchQuery, categoryFilter, typeFilter, stockFilter, sortField, sortOrder])

  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredProducts.slice(start, start + pageSize)
  }, [filteredProducts, currentPage])

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1

  const handleDelete = async () => {
    if (!deleteProduct) return
    setDeleteLoading(true)
    try {
      await productService.delete(deleteProduct.id)
      toast.success(`Produk "${deleteProduct.title}" berhasil dihapus`)
      loadData()
      setDeleteProduct(null)
    } catch {
      toast.error("Gagal menghapus produk")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog & Manajemen Produk"
        description={`Kelola total ${products.length} buku dan item toko dengan variasi diskon & inventori.`}
        action={
          <Button
            onClick={() => {
              setEditingProduct(null)
              setFormOpen(true)
            }}
            className="gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Produk</span>
          </Button>
        }
      />

      {/* Toolbar Filter & Pencarian */}
      <Card className="border-zinc-200/80 bg-white rounded-2xl shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Cari judul buku, penulis, atau SKU/ISBN..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-xl"
              />
            </div>

            {/* Filter Kategori */}
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-48 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 rounded-xl">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200/80 text-zinc-900 rounded-xl shadow-lg">
                <SelectItem value="all" className="text-xs">Semua Kategori</SelectItem>
                <SelectItem value="Fiksi" className="text-xs">Fiksi</SelectItem>
                <SelectItem value="Non-Fiksi" className="text-xs">Non-Fiksi</SelectItem>
                <SelectItem value="Pendidikan & Referensi" className="text-xs">Pendidikan</SelectItem>
                <SelectItem value="Bisnis & Keuangan" className="text-xs">Bisnis</SelectItem>
                <SelectItem value="Pengembangan Diri" className="text-xs">Pengembangan Diri</SelectItem>
                <SelectItem value="Anak-Anak & Remaja" className="text-xs">Anak & Remaja</SelectItem>
                <SelectItem value="Komik & Graphic Novel" className="text-xs">Komik</SelectItem>
                <SelectItem value="Alat Tulis & Kantor" className="text-xs">Alat Tulis</SelectItem>
                <SelectItem value="Aksesori & Merchandise" className="text-xs">Aksesori</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Tipe */}
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-36 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 rounded-xl">
                <SelectValue placeholder="Tipe Produk" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200/80 text-zinc-900 rounded-xl shadow-lg">
                <SelectItem value="all" className="text-xs">Semua Tipe</SelectItem>
                <SelectItem value="Buku" className="text-xs">Buku</SelectItem>
                <SelectItem value="Non-Buku" className="text-xs">Non-Buku</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Stok */}
            <Select
              value={stockFilter}
              onValueChange={(val) => {
                setStockFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-40 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 rounded-xl">
                <SelectValue placeholder="Status Stok" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200/80 text-zinc-900 rounded-xl shadow-lg">
                <SelectItem value="all" className="text-xs">Semua Stok</SelectItem>
                <SelectItem value="available" className="text-xs">Stok Aman (&gt;5)</SelectItem>
                <SelectItem value="low" className="text-xs">Stok Kritis (≤5)</SelectItem>
                <SelectItem value="empty" className="text-xs">Stok Habis</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Produk */}
      <Card className="border-zinc-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/75">
                <TableRow className="border-b border-zinc-200/80">
                  <TableHead className="w-16 text-xs font-semibold uppercase tracking-wider text-zinc-600">Cover</TableHead>
                  <TableHead className="min-w-[140px] sm:min-w-[200px] text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    <button
                      onClick={() => {
                        setSortField("title")
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Judul & Penulis</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-zinc-600">Kategori</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    <button
                      onClick={() => {
                        setSortField("price")
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Harga (Diskon)</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    <button
                      onClick={() => {
                        setSortField("stock")
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Stok</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    <button
                      onClick={() => {
                        setSortField("sold")
                        setSortOrder((s) => (s === "asc" ? "desc" : "asc"))
                      }}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Terjual</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Status</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-zinc-600">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-14">
                        <div className="h-5 w-full bg-zinc-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-zinc-500">
                      Tidak ada produk ditemukan sesuai filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((prod) => (
                    <TableRow key={prod.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                      <TableCell>
                        <div className="relative h-12 w-9 rounded-lg overflow-hidden bg-zinc-100 border border-zinc-200/80">
                          {prod.coverUrl ? (
                            <Image
                              src={prod.coverUrl}
                              alt={prod.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-zinc-400">
                              <BookOpen className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm text-zinc-900 line-clamp-1">
                          {prod.title}
                        </div>
                        <div className="text-xs text-zinc-500 truncate max-w-[160px] sm:max-w-none">
                          {prod.author} • SKU: {prod.isbn}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">
                        <span className="rounded-lg bg-zinc-100 border border-zinc-200/60 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                          {prod.category}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-zinc-900 tabular-nums">
                            {formatRupiah(prod.finalPrice)}
                          </span>
                          {prod.discountPercent > 0 && (
                            <span className="rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 px-1 py-0.2 text-[9px] font-bold">
                              -{prod.discountPercent}%
                            </span>
                          )}
                        </div>
                        {prod.discountPercent > 0 && (
                          <div className="text-[10px] text-zinc-400 line-through">
                            {formatRupiah(prod.normalPrice)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold text-xs ${
                            prod.stock <= 5 ? "text-rose-600 font-bold" : "text-zinc-800"
                          }`}
                        >
                          {prod.stock} unit
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-zinc-500 tabular-nums">
                        {prod.sold.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell>
                        <ProductStatusBadge status={prod.status} stock={prod.stock} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 rounded-xl">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-white border-zinc-200/80 text-zinc-800 shadow-lg rounded-xl">
                            <DropdownMenuLabel className="text-xs text-zinc-500">Pilihan Produk</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProduct(prod)
                                setFormOpen(true)
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <Edit className="h-3.5 w-3.5 text-zinc-600" />
                              <span>Ubah Data</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100" />
                            <DropdownMenuItem
                              onClick={() => setDeleteProduct(prod)}
                              className="text-xs flex items-center gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              <span>Hapus Produk</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-zinc-200/80 gap-3 text-xs text-zinc-500 bg-white">
            <span>
              Menampilkan {filteredProducts.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filteredProducts.length)} dari {filteredProducts.length} produk
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="font-semibold text-zinc-900">
                Halaman {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form Sheet Tambah / Edit */}
      <ProductFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
        onSuccess={loadData}
      />

      {/* Dialog Konfirmasi Hapus */}
      <ConfirmDialog
        open={!!deleteProduct}
        onOpenChange={(op) => !op && setDeleteProduct(null)}
        title="Hapus Produk dari Katalog?"
        description={`Produk "${deleteProduct?.title}" akan dihapus permanen dari daftar toko.`}
        confirmText="Hapus Produk"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  )
}
