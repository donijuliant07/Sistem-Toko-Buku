"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Lock,
  RefreshCw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { formatRupiah } from "@/components/ProductCard";
import { getMarketplacePrices } from "@/lib/api";
import { ThinkingState, type ThinkingStep } from "@/components/ui/thinking-state";
import {
  MARKETS_QUICK_PICK,
  MarketplaceMark,
  marketplaceColor,
  marketplaceLabel,
  marketplaceSources,
} from "@/components/books/marketplace-sources";
import type {
  MarketplaceComparison,
  MarketplaceHistoryPoint,
  MarketplaceQuote,
} from "@/lib/types";

interface ComparePriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  /** Harga toko sendiri; `null` selama `GET /books/{id}` belum selesai. */
  storePrice: number | null;
  /** Token sesi Supabase. `null` = belum login (pemanggil sudah menanganinya). */
  accessToken: string | null;
}

/** Satu angka harga dari backend (Decimal) — dinormalkan sebelum dihitung. */
function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Selisih harga toko dibanding satu kutipan: positif = toko lebih mahal, negatif = toko lebih murah */
function priceGap(storePrice: number | null, quotePrice: string | number): number | null {
  const store = toNumber(storePrice);
  const price = toNumber(quotePrice);
  if (store === null || price === null) return null;
  return store - price;
}

/** Grafik garis kecil tren riwayat harga tanpa dependensi chart eksternal */
function PriceSparkline({ points }: { points: MarketplaceHistoryPoint[] }) {
  const values = points
    .map((point) => toNumber(point.price))
    .filter((v): v is number => v !== null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 100 / (values.length - 1);

  const path = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"} ${index * step} ${28 - ((value - min) / span) * 22}`
    )
    .join(" ");

  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-gray-50/80 px-2.5 py-1.5 border border-gray-100">
      <div className="flex flex-col">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">
          Tren Harga
        </span>
        <span className="text-[10px] text-gray-600 font-medium">
          {formatRupiah(min)} – {formatRupiah(max)}
        </span>
      </div>
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="h-5 w-16 text-[#0052cc] shrink-0 ml-auto"
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">
        {values.length}x catat
      </span>
    </div>
  );
}

/** Komponen Skeleton Loading */
function CompareSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-2xl bg-blue-50/50 border border-blue-100/60" />
      <div className="h-24 rounded-2xl bg-gray-100 border border-gray-200" />
      <div className="h-24 rounded-2xl bg-gray-100 border border-gray-200" />
      <div className="h-24 rounded-2xl bg-gray-100 border border-gray-200" />
    </div>
  );
}

/** Satu baris kartu penawaran marketplace */
function QuoteRow({
  quote,
  storePrice,
  history,
  isCheapest,
  variant = "valid",
}: {
  quote: MarketplaceQuote;
  storePrice: number | null;
  history: MarketplaceHistoryPoint[] | undefined;
  isCheapest: boolean;
  variant?: "valid" | "review" | "rejected";
}) {
  const gap = priceGap(storePrice, quote.price);
  const cheaper = gap !== null && gap > 0;
  const label = marketplaceLabel(quote.marketplace, quote.label);

  const isReview = variant === "review" || quote.validation_status === "review";
  const isRejected = variant === "rejected" || quote.validation_status === "rejected";

  return (
    <li
      className={`group relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-4 pl-5 transition-all duration-200 ${
        isRejected
          ? "border-gray-200 bg-gray-50/70 opacity-80"
          : isReview
          ? "border-amber-200 bg-amber-50/30 hover:border-amber-300"
          : isCheapest
          ? "border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-xs"
          : "border-gray-200/80 bg-white hover:border-blue-200 hover:shadow-xs"
      }`}
    >
      {/* Pita warna merek di tepi kiri: pengenal toko yang terbaca sebelum teks */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${isRejected ? "opacity-35" : ""}`}
        style={{ backgroundColor: marketplaceColor(quote.marketplace) }}
      />
      <div className="flex items-start justify-between gap-3">
        {/* Marketplace & Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <MarketplaceMark
              slug={quote.marketplace}
              label={label}
              height={isRejected ? 15 : 16}
              tone={isRejected ? "muted" : "full"}
              className="max-w-full"
            />
            {isCheapest && !isRejected && !isReview && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-xs">
                <Sparkles className="h-2.5 w-2.5" />
                Harga Terendah (Valid)
              </span>
            )}

            {isReview && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                <AlertCircle className="h-2.5 w-2.5" />
                Perlu Diperiksa
              </span>
            )}

            {isRejected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                Disaring
              </span>
            )}

            {quote.is_outlier && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                Indikasi Anomali Harga {quote.deviation_percent ? `(${quote.deviation_percent > 0 ? "+" : ""}${quote.deviation_percent.toFixed(0)}%)` : ""}
              </span>
            )}

            {quote.attributes?.is_used && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                Buku Bekas
              </span>
            )}

            {quote.attributes?.is_preorder && (
              <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                Preorder
              </span>
            )}

            {quote.in_stock === false && (
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 border border-rose-200">
                Stok habis
              </span>
            )}

            {quote.source === "admin_url" && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                Tautan Resmi
              </span>
            )}

            {quote.source === "mock" && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                Data Contoh
              </span>
            )}
          </div>

          {quote.product_title && (
            <p
              className={`mt-2 line-clamp-1 text-xs font-semibold ${isRejected ? "text-gray-500 line-through" : "text-gray-800"}`}
              title={quote.product_title}
            >
              {quote.product_title}
            </p>
          )}

          {quote.seller_name && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
              <Store className="h-3 w-3 text-gray-400 shrink-0" />
              <span className="truncate">Penjual: {quote.seller_name}</span>
            </p>
          )}

          {/* Catatan / Alasan Validasi */}
          {quote.reasons && quote.reasons.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 rounded-lg bg-gray-50/90 p-2 text-[10px] text-gray-600 border border-gray-100">
              {quote.reasons.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-1">
                  <span className="text-gray-400">•</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Harga & Status Komparasi */}
        <div className="flex flex-col items-end shrink-0">
          <span className={`text-base font-black whitespace-nowrap ${isRejected ? "text-gray-400 line-through" : "text-[#0052cc]"}`}>
            {formatRupiah(quote.price)}
          </span>

          {!isRejected && gap !== null && gap !== 0 && (
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold whitespace-nowrap ${
                cheaper
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {cheaper ? (
                <>
                  <TrendingDown className="h-3 w-3 text-emerald-600" />
                  Hemat {formatRupiah(Math.abs(gap))}
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 text-gray-500" />
                  Lebih mahal {formatRupiah(Math.abs(gap))}
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Tren Harga Sparkline */}
      {history && history.length > 1 && <PriceSparkline points={history} />}

      {/* Tombol Aksi Tautan Luar */}
      {quote.product_url && (
        <div className="mt-1 pt-2.5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] text-gray-400">
            {isRejected ? "Listing marketplace (tidak direkomendasikan)" : `Kunjungi listing langsung di ${label}`}
          </span>
          <a
            href={quote.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 hover:bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0052cc] border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <span>Buka {label}</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </li>
  );
}

export default function ComparePriceModal({
  isOpen,
  onClose,
  bookId,
  bookTitle,
  storePrice,
  accessToken,
}: ComparePriceModalProps) {
  const [data, setData] = useState<MarketplaceComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showRejected, setShowRejected] = useState(false);

  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const resultIsForCurrentBook = loadedFor === bookId;

  // Permintaan aktif, disimpan di ref agar bisa dibatalkan (tombol Batal,
  // penutupan modal) — backend lambat tidak boleh terus berjalan diam-diam.
  const inFlight = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
  }, []);

  // Countdown timer untuk rate limiting refresh 60 detik
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!accessToken) return;
      abortInFlight();
      const controller = new AbortController();
      inFlight.current = controller;
      setLoading(true);
      setError("");
      try {
        const res = await getMarketplacePrices(bookId, accessToken, {
          refresh,
          signal: controller.signal,
        });
        setData(res.data);
        setLoadedFor(bookId);
        if (refresh) {
          setCooldownSeconds(60);
        }
      } catch (cause) {
        // Dibatalkan (modal ditutup / diganti permintaan baru): bukan kegagalan.
        // Bila tidak ada permintaan pengganti, lepaskan status memuat supaya
        // buka berikutnya tidak mewarisi spinner dari request yang sudah mati.
        if (controller.signal.aborted) {
          if (inFlight.current !== controller) setLoading(false);
          return;
        }
        // Refresh gagal: lepaskan hasil lama supaya layar error (`failed`) yang tampil,
        // bukan angka basi yang terlihat seperti harga terkini.
        setLoadedFor(null);
        setError(cause instanceof Error ? cause.message : "Gagal membandingkan harga.");
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setLoading(false);
        }
      }
    },
    [accessToken, bookId, abortInFlight]
  );

  // Saat ditutup, permintaan yang masih jalan dibatalkan lewat `abortInFlight`
  // (ref, bukan state — aman di badan effect). Status "sedang memuat" tidak
  // perlu dilepas di sini: effect pengambilan melepasnya di cleanup saat modal
  // tertutup, dan pemanggil `load()` yang dilewati begitu controller-nya
  // dibatalkan (lihat cabang `controller.signal.aborted`).
  useEffect(() => {
    if (isOpen) return;
    abortInFlight();
  }, [isOpen, abortInFlight]);

  // Satu pengambilan saat modal dibuka — memakai cache backend bila masih segar.
  // Tidak ada setState di badan effect ini: keadaan "sedang memuat" diturunkan
  // dari ketiadaan hasil untuk buku ini (lihat `busy`), dan `loading` hanya
  // disentuh dari jalur `load()` (refresh manual).
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    let active = true;
    const controller = new AbortController();
    inFlight.current = controller;
    getMarketplacePrices(bookId, accessToken, { signal: controller.signal })
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setLoadedFor(bookId);
        setError("");
      })
      .catch((cause: unknown) => {
        // Dibatalkan (modal ditutup / pindah buku): bukan kegagalan, diam saja.
        if (!active || controller.signal.aborted) return;
        setData(null);
        setError(cause instanceof Error ? cause.message : "Gagal membandingkan harga.");
      });
    return () => {
      active = false;
      controller.abort();
      if (inFlight.current === controller) inFlight.current = null;
    };
  }, [isOpen, accessToken, bookId]);

  const comparisonSteps: ThinkingStep[] = useMemo(
    () => [
      {
        kind: "search",
        label: "Menelusuri marketplace Indonesia",
        activeLabel: `Mencari harga di ${MARKETS_QUICK_PICK.slice(0, 3).map((slug) => marketplaceLabel(slug)).join(", ")}...`,
        sources: marketplaceSources(MARKETS_QUICK_PICK.slice(0, 4)),
        moreSources: marketplaceSources(MARKETS_QUICK_PICK.slice(4)),
      },
      {
        kind: "step",
        label: `Mengekstrak harga & stok seller untuk "${bookTitle}"`,
        activeLabel: "Mengekstrak harga & mengecek ketersediaan stok...",
      },
      {
        kind: "step",
        label: "Mengkalkulasi selisih harga terbaik & potensi hemat",
        activeLabel: "Menghitung selisih harga termurah...",
      },
    ],
    [bookTitle]
  );

  // Early return dipindah setelah semua hook: urutan hook harus sama di setiap render.
  if (!isOpen) return null;

  const effectiveStorePrice = toNumber(storePrice) ?? toNumber(data?.store_price ?? null);
  const savings = toNumber(data?.savings ?? null);
  const lowestMarketplacePrice = toNumber(data?.lowest_price ?? null);

  const validQuotes = (data?.valid_offers && data.valid_offers.length > 0)
    ? data.valid_offers
    : (data?.quotes ?? []);
  const reviewQuotes = data?.review_offers ?? [];
  const rejectedQuotes = data?.rejected_offers ?? [];
  const totalOffersCount = validQuotes.length + reviewQuotes.length + rejectedQuotes.length;
  const hasMockQuotes = (data?.quotes ?? []).some((quote) => quote.source === "mock");

  // Status apakah toko sendiri termurah
  const isStoreCheapest =
    effectiveStorePrice !== null &&
    lowestMarketplacePrice !== null &&
    effectiveStorePrice <= lowestMarketplacePrice;

  // Empat keadaan tampilan, tanpa setState di badan effect:
  // belum login · sedang memuat · gagal · hasil. "Sedang memuat" = belum ada
  // hasil/error untuk buku ini, atau refresh manual sedang berjalan.
  const busy = !resultIsForCurrentBook || loading;
  const failed = !!error && !resultIsForCurrentBook;
  const ready = resultIsForCurrentBook && !!data;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Bandingkan harga ${bookTitle}`}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-[#0052cc]">
                <Scale className="h-4 w-4" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900">
                Perbandingan Harga Buku
              </h3>
            </div>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-600" title={bookTitle}>
              {bookTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Konten */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!accessToken ? (
            /* Bila belum login */
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Lock className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-gray-800">Perlu Masuk Akun</p>
              <p className="max-w-xs text-xs text-gray-500">
                Fitur perbandingan harga lintas marketplace hanya tersedia untuk pelanggan yang telah masuk.
              </p>
              <Link
                href="/login"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#0052cc] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#0041a3] transition-all"
              >
                Masuk Sekarang
              </Link>
            </div>
          ) : busy ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 shadow-2xs">
                <ThinkingState
                  steps={comparisonSteps}
                  thinkingLabel="Menganalisis harga"
                  workedLabel="Diproses dalam"
                  doneLabel="Selesai membandingkan harga"
                  stepMs={800}
                  isDone={false}
                  initialOpen={true}
                />
              </div>
              <CompareSkeleton />
              {/* Jalan keluar saat backend lambat: hentikan permintaan alih-alih
                  menunggu sampai batas waktu permintaan habis. */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all"
                >
                  <X className="h-3.5 w-3.5" />
                  Batal &amp; Tutup
                </button>
              </div>
            </div>
          ) : failed ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-gray-800">Gagal Memuat Data</p>
              <p className="max-w-xs text-xs text-gray-500">{error}</p>
              <button
                type="button"
                onClick={() => load(false)}
                className="mt-2 rounded-xl bg-[#0052cc] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#0041a3] transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {/* Thinking State affectUI untuk Perbandingan Harga Buku */}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5 shadow-2xs">
                <ThinkingState
                  steps={comparisonSteps}
                  thinkingLabel="Menganalisis harga"
                  workedLabel="Diproses dalam"
                  doneLabel="Selesai membandingkan harga"
                  stepMs={800}
                  isDone={!loading}
                  initialOpen={loading}
                />
              </div>
              {/* Spanduk Peringatan Data Demo (Bila ada mock) */}
              {hasMockQuotes && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/80 p-3.5 text-amber-900 shadow-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed">
                    Sebagian angka di bawah adalah <strong>data contoh (demo)</strong>, bukan harga riil dari marketplace luar.
                  </p>
                </div>
              )}

              {/* Kartu Harga Toko Sendiri (Pembanding Utama) */}
              <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-500 to-[#0052cc] p-4 text-white shadow-md">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-blue-100">
                      <ShoppingBag className="h-3 w-3" />
                      Harga di Toko Kami
                    </span>
                    <p className="mt-0.5 text-xs text-blue-100">
                      Stok resmi & siap kirim dari gudang kami
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black tracking-tight text-white">
                      {effectiveStorePrice === null ? "—" : formatRupiah(effectiveStorePrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Ringkasan Perbandingan */}
              {totalOffersCount > 0 && (
                <>
                  {/* Status Validasi AI & Statistik Pasar */}
                  {data && (
                    <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {data.ai_validation_status === "completed" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                              <Sparkles className="h-3 w-3 text-blue-600" />
                              Validasi AI Aktif
                            </span>
                          ) : data.ai_validation_status === "error" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Analisis AI Kendala (Filter Deterministik)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              Validasi Aturan Deterministik
                            </span>
                          )}
                          <span className="text-[11px] text-gray-500">
                            {data.ai_validation_status === "completed"
                              ? "Kecocokan produk & kewajaran harga dianalisis model AI"
                              : "Difilter aturan integritas data, format produk, & deviasi harga"}
                          </span>
                        </div>

                        {data.price_statistics?.median_price && (
                          <span className="text-[11px] font-bold text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                            Median Pasar: {formatRupiah(data.price_statistics.median_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {isStoreCheapest ? (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-950">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-xs font-black text-emerald-900">
                          Toko Kami Adalah Pilihan Paling Hemat!
                        </p>
                        <p className="mt-0.5 text-[11px] text-emerald-800">
                          Harga kami lebih terjangkau atau setara dibanding harga marketplace luar yang lolos validasi.
                        </p>
                      </div>
                    </div>
                  ) : savings !== null && savings > 0 ? (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-blue-200 bg-blue-50/80 p-3.5 text-blue-950">
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#0052cc]" />
                      <div>
                        <p className="text-xs font-black text-blue-900">
                          Tersedia Lebih Murah di Marketplace
                        </p>
                        <p className="mt-0.5 text-[11px] text-blue-800">
                          Harga terendah dari penawaran valid saat ini adalah{" "}
                          <strong>
                            {lowestMarketplacePrice !== null ? formatRupiah(lowestMarketplacePrice) : "—"}
                          </strong>{" "}
                          (selisih <strong>{formatRupiah(savings)}</strong>).
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Bagian 1: Penawaran Layak Dibandingkan */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">
                        Penawaran Layak Dibandingkan ({validQuotes.length})
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Lolos validasi produk &amp; kewajaran harga
                      </span>
                    </div>

                    {validQuotes.length > 0 ? (
                      <ul className="space-y-2.5">
                        {validQuotes.map((quote, index) => (
                          <QuoteRow
                            key={`valid-${quote.marketplace}-${index}`}
                            quote={quote}
                            storePrice={effectiveStorePrice}
                            history={data?.history?.[quote.marketplace]}
                            isCheapest={index === 0}
                            variant="valid"
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl border border-gray-100">
                        Tidak ada penawaran yang memenuhi kriteria perbandingan langsung.
                      </p>
                    )}
                  </div>

                  {/* Bagian 2: Penawaran Perlu Ditinjau */}
                  {reviewQuotes.length > 0 && (
                    <div className="pt-2">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                          Perlu Diperiksa ({reviewQuotes.length})
                        </span>
                        <span className="text-[10px] text-amber-700">
                          Indikasi anomali harga, buku bekas, atau preorder
                        </span>
                      </div>

                      <ul className="space-y-2.5">
                        {reviewQuotes.map((quote, index) => (
                          <QuoteRow
                            key={`review-${quote.marketplace}-${index}`}
                            quote={quote}
                            storePrice={effectiveStorePrice}
                            history={data?.history?.[quote.marketplace]}
                            isCheapest={false}
                            variant="review"
                          />
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bagian 3: Penawaran Disaring / Tidak Layak (Collapsible) */}
                  {rejectedQuotes.length > 0 && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRejected((prev) => !prev)}
                        className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>Penawaran yang Disaring ({rejectedQuotes.length})</span>
                          <span className="text-[10px] font-normal text-gray-400">
                            (Beda buku / bundel / non-buku)
                          </span>
                        </span>
                        {showRejected ? (
                          <ChevronUp className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </button>

                      {showRejected && (
                        <ul className="mt-2.5 space-y-2.5">
                          {rejectedQuotes.map((quote, index) => (
                            <QuoteRow
                              key={`rejected-${quote.marketplace}-${index}`}
                              quote={quote}
                              storePrice={effectiveStorePrice}
                              history={data?.history?.[quote.marketplace]}
                              isCheapest={false}
                              variant="rejected"
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Info Status Cache & Waktu Penarikan */}
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      {data?.from_cache
                        ? "Data dari cache lokal (berlaku 6 jam)."
                        : "Data baru saja disinkronkan."}
                      {data?.fetched_at &&
                        ` Terakhir diperbarui: ${new Date(data.fetched_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}.`}
                    </span>
                  </div>
                </>
              )}

              {totalOffersCount === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-700">
                    Belum Ada Data Pembanding
                  </p>
                  <p className="max-w-xs text-xs text-gray-500">
                    Belum ditemukan penawaran marketplace yang cocok untuk buku ini. Anda dapat mencoba menekan tombol perbarui di bawah.
                  </p>
                </div>
              )}

              {/* Peringatan / Kegagalan Sebagian Marketplace */}
              {data && data.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Catatan perbandingan harga
                  </p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[11px] text-amber-800">
                    {data.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {accessToken && ready && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/90 px-5 py-3.5">
            <span className="text-[11px] text-gray-400">
              {cooldownSeconds > 0
                ? `Tunggu ${cooldownSeconds} dtk sebelum refresh ulang.`
                : "Harga dapat berubah sewaktu-waktu."}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || cooldownSeconds > 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0052cc]" : ""}`}
              />
              <span>
                {loading
                  ? "Menyinkronkan…"
                  : cooldownSeconds > 0
                  ? `Perbarui (${cooldownSeconds}s)`
                  : "Perbarui Harga"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
