"use client"

import * as React from "react"
import Link from "next/link"
import {
  Eye,
  MoreHorizontal,
  Printer,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  ArrowUpDown,
  Search,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OrderStatusBadge } from "@/components/admin/StatusBadge"
import { Order, OrderStatus } from "@/types"
import { orderService } from "@/lib/services"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import { toast } from "sonner"

export function RecentOrdersTable() {
  const [orders, setOrders] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState(true)
  const [statusTab, setStatusTab] = React.useState<string>("semua")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedRows, setSelectedRows] = React.useState<string[]>([])
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")

  const loadOrders = React.useCallback(() => {
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
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      await orderService.updateStatus(orderId, newStatus)
      toast.success(`Status pesanan berhasil diubah menjadi ${newStatus}`)
      loadOrders()
    } catch (e) {
      // Backend menolak (409) transisi yang melanggar aturan, mis. "Selesai"
      // sebelum pembayaran dikonfirmasi; pesannya lebih berguna daripada teks umum.
      toast.error(e instanceof Error ? e.message : "Gagal mengubah status")
    }
  }

  const handlePrintInvoice = (order: Order) => {
    toast.info(`Mencetak invoice untuk ${order.orderNumber}...`)
  }

  const filteredOrders = React.useMemo(() => {
    return orders
      .filter((o) => {
        if (statusTab === "semua") return true
        return o.status === statusTab
      })
      .filter((o) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.paymentMethod.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB
      })
  }, [orders, statusTab, searchQuery, sortOrder])

  const toggleSelectAll = () => {
    if (selectedRows.length === filteredOrders.slice(0, 7).length) {
      setSelectedRows([])
    } else {
      setSelectedRows(filteredOrders.slice(0, 7).map((o) => o.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    setSelectedRows((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <Card className="col-span-full border-zinc-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
      <CardHeader className="flex flex-col space-y-4 p-5 pb-3 border-b border-zinc-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold text-zinc-900 tracking-tight">Pesanan Terbaru</CardTitle>
            <CardDescription className="text-xs text-zinc-500 mt-0.5">
              Daftar transaksi masuk dan status pemrosesan logistik
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
              <Input
                placeholder="Cari no. pesanan, pelanggan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-zinc-50/70 border-zinc-200/80 text-zinc-900 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList className="bg-zinc-100 p-1 h-8 rounded-xl">
              <TabsTrigger value="semua" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Semua</TabsTrigger>
              <TabsTrigger value="Menunggu Pembayaran" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Menunggu Bayar</TabsTrigger>
              <TabsTrigger value="Dibayar" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Dibayar</TabsTrigger>
              <TabsTrigger value="Diproses" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Diproses</TabsTrigger>
              <TabsTrigger value="Dikirim" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Dikirim</TabsTrigger>
              <TabsTrigger value="Selesai" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Selesai</TabsTrigger>
              <TabsTrigger value="Batal" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Batal</TabsTrigger>
              <TabsTrigger value="Kedaluwarsa" className="text-xs rounded-lg data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs font-medium">Kedaluwarsa</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="rounded-xl border border-zinc-200/80 overflow-hidden">
          <Table>
            <TableHeader className="bg-zinc-50/75">
              <TableRow className="border-b border-zinc-200/80 hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filteredOrders.length > 0 &&
                      selectedRows.length === filteredOrders.slice(0, 7).length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-36 font-semibold text-xs text-zinc-600">No. Pesanan</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-600">Pelanggan</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-600">
                  <button
                    onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                    className="flex items-center gap-1 hover:text-zinc-900 cursor-pointer"
                  >
                    <span>Tanggal</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold text-xs text-zinc-600">Metode Bayar</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-600">Total Belanja</TableHead>
                <TableHead className="font-semibold text-xs text-zinc-600">Status</TableHead>
                <TableHead className="text-right font-semibold text-xs text-zinc-600">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-12">
                      <div className="h-4 w-full bg-zinc-100 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-xs text-zinc-400">
                    Tidak ada pesanan ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.slice(0, 7).map((order) => {
                  const isSelected = selectedRows.includes(order.id)
                  return (
                    <TableRow key={order.id} data-state={isSelected ? "selected" : undefined} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectRow(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-zinc-900 text-xs">
                        <Link href={`/admin/pesanan?id=${order.id}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-zinc-900">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-zinc-400">{order.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500 whitespace-nowrap">
                        {formatTanggalJam(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {order.paymentMethod}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-900 tabular-nums">
                        {formatRupiah(order.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-zinc-200/80 shadow-lg bg-white">
                            <DropdownMenuLabel className="text-xs text-zinc-900">Aksi Pesanan</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/pesanan?id=${order.id}`} className="flex items-center gap-2 text-xs rounded-lg cursor-pointer">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Lihat Detail</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintInvoice(order)} className="flex items-center gap-2 text-xs rounded-lg cursor-pointer">
                              <Printer className="h-3.5 w-3.5" />
                              <span>Cetak Invoice</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-zinc-100" />
                            <DropdownMenuLabel className="text-[10px] text-zinc-400 uppercase tracking-wider">Ubah Status</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(order.id, "Diproses")}
                              disabled={order.status === "Diproses"}
                              className="text-xs flex items-center gap-2"
                            >
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span>Set Diproses</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(order.id, "Dikirim")}
                              disabled={order.status === "Dikirim"}
                              className="text-xs flex items-center gap-2"
                            >
                              <Truck className="h-3.5 w-3.5 text-indigo-500" />
                              <span>Set Dikirim</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(order.id, "Selesai")}
                              disabled={order.status === "Selesai" || order.paymentStatus !== "Lunas"}
                              title={
                                order.paymentStatus === "Lunas"
                                  ? undefined
                                  : "Konfirmasi pembayaran di halaman Pesanan terlebih dahulu"
                              }
                              className="text-xs flex items-center gap-2"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              <span>Set Selesai</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(order.id, "Batal")}
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
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Link ke Halaman Pesanan */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Menampilkan 7 dari {orders.length} pesanan</span>
          <Button asChild variant="outline" size="sm" className="text-xs">
            <Link href="/admin/pesanan">Lihat Seluruh Pesanan ({orders.length})</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
