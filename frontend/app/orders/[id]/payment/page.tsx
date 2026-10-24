"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Clock3, History } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/components/AuthProvider";
import { getOrder, getOrderPayment } from "@/lib/api";
import { formatRupiah } from "@/components/ProductCard";
import { PaymentViewBadge } from "@/components/payment/PaymentViewBadge";
import { QrisSimulationCard } from "@/components/payment/QrisSimulationCard";
import { ProofUpload } from "@/components/payment/ProofUpload";
import { ProofPreview } from "@/components/payment/ProofPreview";
import type { Order, OrderPayment } from "@/lib/types";

const PROOF_STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu verifikasi",
  approved: "Disetujui",
  rejected: "Ditolak",
  superseded: "Diganti bukti baru",
};

function PaymentContent() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token;

  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !session) {
      router.replace(`/login?redirect=/orders/${orderId}/payment`);
    }
  }, [authLoading, session, router, orderId]);

  const load = useCallback(() => {
    if (!token || !orderId) return () => {};
    let active = true;
    setLoading(true);
    Promise.all([getOrder(orderId, token), getOrderPayment(orderId, token)])
      .then(([orderRes, paymentRes]) => {
        if (!active) return;
        setOrder(orderRes.data);
        setPayment(paymentRes.data);
        setError("");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Pembayaran gagal dimuat.");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, orderId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- skeleton setiap kali sesi/pesanan berubah sebelum fetch
  useEffect(load, [load]);

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

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h1 className="mt-3 text-lg font-extrabold text-gray-900">Pembayaran tidak dapat ditampilkan</h1>
            <p className="mt-1 text-sm text-gray-500">{error || "Data pembayaran tidak ditemukan."}</p>
            <Link
              href={`/orders/${orderId}`}
              className="mt-5 inline-flex px-5 py-2.5 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-xl text-xs font-extrabold transition-colors"
            >
              Kembali ke Pesanan
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const history = [...payment.history].reverse();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-8">
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke detail pesanan
        </Link>

        <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Pembayaran Pesanan
              </p>
              <h1 className="text-xl font-extrabold text-gray-900">
                {order?.order_number ?? orderId}
              </h1>
              <p className="mt-1 text-xs text-gray-500">
                Total tagihan {formatRupiah(payment.amount)}
              </p>
            </div>
            <PaymentViewBadge status={payment.status} />
          </div>

          {payment.status === "under_review" && (
            <p className="mt-4 flex items-start gap-1.5 rounded-xl bg-sky-50 border border-sky-200 px-3 py-2.5 text-[11px] font-semibold text-sky-800">
              <Clock3 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Bukti sudah diterima dan sedang diperiksa admin. Status belum lunas sampai admin
              menyetujuinya.
            </p>
          )}

          {payment.status === "rejected" && (
            <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5">
              <p className="text-[11px] font-extrabold text-rose-800">Bukti ditolak admin</p>
              <p className="mt-1 text-xs text-rose-700 whitespace-pre-line">
                {payment.rejection_reason ?? "Alasan tidak dicatat. Hubungi admin untuk keterangan."}
              </p>
              <p className="mt-1.5 text-[11px] text-rose-600">
                Silakan unggah ulang bukti yang benar di bawah.
              </p>
            </div>
          )}

          {payment.status === "paid" && (
            <p className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-[11px] font-semibold text-emerald-800">
              Pembayaran sudah dikonfirmasi admin
              {payment.verified_at
                ? ` pada ${new Date(payment.verified_at).toLocaleString("id-ID")}`
                : ""}
              . Pesanan akan segera diproses.
            </p>
          )}

          {(payment.status === "expired" || payment.status === "refunded") && (
            <p className="mt-4 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-[11px] font-semibold text-gray-700">
              {payment.status === "expired"
                ? "Batas waktu pembayaran sudah lewat. Pesanan ini tidak dapat dibayar lagi."
                : "Dana pembayaran sudah dikembalikan."}
            </p>
          )}
        </div>

        {payment.status !== "paid" && (
          <div className="mt-5">
            <QrisSimulationCard amount={payment.amount} />
          </div>
        )}

        <section className="mt-5 bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-extrabold text-gray-900">
            {payment.status === "rejected" ? "Unggah ulang bukti" : "Unggah bukti transfer"}
          </h2>
          <p className="mt-1 mb-3 text-[11px] text-gray-500">
            Pastikan nominal, nama pengirim, dan waktu transfer terlihat jelas.
          </p>
          <ProofUpload
            orderId={orderId}
            accessToken={token ?? ""}
            canSubmit={payment.can_submit}
            onUploaded={(next) => {
              setPayment(next);
              load();
            }}
          />
        </section>

        <section className="mt-5 bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-gray-900">
            <History className="w-4 h-4 text-gray-400" />
            Riwayat bukti
          </h2>
          {history.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">Belum ada bukti yang diunggah.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {history.map((proof) => (
                <li key={proof.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-gray-800">
                      {PROOF_STATUS_LABELS[proof.status] ?? proof.status}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {new Date(proof.uploaded_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="mt-2 max-w-xs">
                    <ProofPreview proof={proof} />
                  </div>
                  {proof.review_note && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                      Catatan admin: {proof.review_note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}

// Admin memverifikasi lewat dashboard admin, bukan halaman pelanggan ini.
export default function OrderPaymentPage() {
  return (
    <RequireRole role="user">
      <PaymentContent />
    </RequireRole>
  );
}
