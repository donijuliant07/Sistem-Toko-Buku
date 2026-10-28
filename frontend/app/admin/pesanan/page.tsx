"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Search,
  Eye,
  MoreHorizontal,
  Printer,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
  ArrowUpDown,
  Download,
  CreditCard,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/StatusBadge"
import { OrderDetailDialog } from "@/components/admin/orders/OrderDetailDialog"
import { Order, OrderStatus } from "@/types"
import { orderService } from "@/lib/services"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import { toast } from "sonner"

export default function AdminOrdersPage() {
  // `useSearchParams` di App Router harus dibaca di dalam <Suspense> agar
  // halaman bisa di-prerender. Komponen ini adalah versi ter-suspense-nya.
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat data pesanan…</div>}>
      <AdminOrdersContent />
    </React.Suspense>
  )
}

function AdminOrdersContent() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")
  // Kata kunci dari pencarian global (Cmd+K) → `/admin/pesanan?q=...`.
  const initialQuery = searchParams.get("q") ?? ""

  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [statusTab, setStatusTab] = React.useState<string>("semua")
  const [searchQuery, setSearchQuery] = React.useState(initialQuery)
  const [paymentFilter, setPaymentFilter] = React.useState<string>("all")
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const pageSize = 10

  const loadData = React.useCallback(() => {
    orderService.getAll().then((res) => {
      setOrders(res)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    let active = true
    orderService.getAll().then((res) => {
      if (active) {
        setOrders(res)
        setLoading(false)

        if (highlightId) {
          const match = res.find((o) => o.id === highlightId)
          if (match) {
            setSelectedOrder(match)
            setDetailOpen(true)
          }
        }
      }
    })
    return () => {
      active = false
    }
  }, [highlightId])

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    try {
      const updated = await orderService.updateStatus(orderId, status)
      toast.success(`Pesanan ${updated.orderNumber} berhasil diubah ke ${status}`)
      loadData()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status")
    }
  }

  const handlePrint = (order: Order) => {
    toast.info(`Mencetak invoice untuk ${order.orderNumber}...`)
  }

  const handleExportCSV = () => {
    toast.success("Mengekspor 50 riwayat pesanan ke format CSV...")
  }

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter((o) => {
        if (statusTab === "semua") return true
        return o.status === statusTab
      })
      .filter((o) => {
        if (paymentFilter === "all") return true
        return o.paymentMethod === paymentFilter
      })
      .filter((o) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          o.shippingAddress.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB
      })
  }, [orders, statusTab, paymentFilter, searchQuery, sortOrder])

  const paginated = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage])

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Pesanan & Pengiriman"
        description={`Total ${orders.length} transaksi pesanan masuk via web PustakaGram.`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="gap-1.5 text-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Ekspor CSV</span>
          </Button>
        }
      />

      {/* Tabs Status & Filter Box */}
      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <Tabs value={statusTab} onValueChange={(val) => { setStatusTab(val); setCurrentPage(1); }}>
              <TabsList className="bg-zinc-100 p-1 h-9 rounded-xl inline-flex gap-1 border border-zinc-200/60">
                <TabsTrigger value="semua" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Semua ({orders.length})</TabsTrigger>
                <TabsTrigger value="Menunggu Pembayaran" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Menunggu Bayar</TabsTrigger>
                <TabsTrigger value="Dibayar" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Dibayar</TabsTrigger>
                <TabsTrigger value="Diproses" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Diproses</TabsTrigger>
                <TabsTrigger value="Dikirim" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Dikirim</TabsTrigger>
                <TabsTrigger value="Selesai" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Selesai</TabsTrigger>
                <TabsTrigger value="Batal" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Batal</TabsTrigger>
                <TabsTrigger value="Kedaluwarsa" className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer">Kedaluwarsa</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Cari nomor pesanan, nama pembeli, email, atau alamat..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-xl"
              />
            </div>

            <Select
              value={paymentFilter}
              onValueChange={(val) => {
                setPaymentFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-56 text-xs h-9 rounded-xl bg-zinc-50/70 border-zinc-200/80 text-zinc-900">
                <SelectValue placeholder="Metode Pembayaran" />
              </SelectTrigger>
              <SelectContent className="bg-white border-zinc-200/80 text-zinc-900 rounded-xl shadow-lg">
                <SelectItem value="all" className="text-xs">Semua Metode</SelectItem>
                <SelectItem value="BCA Virtual Account" className="text-xs">BCA VA</SelectItem>
                <SelectItem value="Mandiri VA" className="text-xs">Mandiri VA</SelectItem>
                <SelectItem value="QRIS" className="text-xs">QRIS</SelectItem>
                <SelectItem value="GoPay" className="text-xs">GoPay</SelectItem>
                <SelectItem value="OVO" className="text-xs">OVO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabel Pesanan */}
      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/75">
                <TableRow className="border-b border-zinc-200/80 hover:bg-transparent">
                  <TableHead className="w-36 font-semibold text-xs text-zinc-600">No. Pesanan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Pelanggan</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-xs text-zinc-600">
                    <button
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Tanggal Masuk</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-xs text-zinc-600">Items</TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold text-xs text-zinc-600">Metode Bayar</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Total Tagihan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Status</TableHead>
                  <TableHead className="text-right font-semibold text-xs text-zinc-600">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-100">
                      <TableCell colSpan={8} className="h-14">
                        <div className="h-5 w-full bg-zinc-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-zinc-500">
                      Tidak ada pesanan yang sesuai dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((order) => (
                    <TableRow key={order.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                      <TableCell className="font-semibold text-zinc-900 text-xs">
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setDetailOpen(true)
                          }}
                          className="hover:underline font-mono font-bold cursor-pointer text-zinc-900"
                        >
                          {order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-zinc-900">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-zinc-500 truncate max-w-[160px]">{order.customerEmail}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-zinc-500">
                        {formatTanggalJam(order.createdAt)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-zinc-600">
                        {order.items.length} item ({order.items.reduce((a, b) => a + b.quantity, 0)} eks)
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-zinc-600">
                        {order.paymentMethod}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-900 tabular-nums">
                        {formatRupiah(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <OrderStatusBadge status={order.status} />
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white border-zinc-200/80 text-zinc-800 shadow-lg rounded-xl">
                            <DropdownMenuLabel className="text-xs text-zinc-500 font-semibold">Tindakan Pesanan</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrder(order)
                                setDetailOpen(true)
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <Eye className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Lihat Detail Lengkap</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrint(order)}
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <Printer className="h-3.5 w-3.5 text-zinc-500" />
                              <span>Cetak Invoice</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100" />
                            <DropdownMenuLabel className="text-[10px] text-zinc-400 font-semibold">Pembayaran</DropdownMenuLabel>
                            <DropdownMenuItem asChild className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg">
                              <Link href="/admin/pembayaran">
                                <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                                <span>Verifikasi Pembayaran</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100" />
                            <DropdownMenuLabel className="text-[10px] text-zinc-400 font-semibold">Ubah Status</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Diproses")}
                              disabled={order.status === "Diproses"}
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span>Set Diproses</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Dikirim")}
                              disabled={order.status === "Dikirim"}
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <Truck className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Set Dikirim</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Selesai")}
                              disabled={order.status === "Selesai" || order.paymentStatus !== "Lunas"}
                              title={
                                order.paymentStatus === "Lunas"
                                  ? undefined
                                  : "Konfirmasi pembayaran terlebih dahulu"
                              }
                              className="text-xs flex items-center gap-2 cursor-pointer text-zinc-700 hover:bg-zinc-100 rounded-lg"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Set Selesai</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Batal")}
                              disabled={order.status === "Batal"}
                              className="text-xs flex items-center gap-2 text-rose-600 focus:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5 text-rose-500" />
                              <span>Batalkan Pesanan</span>
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
              Menampilkan {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filteredOrders.length)} dari {filteredOrders.length} transaksi
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50"
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
                className="h-8 text-xs rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Detail Pesanan */}
      <OrderDetailDialog
        order={selectedOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusUpdate={handleStatusUpdate}
      />
    </div>
  )
}
