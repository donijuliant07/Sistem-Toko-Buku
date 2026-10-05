"use client"

import * as React from "react"
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
import { OrderStatusBadge } from "@/components/admin/StatusBadge"
import { OrderDetailDialog } from "@/components/admin/orders/OrderDetailDialog"
import { Order, OrderStatus } from "@/types"
import { orderService } from "@/lib/services"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import { toast } from "sonner"

export default function AdminOrdersPage() {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get("id")

  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [statusTab, setStatusTab] = React.useState<string>("semua")
  const [searchQuery, setSearchQuery] = React.useState("")
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
    } catch {
      toast.error("Gagal mengubah status")
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
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <Tabs value={statusTab} onValueChange={(val) => { setStatusTab(val); setCurrentPage(1); }}>
              <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 h-9">
                <TabsTrigger value="semua" className="text-xs">Semua Pesanan ({orders.length})</TabsTrigger>
                <TabsTrigger value="Menunggu Pembayaran" className="text-xs">Menunggu Bayar</TabsTrigger>
                <TabsTrigger value="Diproses" className="text-xs">Diproses</TabsTrigger>
                <TabsTrigger value="Dikirim" className="text-xs">Dikirim</TabsTrigger>
                <TabsTrigger value="Selesai" className="text-xs">Selesai</TabsTrigger>
                <TabsTrigger value="Batal" className="text-xs">Batal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Cari nomor pesanan, nama pembeli, email, atau alamat..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-8 text-xs h-9 bg-slate-50 dark:bg-slate-900"
              />
            </div>

            <Select
              value={paymentFilter}
              onValueChange={(val) => {
                setPaymentFilter(val)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full md:w-56 text-xs h-9">
                <SelectValue placeholder="Metode Pembayaran" />
              </SelectTrigger>
              <SelectContent>
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
      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36 font-semibold">No. Pesanan</TableHead>
                  <TableHead className="font-semibold">Pelanggan</TableHead>
                  <TableHead className="font-semibold">
                    <button
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Tanggal Masuk</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">Items</TableHead>
                  <TableHead className="font-semibold">Metode Bayar</TableHead>
                  <TableHead className="font-semibold">Total Tagihan</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-14">
                        <div className="h-5 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-slate-400">
                      Tidak ada pesanan yang sesuai dengan filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setDetailOpen(true)
                          }}
                          className="hover:underline font-bold cursor-pointer"
                        >
                          {order.orderNumber}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-slate-400">{order.customerEmail}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatTanggalJam(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {order.items.length} item ({order.items.reduce((a, b) => a + b.quantity, 0)} eks)
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {order.paymentMethod}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatRupiah(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs">Aksi Pesanan</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedOrder(order)
                                setDetailOpen(true)
                              }}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Lihat Detail Lengkap</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePrint(order)}
                              className="text-xs flex items-center gap-2 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Cetak Invoice</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] text-slate-400">Ubah Status</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Diproses")}
                              disabled={order.status === "Diproses"}
                              className="text-xs flex items-center gap-2"
                            >
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span>Set Diproses</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Dikirim")}
                              disabled={order.status === "Dikirim"}
                              className="text-xs flex items-center gap-2"
                            >
                              <Truck className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Set Dikirim</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Selesai")}
                              disabled={order.status === "Selesai"}
                              className="text-xs flex items-center gap-2"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Set Selesai</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusUpdate(order.id, "Batal")}
                              disabled={order.status === "Batal"}
                              className="text-xs flex items-center gap-2 text-red-600 focus:text-red-600"
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
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
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800 gap-3 text-xs text-slate-500">
            <span>
              Menampilkan {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{" "}
              {Math.min(currentPage * pageSize, filteredOrders.length)} dari {filteredOrders.length} transaksi
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Halaman {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
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
