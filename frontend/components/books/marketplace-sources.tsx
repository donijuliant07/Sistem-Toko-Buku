import type { MarketplaceSlug } from "@/lib/types";
import type { ThinkingSource } from "@/components/ui/thinking-state";

/**
 * Satu tempat untuk identitas marketplace: nama, situs resmi, warna merek, dan
 * berkas logo. Dipakai baris penawaran di modal perbandingan harga sekaligus chip
 * sumber di panel "Menganalisis harga", supaya keduanya tidak mungkin
 * menampilkan daftar toko yang berbeda.
 *
 * Berkas logo ada di `public/brands/` (lihat README di sana untuk sumbernya).
 * Bukan `next/image`: logonya SVG vektor dan `next/image` menolak SVG tanpa
 * `dangerouslyAllowSVG`.
 */

interface MarketplaceMeta {
  label: string;
  site: string;
  /** Warna merek — pita tepi kartu penawaran. */
  color: string;
  /**
   * `true` bila berkas logonya sudah memuat nama toko (logotype) — nama tidak
   * perlu ditulis lagi. `false` = hanya lambang, atau tidak ada berkas logo
   * sama sekali; nama toko wajib tampil di sebelahnya.
   */
  wordmark: boolean;
  /** Rasio asli berkas (lebar/tinggi) agar lebar bisa dihitung sebelum dimuat. */
  ratio: number;
}

const META: Partial<Record<MarketplaceSlug, MarketplaceMeta>> = {
  tokopedia: { label: "Tokopedia", site: "https://www.tokopedia.com", color: "#42b549", wordmark: true, ratio: 400 / 87 },
  shopee: { label: "Shopee", site: "https://shopee.co.id", color: "#ee4d2d", wordmark: false, ratio: 1 },
  lazada: { label: "Lazada", site: "https://www.lazada.co.id", color: "#000083", wordmark: true, ratio: 410.28 / 107.51 },
  blibli: { label: "Blibli", site: "https://www.blibli.com", color: "#0072ff", wordmark: false, ratio: 1 },
  gramedia: { label: "Gramedia", site: "https://www.gramedia.com", color: "#2056ae", wordmark: true, ratio: 1000 / 161 },
  periplus: { label: "Periplus", site: "https://www.periplus.com", color: "#3aa9a0", wordmark: false, ratio: 1 },
  google_books: { label: "Google Books", site: "https://books.google.co.id", color: "#4285f4", wordmark: false, ratio: 1 },
  open_library: { label: "Open Library", site: "https://openlibrary.org", color: "#518abe", wordmark: true, ratio: 1045.2 / 260 },
};

const LOGO_FILES: Partial<Record<MarketplaceSlug, string>> = {
  tokopedia: "/brands/tokopedia.svg",
  lazada: "/brands/lazada.svg",
  blibli: "/brands/blibli.svg",
  gramedia: "/brands/gramedia.svg",
  open_library: "/brands/open-library.svg",
};

/** Toko yang diperiksa saat fitur ini berjalan — chip sumber & teks tunggu. */
export const MARKETS_QUICK_PICK: MarketplaceSlug[] = [
  "tokopedia",
  "shopee",
  "lazada",
  "blibli",
  "gramedia",
  "periplus",
  "google_books",
];

export function marketplaceLabel(slug: MarketplaceSlug, fallback?: string): string {
  return META[slug]?.label ?? fallback ?? slug;
}

export function marketplaceColor(slug: MarketplaceSlug): string {
  return META[slug]?.color ?? "#d1d5db";
}

/** `true` bila logonya sudah memuat nama toko — jangan tulis namanya dua kali. */
export function marketplaceHasWordmark(slug: MarketplaceSlug): boolean {
  return META[slug]?.wordmark ?? false;
}

interface MarketplaceLogoProps {
  slug: MarketplaceSlug;
  /** Nama tampilan; dipakai sebagai `alt` walau teksnya tidak dirender. */
  label: string;
  /** Tinggi logo dalam px; lebar mengikuti rasio asli, dibatasi `maxWidth`. */
  height?: number;
  maxWidth?: number;
  /** `muted` untuk konteks sekunder (penawaran disaring) — abu-abu. */
  tone?: "full" | "muted";
  className?: string;
}

export function MarketplaceLogo({
  slug,
  label,
  height = 16,
  maxWidth = 104,
  tone = "full",
  className = "",
}: MarketplaceLogoProps) {
  const src = LOGO_FILES[slug];
  const meta = META[slug];

  // Marketplace yang dikenal tapi tidak punya berkas logo (Shopee, Periplus,
  // Google Books): tampilkan nama saja, tanpa ikon karangan. Slug yang sama
  // sekali tidak dikenal (mis. demo `demo_store_a`) dapat penanda huruf netral.
  if (!src) {
    if (meta) return null;
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-md bg-gray-100 font-black text-gray-500 ${className}`}
        style={{ width: height, height, fontSize: Math.round(height * 0.62) }}
      >
        {label.charAt(0).toUpperCase()}
      </span>
    );
  }

  const ratio = meta?.ratio ?? 1;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- aset statis lokal, bukan gambar konten
    <img
      src={src}
      alt={meta?.wordmark ? label : ""}
      aria-hidden={meta?.wordmark ? undefined : true}
      width={Math.round(height * ratio * 10) / 10}
      height={height}
      loading="lazy"
      decoding="async"
      className={`shrink-0 object-contain object-left ${tone === "muted" ? "opacity-40 grayscale" : ""} ${className}`}
      style={{ height, maxWidth, width: "auto" }}
    />
  );
}

/**
 * Penanda toko siap pakai: logo, plus nama toko hanya bila logonya cuma lambang.
 * Dipakai baris penawaran dan chip sumber — keduanya tampil sama.
 */
export function MarketplaceMark({
  slug,
  label,
  height = 16,
  tone = "full",
  showName,
  className = "",
}: {
  slug: MarketplaceSlug;
  label: string;
  height?: number;
  tone?: "full" | "muted";
  /** Paksa tampil/sembunyikan nama. Default: ikut jenis logo. */
  showName?: boolean;
  className?: string;
}) {
  const withName = showName ?? !marketplaceHasWordmark(slug);

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <MarketplaceLogo slug={slug} label={label} height={height} tone={tone} />
      {withName && (
        <span className="truncate text-xs font-bold text-gray-700">{label}</span>
      )}
    </span>
  );
}

/** `true` bila ada berkas logo untuk toko ini (lambang atau logotype). */
export function marketplaceHasLogo(slug: MarketplaceSlug): boolean {
  return !!LOGO_FILES[slug];
}

/** Chip sumber untuk `ThinkingState`, lengkap dengan logo tiap marketplace. */
export function marketplaceSources(slugs: MarketplaceSlug[]): ThinkingSource[] {
  return slugs.map((slug) => {
    const site = META[slug]?.site;
    const label = marketplaceLabel(slug);
    return {
      label,
      href: site,
      tooltip: site?.replace(/^https?:\/\//, ""),
      // Tanpa logo, biarkan chip hanya berisi nama — kotak ikon kosong hanya
      // menambah ruang mati.
      icon: marketplaceHasLogo(slug) ? (
        <MarketplaceMark slug={slug} label={label} height={14} showName={false} />
      ) : undefined,
    };
  });
}