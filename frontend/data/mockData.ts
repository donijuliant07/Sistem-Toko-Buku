export interface Product {
  id: string;
  title: string;
  authorOrBrand: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  soldCount?: number;
  badgeLanguage?: string; // e.g. "ID", "EN"
  coverUrl: string;
  category: string;
  type: "book" | "stationery" | "lifestyle";
  /** Stok nyata dari `books`. Hanya ada untuk produk yang berasal dari API. */
  stock?: number;
}

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  imageBg: string;
  ctaText: string;
  href: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: "all", name: "Semua", icon: "📚", color: "bg-blue-50 text-blue-600" },
  { id: "fiksi", name: "Fiksi & Sastra", icon: "📖", color: "bg-purple-50 text-purple-600" },
  { id: "self-dev", name: "Self-Dev", icon: "🌱", color: "bg-emerald-50 text-emerald-600" },
  { id: "bisnis", name: "Bisnis", icon: "💼", color: "bg-amber-50 text-amber-600" },
  { id: "edukasi", name: "Edukasi", icon: "🎓", color: "bg-sky-50 text-sky-600" },
  { id: "komik", name: "Komik", icon: "🎨", color: "bg-rose-50 text-rose-600" },
  { id: "english", name: "Buku Asing", icon: "🌐", color: "bg-indigo-50 text-indigo-600" },
];

export const HERO_BANNERS: Banner[] = [
  {
    id: "b1",
    title: "Temukan Buku Favorit Bersama Sahabat",
    subtitle: "Eksplorasi ribuan judul buku fiksi, sastra, dan pengembangan diri terpopuler di toko buku kami.",
    imageUrl: "/images/girls-buying-books.jpg",
    imageBg: "from-slate-950/95 via-slate-900/80 to-slate-900/20",
    ctaText: "Belanja Sekarang",
    href: "#katalog",
  },
  {
    id: "b2",
    title: "Back to Campus & Referensi Akademik",
    subtitle: "Koleksi sains, teknologi, dan literatur kuliah lengkap dengan promo diskon spesial mahasiswa.",
    imageUrl: "/images/student-bookstore.jpg",
    imageBg: "from-slate-950/95 via-slate-900/80 to-slate-900/20",
    ctaText: "Lihat Buku Edukasi",
    href: "#edukasi",
  },
  {
    id: "b3",
    title: "Rilisan Novel & Sastra Best Seller Terbaru",
    subtitle: "Dapatkan bacaan inspiratif pilihan terpopuler 2026 langsung dari penerbit resmi terpercaya.",
    imageUrl: "/images/reading-bookstore.jpg",
    imageBg: "from-slate-950/95 via-slate-900/80 to-slate-900/20",
    ctaText: "Cek Buku Terlaris",
    href: "#buku-terlaris",
  },
];

export interface SideBanner {
  id: string;
  title: string;
  desc: string;
  imageUrl?: string;
  bgColor: string;
  tag: string;
  href?: string;
  ctaText?: string;
}

export const HERO_SIDE_BANNERS: SideBanner[] = [
  {
    id: "sb1",
    title: "Koleksi Sastra & Pojok Baca",
    desc: "Temukan bacaan berkualitas rekomendasi kurator di suasana membaca yang nyaman",
    imageUrl: "/images/bookstore-reading-corner.jpg",
    bgColor: "from-slate-950/95 via-slate-900/80 to-slate-900/35",
    tag: "REKOMENDASI BUKU",
    href: "#katalog",
    ctaText: "Eksplor Buku",
  },
  {
    id: "sb2",
    title: "Diskusi Buku & Komunitas",
    desc: "Ruang temu interaktif untuk bedah karya, tukar pikiran, dan belajar bersama sahabat literasi",
    imageUrl: "/images/bookstore-discussion.jpg",
    bgColor: "from-slate-950/95 via-slate-900/80 to-slate-900/35",
    tag: "DISKUSI & KOMUNITAS",
    href: "#katalog",
    ctaText: "Gabung Diskusi",
  },
];

export const BACK_TO_CAMPUS_PRODUCTS: Product[] = [
  {
    id: "btc-1",
    title: "Pulpen Gel 0.5mm Pack 12 Pcs Premium Ink",
    authorOrBrand: "Faber-Castell",
    price: 34500,
    originalPrice: 45000,
    discountPercent: 23,
    soldCount: 1250,
    coverUrl: "",
    category: "stationery",
    type: "stationery",
  },
  {
    id: "btc-2",
    title: "Kalkulator Scientific FX-991EX Dual Power",
    authorOrBrand: "Casio",
    price: 319000,
    originalPrice: 380000,
    discountPercent: 16,
    soldCount: 890,
    coverUrl: "",
    category: "stationery",
    type: "stationery",
  },
  {
    id: "btc-3",
    title: "Notebook B5 Grid Hardcover 100 Sheets 80gsm",
    authorOrBrand: "Campus Line",
    price: 42000,
    originalPrice: 55000,
    discountPercent: 24,
    soldCount: 3400,
    coverUrl: "",
    category: "stationery",
    type: "stationery",
  },
  {
    id: "btc-4",
    title: "Highlighter Pastel Set 6 Warna Soft Shade",
    authorOrBrand: "Stabilo Boss",
    price: 68000,
    originalPrice: 85000,
    discountPercent: 20,
    soldCount: 2100,
    coverUrl: "",
    category: "stationery",
    type: "stationery",
  },
  {
    id: "btc-5",
    title: "Ransel Laptop Waterproof Ergonomis 15.6 Inch",
    authorOrBrand: "Eiger Goods",
    price: 249000,
    originalPrice: 350000,
    discountPercent: 28,
    soldCount: 450,
    coverUrl: "",
    category: "stationery",
    type: "stationery",
  },
];

export const BESTSELLER_BOOKS: Product[] = [
  {
    id: "bs-1",
    title: "Laut Bercerita (Edisi Hardcover Special)",
    authorOrBrand: "Leila S. Chudori",
    price: 115000,
    originalPrice: 135000,
    discountPercent: 15,
    soldCount: 8400,
    badgeLanguage: "ID",
    coverUrl: "",
    category: "buku-terlaris",
    type: "book",
  },
  {
    id: "bs-2",
    title: "Atomic Habits: Perubahan Kecil yang Memberikan Hasil Luar Biasa",
    authorOrBrand: "James Clear",
    price: 98000,
    originalPrice: 120000,
    discountPercent: 18,
    soldCount: 15300,
    badgeLanguage: "ID",
    coverUrl: "",
    category: "buku-terlaris",
    type: "book",
  },
  {
    id: "bs-3",
    title: "Filosofi Teras: Edisi Terbaru & Diperbarui",
    authorOrBrand: "Henry Manampiring",
    price: 83300,
    originalPrice: 98000,
    discountPercent: 15,
    soldCount: 11200,
    badgeLanguage: "ID",
    coverUrl: "",
    category: "buku-terlaris",
    type: "book",
  },
  {
    id: "bs-4",
    title: "Psychology of Money: Timeless Lessons on Wealth, Greed, and Happiness",
    authorOrBrand: "Morgan Housel",
    price: 76500,
    originalPrice: 90000,
    discountPercent: 15,
    soldCount: 9500,
    badgeLanguage: "ID",
    coverUrl: "",
    category: "buku-terlaris",
    type: "book",
  },
  {
    id: "bs-5",
    title: "Bumi (Edisi Kolektor Serial Dunia Paralel)",
    authorOrBrand: "Tere Liye",
    price: 89000,
    originalPrice: 105000,
    discountPercent: 15,
    soldCount: 19800,
    badgeLanguage: "ID",
    coverUrl: "",
    category: "buku-terlaris",
    type: "book",
  },
];

export const BRAND_RECOMMENDATIONS: Product[] = [
  {
    id: "br-1",
    title: "Wireless Noise Cancelling Headphones Wh-1000Xm5",
    authorOrBrand: "Sony Electronics",
    price: 4499000,
    originalPrice: 5299000,
    discountPercent: 15,
    soldCount: 320,
    coverUrl: "",
    category: "brand",
    type: "lifestyle",
  },
  {
    id: "br-2",
    title: "Buku Gambar A3 Watercolor Paper 300gsm Cold Pressed",
    authorOrBrand: "Canson Paper",
    price: 145000,
    originalPrice: 180000,
    discountPercent: 19,
    soldCount: 1400,
    coverUrl: "",
    category: "brand",
    type: "lifestyle",
  },
  {
    id: "br-3",
    title: "Board Game Monopoly Indonesia Anniversary Edition",
    authorOrBrand: "Hasbro Gaming",
    price: 299000,
    originalPrice: 399000,
    discountPercent: 25,
    soldCount: 880,
    coverUrl: "",
    category: "brand",
    type: "lifestyle",
  },
  {
    id: "br-4",
    title: "Botol Minum Insulated Stainless Steel 750ml",
    authorOrBrand: "Hydro Flask",
    price: 489000,
    originalPrice: 599000,
    discountPercent: 18,
    soldCount: 610,
    coverUrl: "",
    category: "brand",
    type: "lifestyle",
  },
];
