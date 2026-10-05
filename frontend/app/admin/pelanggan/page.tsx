"use client"

import * as React from "react"
import { Search, Mail, Phone, MapPin, ShoppingBag, ArrowUpDown, UserCheck } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Cari nama, email, kota pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-slate-50 dark:bg-slate-900"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 dark:border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Avatar</TableHead>
                  <TableHead className="font-semibold">Nama Pelanggan</TableHead>
                  <TableHead className="font-semibold">Kontak & Kota</TableHead>
                  <TableHead className="font-semibold">Total Pesanan</TableHead>
                  <TableHead className="font-semibold">
                    <button
                      onClick={() => setSortOrder((s) => (s === "asc" ? "desc" : "asc"))}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      <span>Total Belanja</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="font-semibold">Bergabung</TableHead>
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
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-xs text-slate-400">
                      Pelanggan tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Avatar className="h-8 w-8 rounded-full">
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-bold">
                            {c.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-400">{c.email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        <div>{c.phone}</div>
                        <div className="text-[11px] text-slate-400">{c.city}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {c.totalOrders} kali
                      </TableCell>
                      <TableCell className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {formatRupiah(c.totalSpent)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {formatTanggal(c.joinedAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "Aktif" ? "success" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Profil Pelanggan</DialogTitle>
            <DialogDescription className="text-xs">
              Riwayat belanja dan loyalitas member PustakaGram
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <Avatar className="h-12 w-12 rounded-full">
                  <AvatarFallback className="text-base bg-blue-100 text-blue-700 font-bold">
                    {selectedCustomer.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {selectedCustomer.name}
                  </p>
                  <p className="text-slate-400 text-xs">{selectedCustomer.email}</p>
                  <Badge variant="success" className="mt-1 text-[10px]">
                    Member Sejak {formatTanggal(selectedCustomer.joinedAt)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Phone className="h-3.5 w-3.5 text-blue-600" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-amber-500" />
                  <span>{selectedCustomer.city}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Total Transaksi Selesai: {selectedCustomer.totalOrders} pesanan</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
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
