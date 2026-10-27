"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, ShoppingBag } from "lucide-react";
import type { Recommendation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Rp95.000" tanpa spasi tak-putus, supaya font-mono tidak memecah baris. */
function formatPrice(amount: number): string {
  return `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(amount)}`;
}

/** Tingkat kecocokan dari skor 0–1; warna dan label mengikuti ambang ini. */
type MatchTier = "strong" | "good" | "fair";

const TIER_STYLES: Record<MatchTier, { ink: string; label: string }> = {
  strong: { ink: "text-chat-success-ink", label: "Kecocokan tinggi" },
  good: { ink: "text-chat-success-ink/80", label: "Kecocokan baik" },
  fair: { ink: "text-muted-foreground", label: "Kecocokan cukup" },
};

function tierFor(percent: number): MatchTier {
  if (percent >= 75) return "strong";
  if (percent >= 50) return "good";
  return "fair";
}

/** Badge kecocokan: angka monospace + meter progres, bukan label datar. */
function MatchBadge({ percent }: { percent: number }) {
  const tier = TIER_STYLES[tierFor(percent)];
  return (
    <div
      className="group/match inline-flex items-center gap-1.5 rounded-full border border-chat-success/25 bg-chat-success-soft/70 py-0.5 pr-2 pl-1.5"
      title={tier.label}
    >
      <span className="relative grid size-4 place-items-center">
        <svg viewBox="0 0 16 16" className="size-4 -rotate-90" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" strokeWidth="2.5" className="stroke-chat-success/25" />
          <circle
            cx="8"
            cy="8"
            r="6"
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * 37.7} 37.7`}
            className={cn("stroke-current transition-[stroke-dasharray] duration-700 ease-out", tier.ink)}
          />
        </svg>
      </span>
      <span className={cn("font-mono text-[10px] leading-none font-semibold tabular-nums", tier.ink)}>
        {percent}%
      </span>
    </div>
  );
}

/**
 * Kartu rekomendasi satu giliran chat.
 *
 * Hierarki: sampul → judul (sans semibold) → penulis → alasan kecocokan →
 * baris harga (monospace) + aksi. Deskripsi sengaja tidak ditampilkan; alasan
 * dari model lebih informatif untuk memilih di antara kandidat.
 */
export function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const { book } = rec;
  const percent = Math.round(Math.max(0, Math.min(1, rec.score)) * 100);
  const outOfStock = book.stock <= 0;
  const hasCover = Boolean(book.cover_url);

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 bg-card",
        "shadow-[0_1px_2px_rgba(16,24,20,0.04),0_8px_24px_-16px_rgba(16,24,20,0.28)]",
        "transition-[border-color,box-shadow,transform] duration-200",
        "hover:-translate-y-px hover:border-chat-success/45",
        "hover:shadow-[0_2px_4px_rgba(16,24,20,0.05),0_16px_32px_-20px_rgba(16,185,129,0.45)]",
        "focus-within:border-chat-success/60 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      )}
    >
      <div className="flex gap-3 p-3">
        {/* Sampul: rasio buku tetap supaya semua kartu sejajar. */}
        <div className="relative shrink-0">
          {hasCover ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL sampul dari bucket Supabase, ukuran bervariasi
            <img
              src={book.cover_url!}
              alt={`Sampul ${book.title}`}
              loading="lazy"
              className="h-[88px] w-[62px] rounded-lg object-cover ring-1 ring-border/70 ring-offset-1 ring-offset-card"
            />
          ) : (
            <div className="grid h-[88px] w-[62px] place-items-center rounded-lg bg-surface-tint text-muted-foreground ring-1 ring-border/70">
              <BookOpen className="size-5" />
            </div>
          )}
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-chat-success-ink font-mono text-[10px] font-bold text-white shadow-sm dark:text-chat-success-soft"
          >
            {rank}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/books/${book.id}`}
                className="block truncate text-[13px] leading-snug font-semibold tracking-tight text-foreground transition-colors hover:text-chat-success-ink focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chat-success"
                title={book.title}
              >
                {book.title}
              </Link>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{book.author}</p>
            </div>
            <MatchBadge percent={percent} />
          </div>

          {book.category && (
            <p className="mt-1.5 truncate text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
              {book.category}
            </p>
          )}

          {rec.reason && (
            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
              {rec.reason}
            </p>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
            <div className="min-w-0">
              <p className="font-mono text-sm leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {formatPrice(Number(book.price))}
              </p>
              <p
                className={cn(
                  "mt-1 text-[10px] font-medium",
                  outOfStock ? "text-destructive" : "text-chat-success-ink"
                )}
              >
                {outOfStock ? "Stok habis" : `Stok ${book.stock}`}
              </p>
            </div>

            <Link
              href={`/books/${book.id}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/80 bg-surface px-2.5 py-1.5",
                "text-[11px] font-semibold text-foreground transition-colors",
                "hover:border-chat-success/50 hover:bg-chat-success-soft hover:text-chat-success-ink",
                "focus-visible:ring-2 focus-visible:ring-chat-success/50 focus-visible:outline-none"
              )}
            >
              <ShoppingBag className="size-3" />
              Lihat buku
              <ArrowUpRight className="size-3 transition-transform group-hover:translate-x-px group-hover:-translate-y-px" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Daftar kartu + judul bagian, dipakai untuk giliran aktif maupun riwayat. */
export function RecommendationList({ recs }: { recs: Recommendation[] }) {
  if (recs.length === 0) return null;
  return (
    <section aria-label="Rekomendasi buku" className="mt-1 w-full space-y-2">
      <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-semibold tracking-[0.08em] text-chat-success-ink uppercase">
        <BookOpen className="size-3" aria-hidden="true" />
        <span>Rekomendasi katalog</span>
        <span className="ml-auto font-mono text-[10px] font-medium tracking-normal text-muted-foreground normal-case tabular-nums">
          {recs.length} buku
        </span>
      </div>
      <div className="grid gap-2">
        {recs.map((rec, index) => (
          <RecommendationCard key={rec.book.id} rec={rec} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}
