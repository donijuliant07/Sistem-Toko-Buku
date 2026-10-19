"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { getMyOrders } from "@/lib/api";
import { formatRupiah } from "@/components/ProductCard";
import type { OrderPage, OrderStatus, PaymentStatus } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Belum Bayar",
  success: "Sudah Bayar",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Refund",
};

function OrdersContent() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();

  const [page, setPage] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login?redirect=/orders");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tampilkan skeleton setiap kali sesi berubah sebelum fetch
    setLoading(true);
    getMyOrders(session.access_token)
      .then((res) => active && setPage(res))
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Daftar pesanan gagal dimuat.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  const orders = page?.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-gray-500">Riwayat pesanan yang Anda buat.</p>

        {authLoading || loading ? (
          <div className="mt-12 flex justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#0052cc] border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-medium">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <span className="text-4xl">🧾</span>
            <p className="mt-3 text-sm font-extrabold text-gray-800">Belum ada pesanan</p>
            <p className="mt-1 text-xs text-gray-500">Pesanan Anda akan muncul di sini setelah checkout.</p>
            <Link
              href="/"
              className="mt-5 inline-flex px-5 py-2.5 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-xl text-xs font-extrabold transition-colors"
            >
              Jelajahi Katalog
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block bg-white rounded-2xl border border-gray-100 p-4 hover:border-[#0052cc]/40 hover:shadow-sm transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-gray-900">{order.order_number}</p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(order.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {PAYMENT_STATUS_LABELS[order.payment_status]}
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500">{order.items?.length ?? 0} item</span>
                  <span className="font-extrabold text-gray-900">{formatRupiah(order.total_amount)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// Admin mengelola pesanan lewat dashboard admin, bukan alur pelanggan.
export default function OrdersPage() {
  return (
    <RequireRole role="user">
      <OrdersContent />
    </RequireRole>
  );
}
