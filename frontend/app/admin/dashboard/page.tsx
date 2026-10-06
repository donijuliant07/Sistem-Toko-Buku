"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  BookOpen,
  Users,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { analyticsService, orderService, productService } from "@/lib/services";
import { KPICardData, Order, Product } from "@/types";
import { formatRupiah, formatTanggalJam } from "@/lib/utils";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";

export default function DashboardPage() {
  const [kpiData, setKpiData] = React.useState<KPICardData[]>([]);
  const [recentOrders, setRecentOrders] = React.useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadAllData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, ordersRes, stockRes] = await Promise.all([
        analyticsService.getKPIData(),
        orderService.getAll(),
        productService.getLowStock(5),
      ]);
      setKpiData(kpiRes);
      setRecentOrders(ordersRes.slice(0, 5));
      setLowStockItems(stockRes);
    } catch {
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = () => {
    loadAllData().then(() => {
      toast.success("Dashboard Gramedia berhasil diperbarui");
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner Emerald Theme */}
      <div className="bg-gradient-to-r from-[var(--primary-deep)] to-[var(--primary)] rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-white/15 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Gramedia Storefront Admin
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            Selamat Datang, Portal Admin
          </h1>
          <p className="text-xs text-[#E4F1EA] mt-1 max-w-xl">
            Ringkasan transaksi buku, inventori produk terlaris, dan status pesanan hari ini.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="bg-white/15 hover:bg-white/25 text-white border-white/30 hover:border-white/50 text-xs font-semibold gap-1.5 cursor-pointer backdrop-blur-sm rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] text-xs gap-1.5 shadow-sm font-bold cursor-pointer border-none rounded-lg"
          >
            <Link href="/admin/produk">
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Buku</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Ringkasan KPI Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse border-[var(--border)] bg-[var(--surface)]">
              <CardContent className="p-5">
                <div className="h-4 w-24 bg-[var(--surface-muted)] rounded mb-3" />
                <div className="h-8 w-32 bg-[var(--surface-muted)] rounded mb-2" />
                <div className="h-3 w-20 bg-[var(--surface-muted)] rounded" />
              </CardContent>
            </Card>
          ))
        ) : (
          [
            {
              title: kpiData[0]?.title || "Total Judul Buku",
              value: kpiData[0]?.value || "0",
              trend: "Supabase DB",
              desc: kpiData[0]?.description || "Judul terdaftar",
              icon: BookOpen,
              color: "text-[var(--primary)]",
              bgColor: "bg-[var(--primary-soft)]",
            },
            {
              title: kpiData[1]?.title || "Total Stok Fisik",
              value: kpiData[1]?.value || "0 unit",
              trend: "Inventori",
              desc: kpiData[1]?.description || "Total eksemplar",
              icon: Package,
              color: "text-[var(--accent-hover)]",
              bgColor: "bg-[var(--accent-soft)]",
            },
            {
              title: kpiData[2]?.title || "Nilai Inventori",
              value: kpiData[2]?.value || "Rp 0",
              trend: "Estimasi Aset",
              desc: kpiData[2]?.description || "Nilai buku aktif",
              icon: TrendingUp,
              color: "text-[var(--primary)]",
              bgColor: "bg-[var(--primary-soft)]",
            },
            {
              title: kpiData[3]?.title || "Status Stok Kritis",
              value: kpiData[3]?.value || "0 judul",
              trend: "Monitoring",
              desc: kpiData[3]?.description || "Stok aman",
              icon: AlertCircle,
              color: "text-[var(--danger)]",
              bgColor: "bg-[var(--danger-soft)]",
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <Card key={idx} className="border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-[var(--shadow-card)]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                      {item.title}
                    </span>
                    <div className={`p-2 rounded-lg ${item.bgColor} ${item.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--foreground)] tracking-tight">
                    {item.value}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-[var(--success)] bg-[var(--success-soft)] px-1.5 py-0.5 rounded text-[10px]">
                      {item.trend}
                    </span>
                    <span className="text-[var(--muted-foreground)]">{item.desc}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 3. Main Content: Grid Split (Daftar Pesanan & Stok Alert) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Pesanan Terbaru Gramedia */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <CardTitle className="text-base font-extrabold text-[var(--foreground)]">
                  Pesanan Terbaru
                </CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Transaksi belanja terbaru dari website Gramedia Store
                </CardDescription>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary-soft)] gap-1"
              >
                <Link href="/admin/pesanan">
                  <span>Lihat Semua</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-[var(--border)]">
              {loading ? (
                <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">Memuat transaksi...</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">Belum ada pesanan terbaru.</div>
              ) : (
                recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 flex items-center justify-between hover:bg-[var(--surface-muted)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold text-xs shrink-0">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-[var(--foreground)]">
                            {order.orderNumber}
                          </span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                          {order.customerName} • {order.items.length} item
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-xs text-[var(--primary)]">
                        {formatRupiah(order.totalAmount)}
                      </div>
                      <span className="text-[10px] text-[var(--muted-foreground)] block mt-0.5">
                        {formatTanggalJam(order.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Peringatan Stok & Quick Links */}
        <div className="space-y-6">
          {/* Low Stock Warning */}
          <Card className="border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-[var(--shadow-card)]">
            <CardHeader className="pb-3 border-b border-[var(--border)] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-extrabold text-[var(--foreground)] flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
                  <span>Stok Kritis</span>
                </CardTitle>
                <CardDescription className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Buku sisa ≤5 eksemplar
                </CardDescription>
              </div>
              <span className="bg-[var(--danger-soft)] text-[var(--danger)] border border-[#C0392B] opacity-90 px-2 py-0.5 rounded text-[10px] font-bold">
                {lowStockItems.length} Buku
              </span>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {loading ? (
                <div className="text-xs text-[var(--muted-foreground)] text-center py-4">Memuat stok...</div>
              ) : lowStockItems.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)] text-center py-4">Stok aman terkendali.</div>
              ) : (
                lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] border-l-4 border-l-[var(--danger)] bg-[var(--surface-muted)]"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-xs font-bold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                        {item.author}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[var(--danger)] bg-[var(--danger-soft)] px-2 py-0.5 rounded border border-[#C0392B] opacity-90">
                      Sisa {item.stock}
                    </span>
                  </div>
                ))
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] mt-2"
              >
                <Link href="/admin/inventori">
                  <span>Kelola Inventori</span>
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Navigasi Cepat Admin Gramedia */}
          <Card className="border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-[var(--shadow-card)] p-5 space-y-3">
            <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
              Akses Cepat Admin
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/admin/produk"
                className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] transition-colors flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <BookOpen className="h-5 w-5 text-[var(--primary)] group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-[var(--foreground)]">Katalog Buku</span>
              </Link>
              <Link
                href="/admin/promo"
                className="p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <span className="text-base font-extrabold text-[var(--accent-hover)] group-hover:scale-110 transition-transform">%</span>
                <span className="text-xs font-bold text-[var(--foreground)]">Voucher Promo</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}


