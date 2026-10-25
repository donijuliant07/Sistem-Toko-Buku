/**
 * Bentuk item katalog yang dipakai komponen storefront (`ProductCard`,
 * `BookDetailModal`). Berkas ini hanya menyimpan *bentuk data* — seluruh isinya
 * berasal dari `GET /books`; tidak ada produk contoh.
 *
 * Kolom yang tidak ada di backend (`rating`, `soldCount`, `discountPercent`,
 * `badgeLanguage`) sengaja opsional: tanpa sumber datanya, komponen tidak
 * menampilkan apa pun daripada menampilkan angka karangan.
 */
export interface Product {
  id: string;
  title: string;
  authorOrBrand: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating?: number;
  soldCount?: number;
  badgeLanguage?: string;
  coverUrl: string;
  category: string;
  type: "book" | "non-book";
  stock: number;
}

export type CategoryId = string;

export interface CategoryShortcut {
  id: CategoryId;
  name: string;
  icon: string;
  /** Sub-judul kecil di bawah nama kategori (opsional). */
  tag?: string;
  /** Kata kunci yang dicocokkan ke judul/penulis buku — backend belum punya
   * filter kategori, jadi penyaringan dilakukan di sisi katalog yang dimuat. */
  keywords?: string[];
}

export const SEMUA_CATEGORY_ID = "semua";

export const CATEGORIES: CategoryShortcut[] = [
  { id: SEMUA_CATEGORY_ID, name: "Semua", icon: "all" },
  { id: "buku-anak", name: "Buku Anak", icon: "book", keywords: ["anak", "kids", "komik anak"] },
  { id: "religi", name: "Religi", icon: "mosque", keywords: ["religi", "islam", "hijrah", "quran", "doa"] },
  { id: "biografi", name: "Biografi", icon: "user", keywords: ["biografi", "memoar", "autobiografi"] },
  { id: "fiksi-sastra", name: "Fiksi & Sastra", icon: "feather", keywords: ["fiksi", "novel", "sastra", "cerita"] },
  {
    id: "self-dev",
    name: "Self-Dev",
    icon: "sparkles",
    keywords: ["pengembangan diri", "self", "habit", "mindset", "produktif"],
  },
  { id: "bisnis", name: "Bisnis", icon: "briefcase", keywords: ["bisnis", "keuangan", "investasi", "marketing"] },
  { id: "edukasi", name: "Edukasi", icon: "graduation", keywords: ["edukasi", "pelajaran", "snbt", "ujian", "sekolah"] },
  // Tanpa `href`: belum ada halaman `/kategori/*`, jadi kartu ini memfilter
  // katalog di beranda seperti kategori lain (sebelumnya menautkan 404).
  { id: "manga", name: "Komik & Manga", icon: "/images/naruto-icon.jpg", keywords: ["manga", "komik"] },
];

export const HERO_BANNERS = [
  {
    id: 1,
    imageUrl: "/images/banner-kuning.jpg",
    // Banner promosi belum punya URL tujuan dari backend; `#katalog` membawa
    // pengunjung ke katalog yang memang ada di beranda.
    href: "#katalog",
  },
  {
    id: 2,
    imageUrl: "/images/banner-ungu.jpg",
    href: "#katalog",
  },
  {
    id: 3,
    imageUrl: "/images/banner-hijau.jpg",
    href: "#katalog",
  },
];

export const HERO_SIDE_BANNERS = [
  {
    id: 1,
    type: "video",
    mediaUrl: "/videos/promo-video.mp4",
    href: "#katalog",
  },
  {
    id: 2,
    type: "image",
    mediaUrl: "/images/komunitas-banner.jpg",
    href: "/komunitas",
  },
];