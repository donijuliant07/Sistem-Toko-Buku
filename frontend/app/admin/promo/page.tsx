"use client"

import * as React from "react"
import { Tag, Plus, Check, Copy, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { promoService } from "@/lib/services"
import type { Promo, PromoDiscountType } from "@/lib/types"
import { formatRupiah, formatTanggal } from "@/lib/utils"
import { toast } from "sonner"

export default function AdminPromosPage() {
  const [promos, setPromos] = React.useState<Promo[]>([])
  const [loading, setLoading] = React.useState(true)
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  // Dialog Buat Promo Baru
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [type, setType] = React.useState<PromoDiscountType>("Persentase")
  const [discountValue, setDiscountValue] = React.useState(15)
  const [minPurchase, setMinPurchase] = React.useState(100000)
  const [endDate, setEndDate] = React.useState("")
  const [quota, setQuota] = React.useState(300)

  const loadData = React.useCallback(() => {
    promoService
      .getAll()
      .then(setPromos)
      .catch(() => toast.error("Gagal memuat daftar promo"))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    let active = true
    promoService
      .getAll()
      .then((res) => {
        if (active) setPromos(res)
      })
      .catch(() => {
        if (active) toast.error("Gagal memuat daftar promo")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const handleToggle = async (prm: Promo) => {
    try {
      const updated = await promoService.toggleActive(prm.id, !prm.is_active)
      toast.success(`Promo "${updated.name}" sekarang ${updated.is_active ? "Aktif" : "Nonaktif"}`)
      loadData()
    } catch {
      toast.error("Gagal mengubah status promo")
    }
  }

  const handleDelete = async (prm: Promo) => {
    if (!window.confirm(`Hapus promo "${prm.name}" (${prm.code})?`)) return
    try {
      await promoService.delete(prm.id)
      toast.success(`Promo "${prm.name}" dihapus`)
      loadData()
    } catch {
      toast.error("Gagal menghapus promo")
    }
  }

  const handleCopyCode = (codeStr: string) => {
    navigator.clipboard.writeText(codeStr)
    setCopiedCode(codeStr)
    toast.success(`Kode voucher "${codeStr}" disalin ke clipboard`)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !code) {
      toast.error("Mohon isi nama dan kode promo")
      return
    }
    try {
      const start = new Date().toISOString().split("T")[0]
      await promoService.create({
        name,
        code: code.toUpperCase(),
        discount_type: type,
        discount_value: discountValue,
        min_purchase: minPurchase,
        quota,
        is_active: true,
        start_date: start,
        end_date: endDate || start,
      })
      toast.success(`Kampanye promo "${name}" berhasil dibuat`)
      loadData()
      setCreateOpen(false)
      setName("")
      setCode("")
    } catch {
      toast.error("Gagal membuat promo baru")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promo & Voucher Belanja"
        description="Kelola diskon kampanye, kupon voucher promo, dan gratis ongkir PustakaGram."
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            className="gap-1.5 text-xs bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-xl cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Buat Promo Baru</span>
          </Button>
        }
      />

      {/* Cards Grid List Promo */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-44 rounded-2xl animate-pulse bg-zinc-100 border-0" />
          ))
        ) : promos.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-zinc-500">
            Belum ada kampanye promo.
          </div>
        ) : (
          promos.map((prm) => (
            <Card
              key={prm.id}
              className={`relative overflow-hidden transition-all rounded-2xl border-zinc-200/80 bg-white shadow-xs ${
                !prm.is_active ? "opacity-60 bg-zinc-50" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      prm.is_active
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/60"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prm.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} />
                      {prm.status}
                    </span>
                    <CardTitle className="text-sm font-bold mt-2 text-zinc-900 tracking-tight">
                      {prm.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={prm.is_active}
                      onCheckedChange={() => handleToggle(prm)}
                      title="Toggle Aktif / Nonaktif"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      onClick={() => handleDelete(prm)}
                      title="Hapus promo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                {/* Kode Voucher AlignUI Sapphire Blue Accent */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-blue-50/70 p-2.5 border border-blue-200/60">
                  <div className="flex min-w-0 items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="truncate font-mono font-bold tracking-wider text-blue-700 text-sm">
                      {prm.code}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer"
                    onClick={() => handleCopyCode(prm.code)}
                  >
                    {copiedCode === prm.code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Detail Nilai & Syarat */}
                <div className="space-y-1.5 text-zinc-600">
                  <div className="flex justify-between">
                    <span>Besar Diskon:</span>
                    <span className="font-bold text-zinc-900 tabular-nums">
                      {prm.discount_type === "Persentase" ? `${prm.discount_value}%` : formatRupiah(prm.discount_value)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min. Belanja:</span>
                    <span className="tabular-nums font-medium text-zinc-800">{formatRupiah(prm.min_purchase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penggunaan Kuota:</span>
                    <span className="font-semibold text-zinc-900 tabular-nums">
                      {prm.used_count} / {prm.quota} klaim
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 text-[11px] text-zinc-500 flex justify-between">
                  <span>Periode:</span>
                  <span className="font-medium text-zinc-700">{formatTanggal(prm.start_date)} - {formatTanggal(prm.end_date)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Dialog Buat Promo */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-white border border-zinc-200/80 text-zinc-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold tracking-tight text-zinc-900">Buat Kampanye Promo Baru</DialogTitle>
            <DialogDescription className="text-xs text-zinc-500">
              Atur kupon voucher diskon atau potongan ongkir toko.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-zinc-800">Nama Kampanye *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Promo Gajian Akhir Bulan"
                className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">Kode Kupon *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PAYDAY2026"
                  className="font-mono uppercase rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">Tipe Promo *</label>
                <Select value={type} onValueChange={(val) => setType(val as PromoDiscountType)}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-zinc-200/80 text-zinc-900 rounded-xl shadow-lg">
                    <SelectItem value="Persentase" className="text-xs">Persentase (%)</SelectItem>
                    <SelectItem value="Potongan Tetap" className="text-xs">Potongan Tetap (Rp)</SelectItem>
                    <SelectItem value="Gratis Ongkir" className="text-xs">Gratis Ongkir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">Nilai Diskon</label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">Min Belanja</label>
                <Input
                  type="number"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(Number(e.target.value))}
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-800">Kuota Kupon</label>
                <Input
                  type="number"
                  value={quota}
                  onChange={(e) => setQuota(Number(e.target.value))}
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>
              <div className="col-span-2 space-y-1.5 sm:col-span-3">
                <label className="font-semibold text-zinc-800">Berlaku Sampai *</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Mulai berlaku hari ini. Kolom tanggal tersimpan sebagai DATE, bukan jam.
            </p>

            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" size="sm" className="rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer">
                Terbitkan Promo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
