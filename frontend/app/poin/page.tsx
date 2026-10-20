"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Coins, ShoppingBag, MessageSquare, PenLine, Sparkles, Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/components/AuthProvider";
import { getMyPointTransactions, getMyRewards } from "@/lib/api";
import type { PointTransactionPage, RewardsMe } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  purchase_reward: "Pembelian buku",
  purchase_reversal: "Pembatalan pesanan",
  review_reward: "Ulasan buku",
  community_reward: "Aktivitas komunitas",
  ai_redemption: "Buka ulasan AI",
  refund: "Pengembalian poin",
  admin_adjustment: "Penyesuaian admin",
};

function typeLabel(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  // Data lama / jenis baru: tampilkan bentuk yang bisa dibaca, bukan kode mentah.
  return type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function PointsContent() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [me, setMe] = useState<RewardsMe | null>(null);
  const [page, setPage] = useState<PointTransactionPage | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyRewards(token)
      .then((data) => active && setMe(data))
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Poin gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyPointTransactions(token, pageNo, 10)
      .then((data) => active && setPage(data))
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Riwayat gagal dimuat.");
      });
    return () => {
      active = false;
    };
  }, [token, pageNo]);

  const refresh = useCallback(() => {
    if (!token) return;
    setError("");
    getMyRewards(token).then(setMe).catch(() => {});
    getMyPointTransactions(token, pageNo, 10).then(setPage).catch(() => {});
  }, [token, pageNo]);

  const loading = !me && !error;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[900px] w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Poin Saya</h1>
        <p className="mt-1 text-sm text-gray-500">
          Kumpulkan poin dari pembelian dan aktivitas, lalu tukarkan untuk membuka ulasan AI ber-spoiler.
        </p>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#0052cc]" />
          </div>
        ) : error && !me ? (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-xs font-medium">
            {error}
          </div>
        ) : (
          <>
            {/* Ringkasan */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-[#0052cc] to-indigo-700 text-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/70">
                  <Coins className="w-4 h-4" /> Saldo Poin
                </div>
                <p className="mt-2 text-3xl font-extrabold tabular-nums">{me?.points ?? 0}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <ShoppingBag className="w-4 h-4" /> Buku Dibeli
                </div>
                <p className="mt-2 text-3xl font-extrabold text-gray-900 tabular-nums">
                  {me?.total_books_bought ?? 0}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <Sparkles className="w-4 h-4" /> Syarat AI Ber-spoiler
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  Medium: <b>{me?.spoiler_access?.medium?.method === "purchase_eligibility" ? "gratis (sudah membeli)" : `${me?.spoiler_access?.medium?.cost ?? "-"} poin`}</b>
                  <br />
                  Berat: <b>{me?.spoiler_access?.heavy?.method === "purchase_eligibility" ? "gratis (sudah membeli)" : `${me?.spoiler_access?.heavy?.cost ?? "-"} poin`}</b>
                </p>
              </div>
            </div>

            {/* Cara mendapat poin */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-extrabold text-gray-900">Cara mendapat poin</h2>
              <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Setiap Rp10.000 belanja yang pesanannya <b>selesai</b> memberi <b>10 poin</b>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <PenLine className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Ulasan buku yang disetujui: <b>20 poin</b> (sekali per buku).</span>
                </li>
                <li className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Kontribusi komunitas & jawaban yang ditandai membantu.</span>
                </li>
              </ul>
            </div>

            {/* Riwayat */}
            <div className="mt-6 bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-gray-900">Riwayat Poin</h2>
                <button
                  type="button"
                  onClick={refresh}
                  className="text-[11px] font-bold text-[#0052cc] hover:underline cursor-pointer"
                >
                  Muat ulang
                </button>
              </div>

              {!page || page.items.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs text-gray-500">
                  Belum ada transaksi poin. Poin pertama akan muncul setelah pesanan selesai.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {page.items.map((item) => (
                    <li key={item.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800">{typeLabel(item.transaction_type)}</p>
                        <p className="text-[11px] text-gray-400">{formatDate(item.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-extrabold tabular-nums ${
                            item.points_delta >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {item.points_delta >= 0 ? "+" : ""}
                          {item.points_delta}
                        </p>
                        <p className="text-[10px] text-gray-400 tabular-nums">Saldo {item.balance_after}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {page && page.total_pages > 1 && (
                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <button
                    type="button"
                    disabled={pageNo <= 1}
                    onClick={() => setPageNo((n) => Math.max(1, n - 1))}
                    className="inline-flex items-center gap-1 font-bold text-[#0052cc] disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" /> Sebelumnya
                  </button>
                  <span>
                    Halaman {pageNo} dari {page.total_pages}
                  </span>
                  <button
                    type="button"
                    disabled={pageNo >= page.total_pages}
                    onClick={() => setPageNo((n) => n + 1)}
                    className="inline-flex items-center gap-1 font-bold text-[#0052cc] disabled:text-gray-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Berikutnya <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <p className="mt-4 text-[11px] text-gray-400">
              Buka ulasan AI ber-spoiler dari halaman detail buku.{" "}
              <Link href="/" className="text-[#0052cc] font-semibold hover:underline">
                Jelajahi katalog
              </Link>
            </p>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function PointsPage() {
  return (
    <RequireRole role="user">
      <PointsContent />
    </RequireRole>
  );
}
