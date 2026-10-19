"use client"

import * as React from "react"
import { Search, Phone, MapPin, ShoppingBag, ArrowUpDown, UserCheck } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Customer } from "@/types"
import { customerService } from "@/lib/services"
import { formatRupiah, formatTanggal } from "@/lib/utils"

export default function AdminCustomersPage() {
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc")

  React.useEffect(() => {
    let active = true
    customerService.getAll().then((res) => {
      if (active) {
        setCustomers(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = React.useMemo(() => {
    return customers
      .filter((c) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.phone.includes(q)
        )
      })
      .sort((a, b) => {
        return sortOrder === "desc" ? b.totalSpent - a.totalSpent : a.totalSpent - b.totalSpent
      })
  }, [customers, searchQuery, sortOrder])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Pelanggan"
        description={`Total ${customers.length} member terdaftar di ekosistem PustakaGram.`}
      />

      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Cari nama, email, kota pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-zinc-50/70 border-zinc-200/80 text-zinc-900 placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/75">
                <TableRow className="border-b border-zinc-200/80 hover:bg-transparent">
                  <TableHead className="w-12 text-xs font-semibold text-zinc-600">Avatar</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Nama Pelanggan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Kontak & Kota</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Total Pesanan</TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">
                    <button
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1 font-semibold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                    >
                      <span>Total Belanja</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold text-xs text-zinc-600">Bergabung</TableHead>
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
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-zinc-500">
                      Pelanggan tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50/70 transition-colors">
                      <TableCell>
                        <Avatar className="h-8 w-8 rounded-full border border-zinc-200/80">
                          <AvatarFallback className="text-xs bg-zinc-100 text-zinc-700 font-bold">
                            {c.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-zinc-900">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-zinc-500">{c.email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-600">
                        <div>{c.phone}</div>
                        <div className="text-[11px] text-zinc-500">{c.city}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-zinc-700">
                        {c.totalOrders} kali
                      </TableCell>
                      <TableCell className="text-xs font-bold text-zinc-900 tabular-nums">
                        {formatRupiah(c.totalSpent)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-500">
                        {formatTanggal(c.joinedAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                          c.status === "Aktif"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                            : "bg-zinc-100 text-zinc-600 border-zinc-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${c.status === "Aktif" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs rounded-lg border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                          onClick={() => {
                            setSelectedCustomer(c)
                            setDetailOpen(true)
                          }}
                        >
                          Detail
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

      {/* Dialog Detail Pelanggan */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white border border-zinc-200/80 text-zinc-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-zinc-900">Profil Pelanggan</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Riwayat belanja dan loyalitas member PustakaGram
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center gap-3 p-3.5 bg-zinc-50/70 rounded-xl border border-zinc-200/70">
                <Avatar className="h-12 w-12 rounded-full border border-zinc-200/80">
                  <AvatarFallback className="text-base bg-zinc-200 text-zinc-800 font-bold">
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-sm text-zinc-900">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-zinc-500 text-xs">{selectedCustomer.email}</p>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Member Sejak {formatTanggal(selectedCustomer.joinedAt)}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-zinc-600">
                  <Phone className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{selectedCustomer.city}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-600">
                  <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Total Transaksi: {selectedCustomer.totalOrders} pesanan</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-zinc-900 pt-2 border-t border-zinc-100">
                  <UserCheck className="h-3.5 w-3.5 text-zinc-900" />
                  <span>Lifetime Value: {formatRupiah(selectedCustomer.totalSpent)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
