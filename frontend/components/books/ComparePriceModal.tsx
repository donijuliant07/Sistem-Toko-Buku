"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { formatRupiah } from "@/components/ProductCard";
import { getMarketplacePrices } from "@/lib/api";
import type { MarketplaceComparison, MarketplaceHistoryPoint, MarketplaceQuote } from "@/lib/types";

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

/** Selisih harga toko dibanding satu kutipan, dengan arahnya. */
function priceGap(storePrice: number | null, quotePrice: string | number): number | null {
  const store = toNumber(storePrice);
  const price = toNumber(quotePrice);
  if (store === null || price === null) return null;
  return store - price;
}

/** Grafik garis kecil dari riwayat harga; tanpa dependensi chart. */
function PriceSparkline({ points }: { points: MarketplaceHistoryPoint[] }) {
  const values = points.map((point) => toNumber(point.price)).filter((v): v is number => v !== null);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 100 / (values.length - 1);

  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"} ${index * step} ${28 - ((value - min) / span) * 24}`)
    .join(" ");

  return (
    <div className="mt-2 flex items-center gap-2">
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="h-6 w-20 text-[#0052cc]"
        aria-hidden="true"
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="text-[10px] text-gray-400">
        {formatRupiah(min)}–{formatRupiah(max)} dari {values.length} pencatatan
      </span>
    </div>
  );
}

function QuoteRow({
  quote,
  storePrice,
  history,
  isCheapest,
}: {
  quote: MarketplaceQuote;
  storePrice: number | null;
  history: MarketplaceHistoryPoint[] | undefined;
  isCheapest: boolean;
}) {
  const gap = priceGap(storePrice, quote.price);
  const cheaper = gap !== null && gap > 0;

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
        isCheapest ? "border-emerald-200 bg-emerald-50/50" : "border-gray-100 bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-gray-900">{quote.label}</span>
          {isCheapest && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
              Termurah
            </span>
          )}
          {quote.in_stock === false && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              Stok habis
            </span>
          )}
          {quote.source === "admin_url" && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
              Link admin
            </span>
          )}
          {quote.source === "mock" && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Data contoh
            </span>
          )}
        </div>

        {quote.product_title && (
          <p className="mt-1 truncate text-[11px] text-gray-500" title={quote.product_title}>
            {quote.product_title}
          </p>
        )}
        {quote.seller_name && (
          <p className="mt-0.5 truncate text-[10px] text-gray-400">Penjual: {quote.seller_name}</p>
        )}

        {history && history.length > 1 && <PriceSparkline points={history} />}
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <span className="text-sm font-extrabold whitespace-nowrap text-[#0052cc]">
          {formatRupiah(quote.price)}
        </span>
        {gap !== null && gap !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-[10px] font-semibold whitespace-nowrap ${
              cheaper ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {cheaper ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {cheaper ? "Lebih murah" : "Lebih mahal"} {formatRupiah(Math.abs(gap))}
          </span>
        )}
        {quote.product_url && (
          <a
            href={quote.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-[10px] font-semibold text-[#0052cc] hover:underline"
          >
            Buka
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
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
  const [cooldown, setCooldown] = useState(false);

  // Modal yang baru dibuka atau pindah buku dianggap belum punya hasil. Diturunkan
  // dari state, bukan diset di dalam effect, supaya tidak ada render berantai.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const resultIsForCurrentBook = loadedFor === bookId;

  const load = useCallback(
    async (refresh: boolean) => {
      if (!accessToken) return;
      setLoading(true);
      setError("");
      try {
        const res = await getMarketplacePrices(bookId, accessToken, { refresh });
        setData(res.data);
        setLoadedFor(bookId);
        if (refresh) {
          // Backend membatasi refresh 60 detik per buku; hitung mundur lebih baik
          // daripada tombol yang selalu berakhir 429.
          setCooldown(true);
          window.setTimeout(() => setCooldown(false), 60_000);
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal membandingkan harga.");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, bookId]
  );

  // Satu pengambilan saat modal dibuka — memakai cache backend bila masih segar.
  // Pemanggilan setState langsung di badan effect dihindari (aturan
  // `react-hooks/set-state-in-effect`): status "sedang memuat" diturunkan dari
  // ketiadaan data, dan pengosongan dilakukan di dalam promise, bukan sebelum.
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    let active = true;
    getMarketplacePrices(bookId, accessToken)
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setData(null);
        setError(cause instanceof Error ? cause.message : "Gagal membandingkan harga.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, accessToken, bookId]);

  if (!isOpen) return null;

  const effectiveStorePrice = toNumber(storePrice) ?? toNumber(data?.store_price ?? null);
  const savings = toNumber(data?.savings ?? null);
  const quotes = data?.quotes ?? [];
  // Dibaca dari `source`, bukan dari nama marketplace: keaslian data melekat pada
  // kutipannya, jadi frontend tidak perlu tahu slug mana yang palsu.
  const hasMockQuotes = quotes.some((quote) => quote.source === "mock");

  // Empat keadaan tampilan, tanpa satu pun setState di dalam effect:
  //   1. belum login        3. error tanpa hasil
  //   2. sedang memuat      4. hasil (mungkin dengan `warnings`)
  const busy = loading && !resultIsForCurrentBook;
  const failed = !!error && !resultIsForCurrentBook;
  const ready = resultIsForCurrentBook && !!data;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Bandingkan harga ${bookTitle}`}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
              <ShoppingBag className="h-4 w-4 text-[#0052cc]" />
              Bandingkan Harga
            </h3>
            <p className="mt-0.5 truncate text-xs text-gray-500" title={bookTitle}>
              {bookTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!accessToken ? (
            /* Seharusnya tidak terlihat: tombolnya hanya muncul untuk user login. */
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Lock className="h-6 w-6 text-gray-300" />
              <p className="text-xs text-gray-500">Masuk dulu untuk membandingkan harga.</p>
            </div>
          ) : busy ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-[#0052cc]" />
              <p className="text-xs text-gray-500">Mengambil harga dari marketplace…</p>
            </div>
          ) : failed ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="text-xs font-semibold text-gray-700">Gagal membandingkan harga</p>
              <p className="max-w-xs text-[11px] text-gray-500">{error}</p>
              <button
                type="button"
                onClick={() => load(false)}
                className="mt-1 rounded-lg bg-[#0052cc] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#0041a3]"
              >
                Coba lagi
              </button>
            </div>
          ) : (
            <>
              {/* Satu-satunya tempat yang membedakan demo dari data sungguhan, dan
                  sengaja tidak bisa dilewatkan: badge kecil di tiap baris mudah
                  terlewat saat dipresentasikan, dan angka yang tampak seperti harga
                  nyata adalah satu-satunya hal di modal ini yang bisa menyesatkan. */}
              {hasMockQuotes && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-[11px] text-amber-900">
                    Sebagian angka di bawah adalah <strong>data contoh</strong> untuk keperluan
                    demo, bukan harga sungguhan dari marketplace mana pun.
                  </p>
                </div>
              )}

              {/* Baris harga toko sendiri sebagai pembanding */}
              <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <div>
                  <p className="text-[11px] font-semibold text-blue-900">Harga di toko ini</p>
                  <p className="text-[10px] text-blue-700/80">Pembanding utama</p>
                </div>
                <span className="text-sm font-extrabold text-[#0052cc]">
                  {effectiveStorePrice === null ? "—" : formatRupiah(effectiveStorePrice)}
                </span>
              </div>

              {quotes.length > 0 ? (
                <>
                  {/* Ringkasan: hanya bermakna kalau ada yang lebih murah dari toko */}
                  {savings !== null && savings > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <p className="text-[11px] text-emerald-900">
                        Ada yang lebih murah <strong>{formatRupiah(savings)}</strong> dari harga toko
                        ini.
                        {data?.lowest_price != null && (
                          <>
                            {" "}
                            Terendah <strong>{formatRupiah(data.lowest_price)}</strong>.
                          </>
                        )}
                      </p>
                    </div>
                  )}

                  <ul className="space-y-2">
                    {quotes.map((quote, index) => (
                      <QuoteRow
                        key={`${quote.marketplace}-${index}`}
                        quote={quote}
                        storePrice={effectiveStorePrice}
                        history={data?.history?.[quote.marketplace]}
                        isCheapest={index === 0}
                      />
                    ))}
                  </ul>

                  <p className="mt-3 text-[10px] text-gray-400">
                    {data?.from_cache
                      ? "Harga dari simpanan terakhir (belum 6 jam), tidak ada pengambilan baru."
                      : "Harga baru saja diambil dari marketplace."}
                    {data?.fetched_at && ` Diperbarui ${new Date(data.fetched_at).toLocaleString("id-ID")}.`}
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                  <p className="text-xs font-semibold text-gray-700">Belum ada harga pembanding</p>
                  <p className="max-w-xs text-[11px] text-gray-500">
                    Admin belum mengisi sumber marketplace untuk buku ini.
                  </p>
                </div>
              )}

              {/* Peringatan per marketplace — perbandingan tetap sah tanpa mereka */}
              {data && data.warnings.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-1 text-[11px] font-bold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sebagian marketplace tidak bisa diambil
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-amber-800">
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
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-3">
            <span className="text-[10px] text-gray-400">
              {cooldown ? "Tunggu sebentar sebelum memperbarui lagi." : "Harga bisa berubah kapan saja."}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || cooldown}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Perbarui
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
