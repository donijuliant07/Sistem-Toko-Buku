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
import { Store, User, Bell, Palette, Save } from "lucide-react"

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
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger value="toko" className="text-xs gap-1.5">
            <Store className="h-3.5 w-3.5" />
            <span>Profil Toko</span>
          </TabsTrigger>
          <TabsTrigger value="notifikasi" className="text-xs gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span>Notifikasi</span>
          </TabsTrigger>
          <TabsTrigger value="admin" className="text-xs gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>Akun Admin</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Profil Toko */}
        <TabsContent value="toko">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Identitas Toko Online</CardTitle>
              <CardDescription className="text-xs">
                Informasi publik yang ditampilkan pada invoice dan antarmuka pembeli
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveStore} className="space-y-4 max-w-lg text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nama Toko *</label>
                  <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Email Customer Service *</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Alamat Gudang Utama</label>
                  <Input defaultValue="Gedung Kompas Gramedia, Jl. Palmerah Barat No. 29-37, Jakarta Pusat 10270" />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nomor WhatsApp CS</label>
                  <Input defaultValue="+62 811-1234-5678" />
                </div>
                <Button type="submit" size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="h-3.5 w-3.5" />
                  <span>Simpan Perubahan</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Notifikasi */}
        <TabsContent value="notifikasi">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Preferensi Pemberitahuan</CardTitle>
              <CardDescription className="text-xs">
                Pilih peristiwa transaksi yang ingin dikirimkan langsung ke email/notif dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveNotif} className="space-y-4 max-w-lg text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Pesanan Masuk Baru</p>
                    <p className="text-[11px] text-slate-400">Terima notifikasi instan saat pelanggan menyelesaikan checkout.</p>
                  </div>
                  <Switch checked={orderNotif} onCheckedChange={setOrderNotif} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Peringatan Stok Kritis</p>
                    <p className="text-[11px] text-slate-400">Peringatkan saat persediaan buku menyentuh ambang ≤5 unit.</p>
                  </div>
                  <Switch checked={stockNotif} onCheckedChange={setStockNotif} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Laporan Mingguan Otomatis</p>
                    <p className="text-[11px] text-slate-400">Kirim rekapitulasi penjualan hari Senin pukul 08:00 WIB.</p>
                  </div>
                  <Switch checked={promoNotif} onCheckedChange={setPromoNotif} />
                </div>

                <Button type="submit" size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  <Save className="h-3.5 w-3.5" />
                  <span>Simpan Preferensi</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Akun Admin */}
        <TabsContent value="admin">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Profil Administrator</CardTitle>
              <CardDescription className="text-xs">
                Kelola kredensial dan hak akses akun super admin toko
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-lg text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                  <Input defaultValue={siteConfig.adminUser.name} />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Alamat Email Login</label>
                  <Input defaultValue={siteConfig.adminUser.email} disabled />
                  <p className="text-[10px] text-slate-400">Email dikaitkan dengan sesi autentikasi utama.</p>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">Peran & Otorisasi</label>
                  <Input defaultValue={siteConfig.adminUser.role} disabled />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
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
