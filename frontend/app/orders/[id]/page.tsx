"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Wallet } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";
import { getOrder } from "@/lib/api";
import { formatRupiah } from "@/components/ProductCard";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  paid: "bg-sky-100 text-sky-800 border-sky-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  expired: "bg-slate-100 text-slate-700 border-slate-200",
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-rose-100 text-rose-800 border-rose-200",
  expired: "bg-slate-100 text-slate-700 border-slate-200",
  refunded: "bg-slate-100 text-slate-700 border-slate-200",
};

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Belum Bayar",
  success: "Sudah Bayar",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Refund",
};

function Pill({ text, className }: { text: string; className: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${className}`}>
      {text}
    </span>
  );
}

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { session, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?redirect=/orders/${id}`);
    }
  }, [authLoading, session, router, id]);

  useEffect(() => {
    if (!session?.access_token || !id) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tampilkan skeleton setiap kali id/sesi berubah sebelum fetch
    setLoading(true);
    getOrder(id, session.access_token)
      .then((res) => active && setOrder(res.data))
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Pesanan gagal dimuat.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session, id]);

  if (authLoading || (loading && !error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#0052cc] border-t-transparent rounded-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h1 className="mt-3 text-lg font-extrabold text-gray-900">Pesanan tidak dapat ditampilkan</h1>
            <p className="mt-1 text-sm text-gray-500">{error || "Pesanan tidak ditemukan."}</p>
            <Link
              href="/"
              className="mt-5 inline-flex px-5 py-2.5 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-xl text-xs font-extrabold transition-colors"
            >
              Kembali ke Katalog
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nomor Pesanan</p>
              <h1 className="text-xl font-extrabold text-gray-900">{order.order_number}</h1>
              <p className="mt-1 text-xs text-gray-500">
                Dibuat {new Date(order.created_at).toLocaleString("id-ID")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill text={ORDER_STATUS_LABELS[order.status]} className={ORDER_STATUS_STYLES[order.status]} />
              <Pill text={PAYMENT_STATUS_LABELS[order.payment_status]} className={PAYMENT_STATUS_STYLES[order.payment_status]} />
            </div>
          </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
          <p className="flex-1 text-[11px] font-medium text-amber-800">
            Pembayaran belum terhubung ke payment gateway. Unggah bukti transfer, lalu admin
            memverifikasinya secara manual.
          </p>
          <Link
            href={`/orders/${order.id}/payment`}
            className="inline-flex shrink-0 items-center gap-1.5 px-4 py-2 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-xl text-[11px] font-extrabold transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            {order.payment_status === "pending" ? "Bayar & unggah bukti" : "Lihat pembayaran"}
          </Link>
        </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-extrabold text-gray-900">Alamat Pengiriman</h2>
            <p className="mt-2 text-xs font-bold text-gray-800">{order.customer_name}</p>
            <p className="text-xs text-gray-500">{order.customer_phone}</p>
            <p className="text-xs text-gray-500 break-words">{order.customer_email}</p>
            <p className="mt-2 text-xs text-gray-600 whitespace-pre-line">{order.shipping_address}</p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-extrabold text-gray-900">Pengiriman &amp; Pembayaran</h2>
            <dl className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Kurir</dt>
                <dd className="font-bold text-gray-800 text-right">{order.courier}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Metode Bayar</dt>
                <dd className="font-bold text-gray-800 text-right">{order.payment_method}</dd>
              </div>
              {order.tracking_number && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">No. Resi</dt>
                  <dd className="font-bold text-gray-800 text-right">{order.tracking_number}</dd>
                </div>
              )}
              {order.notes && (
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Catatan</dt>
                  <dd className="font-medium text-gray-700 text-right break-words">{order.notes}</dd>
                </div>
              )}
            </dl>
          </section>
        </div>

        <section className="mt-5 bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-extrabold text-gray-900">Item Pesanan</h2>
          <div className="mt-3 divide-y divide-gray-100">
            {(order.items ?? []).map((item) => (
              <div key={item.id} className="py-3 flex items-center gap-3">
                <div className="w-10 h-14 bg-gray-50 rounded-md border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden">
                  {item.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_url} alt={item.title ?? "Cover buku"} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400">📖</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{item.title}</p>
                  <p className="text-[11px] text-gray-400">{item.author}</p>
                  <p className="text-[11px] text-gray-500">
                    {item.quantity} × {formatRupiah(item.unit_price)}
                  </p>
                </div>
                <span className="text-xs font-extrabold text-gray-900">
                  {formatRupiah(item.total_price)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold text-gray-900">{formatRupiah(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Ongkos Kirim</span>
              <span className="font-bold text-gray-900">{formatRupiah(order.shipping_fee)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Diskon</span>
                <span className="font-bold text-emerald-600">-{formatRupiah(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-extrabold text-base text-[#0052cc]">
                {formatRupiah(order.total_amount)}
              </span>
            </div>
          </div>
        </section>

        <Link
          href="/"
          className="mt-5 inline-flex px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-extrabold transition-colors"
        >
          Lanjut belanja
        </Link>
      </main>

      <Footer />
    </div>
  );
}

// Admin mengelola pesanan lewat dashboard admin, bukan alur pelanggan.
export default function OrderDetailPage() {
  return (
    <RequireRole role="user">
      <OrderDetailContent />
    </RequireRole>
  );
}
