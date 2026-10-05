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
    } catch {
      toast.error("Gagal mengubah status")
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
    <Card className="col-span-full border-slate-200/80 dark:border-slate-800">
      <CardHeader className="flex flex-col space-y-4 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold">Pesanan Terbaru</CardTitle>
            <CardDescription className="text-xs">
              Daftar transaksi masuk dan status pemrosesan logistik
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Cari no. pesanan, pelanggan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="overflow-x-auto pb-1 scrollbar-none">
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <TabsList className="bg-slate-100 dark:bg-slate-800/60 p-1 h-8">
              <TabsTrigger value="semua" className="text-xs">Semua</TabsTrigger>
              <TabsTrigger value="Menunggu Pembayaran" className="text-xs">Menunggu Bayar</TabsTrigger>
              <TabsTrigger value="Diproses" className="text-xs">Diproses</TabsTrigger>
              <TabsTrigger value="Dikirim" className="text-xs">Dikirim</TabsTrigger>
              <TabsTrigger value="Selesai" className="text-xs">Selesai</TabsTrigger>
              <TabsTrigger value="Batal" className="text-xs">Batal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent>
        <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      filteredOrders.length > 0 &&
                      selectedRows.length === filteredOrders.slice(0, 7).length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-36 font-semibold">No. Pesanan</TableHead>
                <TableHead className="font-semibold">Pelanggan</TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                    className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    <span>Tanggal</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold">Metode Bayar</TableHead>
                <TableHead className="font-semibold">Total Belanja</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-right font-semibold">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-12">
                      <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-xs text-slate-400">
                    Tidak ada pesanan ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.slice(0, 7).map((order) => {
                  const isSelected = selectedRows.includes(order.id)
                  return (
                    <TableRow key={order.id} data-state={isSelected ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectRow(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600 dark:text-blue-400 text-xs">
                        <Link href={`/admin/pesanan?id=${order.id}`} className="hover:underline">
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {order.customerName}
                        </div>
                        <div className="text-[11px] text-slate-400">{order.customerPhone}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {formatTanggalJam(order.createdAt)}
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
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/pesanan?id=${order.id}`} className="flex items-center gap-2 text-xs">
                                <Eye className="h-3.5 w-3.5" />
                                <span>Lihat Detail</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handlePrintInvoice(order)} className="flex items-center gap-2 text-xs">
                              <Printer className="h-3.5 w-3.5" />
                              <span>Cetak Invoice</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] text-slate-400">Ubah Status</DropdownMenuLabel>
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
                              disabled={order.status === "Selesai"}
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
