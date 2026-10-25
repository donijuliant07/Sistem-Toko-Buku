"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShoppingBag,
  BookOpen,
  Users,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { analyticsService, orderService } from "@/lib/services";
import { getLowStockProducts } from "@/lib/api";
import { KPICardData, Order } from "@/types";
import type { LowStockBook } from "@/lib/types";
import { formatRupiah, formatTanggalJam } from "@/lib/utils";
import { toast } from "sonner";
import { OrderStatusBadge } from "@/components/admin/StatusBadge";

export default function DashboardPage() {
  const [kpiData, setKpiData] = React.useState<KPICardData[]>([]);
  const [recentOrders, setRecentOrders] = React.useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = React.useState<LowStockBook[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadAllData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, ordersRes, stockRes] = await Promise.all([
        analyticsService.getKPIData(),
        orderService.getAll(),
        getLowStockProducts(),
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data awal saat mount; `loading` sudah true sejak awal
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = () => {
    loadAllData().then(() => {
      toast.success("Dashboard Readr berhasil diperbarui");
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner AlignUI Pro Theme */}
      <div className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 tracking-wider uppercase">
              PRO Admin
            </span>
            <span className="text-zinc-400 text-xs">•</span>
            <span className="text-xs font-medium text-zinc-500">
              Readr Storefront
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Selamat Datang di Portal Admin
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-xl font-normal leading-relaxed">
            Ringkasan transaksi buku, inventori produk terlaris, dan status
            pesanan hari ini.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-300 font-semibold text-xs gap-1.5 cursor-pointer rounded-xl transition-all shadow-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-zinc-600 ${loading ? "animate-spin" : ""}`}
            />
            <span>Segarkan</span>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-zinc-900 hover:bg-zinc-800 text-white text-xs gap-1.5 font-medium cursor-pointer rounded-xl transition-all shadow-xs"
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
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                className="animate-pulse border-zinc-200/80 bg-white rounded-2xl shadow-xs"
              >
                <CardContent className="p-5">
                  <div className="h-4 w-24 bg-zinc-100 rounded mb-3" />
                  <div className="h-8 w-32 bg-zinc-100 rounded mb-2" />
                  <div className="h-3 w-20 bg-zinc-100 rounded" />
                </CardContent>
              </Card>
            ))
          : [
              {
                title: kpiData[0]?.title || "Total Pendapatan",
                value: kpiData[0]?.value || "Rp 0",
                trend: "Supabase DB",
                trendColor:
                  "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                desc: kpiData[0]?.description || "Pesanan tercatat",
                icon: Wallet,
                color: "text-zinc-800",
                bgColor: "bg-zinc-100",
              },
              {
                title: kpiData[1]?.title || "Pesanan Baru",
                value: kpiData[1]?.value || "0",
                trend: "Inventori",
                trendColor: "bg-blue-50 text-blue-700 border-blue-200/60",
                desc: kpiData[1]?.description || "Menunggu proses",
                icon: ShoppingBag,
                color: "text-blue-600",
                bgColor: "bg-blue-50",
              },
              {
                title: kpiData[2]?.title || "Pelanggan Aktif",
                value: kpiData[2]?.value || "0",
                trend: "Estimasi Aset",
                trendColor:
                  "bg-emerald-50 text-emerald-700 border-emerald-200/60",
                desc: kpiData[2]?.description || "Pemesan unik",
                icon: Users,
                color: "text-indigo-600",
                bgColor: "bg-indigo-50",
              },
              {
                title: kpiData[3]?.title || "Total Judul Buku",
                value: kpiData[3]?.value || "0",
                trend: "Monitoring",
                trendColor: "bg-zinc-100 text-zinc-700 border-zinc-200/60",
                desc: kpiData[3]?.description || "Judul di database",
                icon: BookOpen,
                color: "text-emerald-700",
                bgColor: "bg-emerald-50",
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <Card
                  key={idx}
                  className="border-zinc-200/80 bg-white rounded-2xl shadow-xs hover:border-zinc-300 hover:shadow-sm transition-all"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-500 tracking-tight">
                        {item.title}
                      </span>
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center ${item.bgColor} ${item.color} shadow-2xs`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <div className="mt-3 text-2xl sm:text-[28px] font-bold text-zinc-900 tracking-tight tabular-nums">
                      {item.value}
                    </div>
                    <div className="mt-3 space-y-1.5 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap ${item.trendColor}`}
                      >
                        {item.trend}
                      </span>
                      <p className="text-zinc-500 leading-snug">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* 3. Main Content: Grid Split (Daftar Pesanan & Stok Alert) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Pesanan Terbaru Readr */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-zinc-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between p-5 pb-4 border-b border-zinc-100">
              <div>
                <CardTitle className="text-base font-bold text-zinc-900 tracking-tight">
                  Pesanan Terbaru
                </CardTitle>
                <CardDescription className="text-xs text-zinc-600 font-medium mt-0.5">
                  Transaksi belanja terbaru dari website Readr Store
                </CardDescription>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100/80 rounded-xl gap-1 transition-colors"
              >
                <Link href="/admin/pesanan">
                  <span>Lihat Semua</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-zinc-100">
              {loading ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Memuat transaksi...
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Belum ada pesanan terbaru.
                </div>
              ) : (
                recentOrders.map((order) => {
                  const initials = order.customerName
                    ? order.customerName
                        .trim()
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()
                    : "PL";
                  return (
                    <div
                      key={order.id}
                      className="p-4 flex items-center justify-between hover:bg-zinc-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-800 font-bold text-xs flex items-center justify-center shrink-0 border border-zinc-200/80 shadow-2xs">
                          {initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-zinc-900 font-mono">
                              {order.orderNumber}
                            </span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <p className="text-xs text-zinc-600 mt-1 font-medium">
                            <span className="text-zinc-800 font-semibold">
                              {order.customerName}
                            </span>
                            <span className="text-zinc-400 mx-1.5">•</span>
                            <span className="text-zinc-500">
                              {order.items.length} item
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 pl-3">
                        <div className="font-bold text-sm sm:text-base text-zinc-900 tabular-nums">
                          {formatRupiah(order.totalAmount)}
                        </div>
                        <span className="text-[11px] text-zinc-400 block mt-0.5">
                          {formatTanggalJam(order.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Peringatan Stok & Quick Links */}
        <div className="space-y-6">
          {/* Low Stock Warning */}
          <Card className="border-zinc-200/80 bg-white rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-5 pb-3.5 border-b border-zinc-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-zinc-900 flex items-center gap-1.5 tracking-tight">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span>Stok Kritis</span>
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 mt-0.5">
                  Buku sisa ≤5 eksemplar
                </CardDescription>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                {lowStockItems.length} Buku
              </span>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {loading ? (
                <div className="text-xs text-zinc-400 text-center py-4">
                  Memuat stok...
                </div>
              ) : lowStockItems.length === 0 ? (
                <div className="text-xs text-zinc-400 text-center py-4">
                  Stok aman terkendali.
                </div>
              ) : (
                lowStockItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 bg-zinc-50/60 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="truncate text-xs font-semibold text-zinc-900">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {item.author}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-lg shrink-0">
                      Sisa {item.stock}
                    </span>
                  </div>
                ))
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-zinc-200 hover:border-zinc-300 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 rounded-xl font-medium shadow-2xs mt-2"
              >
                <Link href="/admin/inventori">
                  <span>Kelola Inventori</span>
                  <ArrowUpRight className="h-3.5 w-3.5 ml-1 text-zinc-500" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Navigasi Cepat Admin Readr */}
          <Card className="border-zinc-200/80 bg-white rounded-2xl shadow-xs p-5 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-600 tracking-tight">
              Akses Cepat Admin
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/admin/produk"
                className="p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/50 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-100 group-hover:bg-zinc-200/80 text-zinc-700 flex items-center justify-center transition-colors">
                  <BookOpen className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-800">
                  Katalog Buku
                </span>
              </Link>
              <Link
                href="/admin/promo"
                className="p-3.5 rounded-xl border border-zinc-200/70 bg-zinc-50/50 hover:bg-zinc-100/70 hover:border-zinc-300 transition-all flex flex-col items-center justify-center text-center gap-1.5 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors font-bold text-xs">
                  %
                </div>
                <span className="text-xs font-semibold text-zinc-800">
                  Voucher Promo
                </span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
