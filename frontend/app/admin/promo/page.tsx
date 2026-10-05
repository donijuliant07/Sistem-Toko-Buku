"use client"

import * as React from "react"
import { Tag, Plus, Check, Copy } from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import { Promo, PromoType } from "@/types"
import { promoService } from "@/lib/services"
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
  const [type, setType] = React.useState<PromoType>("Persentase")
  const [discountValue, setDiscountValue] = React.useState(15)
  const [minPurchase, setMinPurchase] = React.useState(100000)
  const [quota, setQuota] = React.useState(300)

  const loadData = React.useCallback(() => {
    promoService.getAll().then((res) => {
      setPromos(res)
      setLoading(false)
    })
  }, [])

  React.useEffect(() => {
    let active = true
    promoService.getAll().then((res) => {
      if (active) {
        setPromos(res)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const handleToggle = async (id: string) => {
    try {
      const updated = await promoService.toggleActive(id)
      toast.success(`Promo "${updated.name}" sekarang ${updated.isActive ? "Aktif" : "Nonaktif"}`)
      loadData()
    } catch {
      toast.error("Gagal mengubah status promo")
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
      await promoService.create({
        name,
        code: code.toUpperCase(),
        type,
        discountValue,
        minPurchase,
        quota,
        startDate: new Date().toISOString().split("T")[0],
        endDate: "2026-12-31",
        isActive: true,
        status: "Aktif",
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
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
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
            <Card key={i} className="h-44 animate-pulse bg-slate-100 dark:bg-slate-800 border-0" />
          ))
        ) : promos.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400">
            Belum ada kampanye promo.
          </div>
        ) : (
          promos.map((prm) => (
            <Card
              key={prm.id}
              className={`relative overflow-hidden transition-all border-slate-200/80 dark:border-slate-800 ${
                !prm.isActive ? "opacity-60 bg-slate-50 dark:bg-slate-950" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant={prm.isActive ? "success" : "secondary"} className="text-[10px]">
                      {prm.type}
                    </Badge>
                    <CardTitle className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">
                      {prm.name}
                    </CardTitle>
                  </div>
                  <Switch
                    checked={prm.isActive}
                    onCheckedChange={() => handleToggle(prm.id)}
                    title="Toggle Aktif / Nonaktif"
                  />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs">
                {/* Kode Voucher */}
                <div className="flex items-center justify-between rounded-lg bg-blue-50/80 dark:bg-blue-950/60 p-2.5 border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-blue-600" />
                    <span className="font-mono font-bold tracking-wider text-blue-700 dark:text-blue-300 text-sm">
                      {prm.code}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer"
                    onClick={() => handleCopyCode(prm.code)}
                  >
                    {copiedCode === prm.code ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                {/* Detail Nilai & Syarat */}
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Besar Diskon:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {prm.type === "Persentase" ? `${prm.discountValue}%` : formatRupiah(prm.discountValue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min. Belanja:</span>
                    <span>{formatRupiah(prm.minPurchase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penggunaan Kuota:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {prm.usedCount} / {prm.quota} klaim
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between">
                  <span>Periode:</span>
                  <span>{formatTanggal(prm.startDate)} - {formatTanggal(prm.endDate)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Modal Dialog Buat Promo */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Buat Kampanye Promo Baru</DialogTitle>
            <DialogDescription className="text-xs">
              Atur kupon voucher diskon atau potongan ongkir toko.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Nama Kampanye *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Misal: Promo Gajian Akhir Bulan"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Kode Kupon *</label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="PAYDAY2026"
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Tipe Promo *</label>
                <Select value={type} onValueChange={(val) => setType(val as PromoType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Persentase" className="text-xs">Persentase (%)</SelectItem>
                    <SelectItem value="Potongan Tetap" className="text-xs">Potongan Tetap (Rp)</SelectItem>
                    <SelectItem value="Gratis Ongkir" className="text-xs">Gratis Ongkir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Nilai Diskon</label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Min Belanja</label>
                <Input
                  type="number"
                  value={minPurchase}
                  onChange={(e) => setMinPurchase(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">Kuota Kupon</label>
                <Input
                  type="number"
                  value={quota}
                  onChange={(e) => setQuota(Number(e.target.value))}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Terbitkan Promo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
