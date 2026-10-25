"use client"

import * as React from "react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { siteConfig } from "@/config/site"
import { toast } from "sonner"
import { Store, User, Bell, Save } from "lucide-react"

export default function AdminSettingsPage() {
  const [storeName, setStoreName] = React.useState(siteConfig.name)
  const [email, setEmail] = React.useState(siteConfig.adminEmail)
  const [orderNotif, setOrderNotif] = React.useState(true)
  const [stockNotif, setStockNotif] = React.useState(true)
  const [promoNotif, setPromoNotif] = React.useState(false)

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Pengaturan profil toko berhasil diperbarui")
  }

  const handleSaveNotif = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Preferensi notifikasi berhasil disimpan")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan Sistem"
        description="Konfigurasi identitas toko buku, preferensi notifikasi, dan profil administrator."
      />

      <Tabs defaultValue="toko" className="space-y-4">
        <TabsList className="bg-zinc-100 p-1 rounded-xl inline-flex gap-1 border border-zinc-200/60">
          <TabsTrigger value="toko" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <Store className="h-3.5 w-3.5" />
            <span>Profil Toko</span>
          </TabsTrigger>
          <TabsTrigger value="notifikasi" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <Bell className="h-3.5 w-3.5" />
            <span>Notifikasi</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className="text-xs gap-1.5 rounded-lg text-zinc-600 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs hover:text-zinc-900 cursor-pointer">
            <User className="h-3.5 w-3.5" />
            <span>Akun Admin</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Profil Toko */}
        <TabsContent value="toko">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight text-zinc-900">Identitas Toko Online</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Informasi publik yang ditampilkan pada invoice dan antarmuka pembeli
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveStore} className="space-y-4 max-w-lg text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Nama Toko *</label>
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Email Customer Service *</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Alamat Gudang Utama</label>
                  <Input defaultValue="Gedung Readr Center, Jl. Palmerah Barat No. 29-37, Jakarta Pusat 10270" className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Nomor WhatsApp CS</label>
                  <Input defaultValue="+62 811-1234-5678" className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900" />
                </div>
                <Button type="submit" size="sm" className="gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer">
                  <Save className="h-3.5 w-3.5" />
                  <span>Simpan Perubahan</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Notifikasi */}
        <TabsContent value="notifikasi">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight text-zinc-900">Preferensi Pemberitahuan</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Pilih peristiwa transaksi yang ingin dikirimkan langsung ke email/notif dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveNotif} className="space-y-4 max-w-lg text-xs">
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70">
                  <div>
                    <p className="font-semibold text-zinc-900">Pesanan Masuk Baru</p>
                    <p className="text-[11px] text-zinc-500">Terima notifikasi instan saat pelanggan menyelesaikan checkout.</p>
                  </div>
                  <Switch checked={orderNotif} onCheckedChange={setOrderNotif} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70">
                  <div>
                    <p className="font-semibold text-zinc-900">Peringatan Stok Kritis</p>
                    <p className="text-[11px] text-zinc-500">Peringatkan saat persediaan buku menyentuh ambang ≤5 unit.</p>
                  </div>
                  <Switch checked={stockNotif} onCheckedChange={setStockNotif} />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/70">
                  <div>
                    <p className="font-semibold text-zinc-900">Laporan Mingguan Otomatis</p>
                    <p className="text-[11px] text-zinc-500">Kirim rekapitulasi penjualan hari Senin pukul 08:00 WIB.</p>
                  </div>
                  <Switch checked={promoNotif} onCheckedChange={setPromoNotif} />
                </div>

                <Button type="submit" size="sm" className="gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer">
                  <Save className="h-3.5 w-3.5" />
                  <span>Simpan Preferensi</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Akun Admin */}
        <TabsContent value="admin">
          <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold tracking-tight text-zinc-900">Profil Administrator</CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Kelola kredensial dan hak akses akun super admin toko
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-lg text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Nama Lengkap</label>
                  <Input defaultValue={siteConfig.adminUser.name} className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Alamat Email Login</label>
                  <Input defaultValue={siteConfig.adminUser.email} disabled className="rounded-xl border-zinc-200 bg-zinc-100 text-zinc-700 opacity-70" />
                  <p className="text-[10px] text-zinc-500">Email dikaitkan dengan sesi autentikasi utama.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-800">Peran & Otorisasi</label>
                  <Input defaultValue={siteConfig.adminUser.role} disabled className="rounded-xl border-zinc-200 bg-zinc-100 text-zinc-700 opacity-70" />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer"
                  onClick={() => toast.success("Data administrator tersimpan")}
                >
                  Perbarui Profil
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
