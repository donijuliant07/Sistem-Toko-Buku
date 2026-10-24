"use client"

import * as React from "react"
import Link from "next/link"
import { CreditCard, Eye, Search } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaymentViewBadge } from "@/components/payment/PaymentViewBadge"
import { paymentService } from "@/lib/services"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import type { PaymentAdminListItem, PaymentStatusView } from "@/lib/types"
import { toast } from "sonner"

const TABS: { value: string; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "under_review", label: "Menunggu Verifikasi" },
  { value: "pending", label: "Belum Bayar" },
  { value: "paid", label: "Lunas" },
  { value: "rejected", label: "Ditolak" },
  { value: "expired", label: "Kedaluwarsa" },
]

const PAGE_SIZE = 10

export default function AdminPaymentsPage() {
  const [items, setItems] = React.useState<PaymentAdminListItem[]>([])
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  const [statusTab, setStatusTab] = React.useState("under_review")
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)

  // Pencarian ditunda sedikit supaya tidak memanggil API di setiap ketukan.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  const load = React.useCallback(() => {
    let active = true
    setLoading(true)
    paymentService
      .getAll({
        page,
        limit: PAGE_SIZE,
        status: statusTab === "all" ? undefined : (statusTab as PaymentStatusView),
        search,
      })
      .then((res) => {
        if (!active) return
        setItems(res.data)
        setTotal(res.meta.total)
        setTotalPages(Math.max(1, res.meta.total_pages))
        setError("")
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Daftar pembayaran gagal dimuat.")
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [page, statusTab, search])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- skeleton saat filter/halaman berubah
  React.useEffect(load, [load])

  React.useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Pembayaran"
        description="Periksa bukti transfer pelanggan lalu setujui atau tolak. Status lunas hanya berubah setelah admin memutuskan."
      />

      <Card className="border-zinc-200/80 shadow-xs">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3">
            <Tabs
              value={statusTab}
              onValueChange={(value) => {
                setStatusTab(value)
                setPage(1)
              }}
            >
              <TabsList className="bg-zinc-100/80 p-1 rounded-xl w-full justify-start overflow-x-auto h-auto flex-wrap">
                {TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-xs rounded-lg font-medium text-zinc-600 data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 transition-all cursor-pointer"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Cari nomor pesanan atau nama pembeli..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-8 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-xl"
            />
          </div>

          <div className="rounded-xl border border-zinc-200/80 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-zinc-50/80 hover:bg-zinc-50/80 border-b border-zinc-200/80">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10">Pesanan</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10">Pembeli</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10">Nominal</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10">Bukti</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10">Status</TableHead>
                  <TableHead className="w-20 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 h-10 text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-100">
                      <TableCell colSpan={6} className="h-14">
                        <div className="h-5 w-full bg-zinc-100 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <CreditCard className="mx-auto h-7 w-7 text-zinc-300" />
                      <p className="mt-2 text-xs text-zinc-500">Tidak ada pembayaran pada filter ini.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50/60 transition-colors">
                      <TableCell className="py-3">
                        <p className="text-xs font-semibold text-zinc-900">{item.order_number ?? "—"}</p>
                        <p className="text-[11px] text-zinc-500">
                          {item.order_created_at ? formatTanggalJam(item.order_created_at) : "—"}
                        </p>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-zinc-700">{item.customer_name ?? "—"}</TableCell>
                      <TableCell className="py-3 text-xs font-semibold text-zinc-900">{formatRupiah(item.amount)}</TableCell>
                      <TableCell className="py-3 text-[11px] text-zinc-500">
                        {item.proof_uploaded_at ? formatTanggalJam(item.proof_uploaded_at) : "Belum ada"}
                      </TableCell>
                      <TableCell className="py-3">
                        <PaymentViewBadge status={item.status} />
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100" asChild>
                          <Link href={`/admin/pembayaran/${item.id}`} aria-label={`Verifikasi ${item.order_number ?? ""}`}>
                            <Eye className="h-4 w-4 text-zinc-500" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500">
            <p>
              Menampilkan {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {(page - 1) * PAGE_SIZE + items.length} dari {total} pembayaran
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                Sebelumnya
              </Button>
              <span className="text-xs font-medium text-zinc-700">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
