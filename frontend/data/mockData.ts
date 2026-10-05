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
  imageBg: string;
  ctaText: string;
  href: string;
}

export const CATEGORIES: CategoryItem[] = [
  { id: "bags", name: "Bags", icon: "🎒", color: "bg-blue-50 text-blue-600" },
  { id: "new-arrival", name: "New Arrival", icon: "✨", color: "bg-amber-50 text-amber-600" },
  { id: "sport", name: "Sport", icon: "⚽", color: "bg-emerald-50 text-emerald-600" },
  { id: "english-books", name: "English Books", icon: "📚", color: "bg-indigo-50 text-indigo-600" },
  { id: "stationery", name: "Stationery", icon: "✏️", color: "bg-rose-50 text-rose-600" },
  { id: "toys", name: "Toys", icon: "🧸", color: "bg-purple-50 text-purple-600" },
  { id: "it", name: "IT Gadget", icon: "💻", color: "bg-cyan-50 text-cyan-600" },
];

export const HERO_BANNERS: Banner[] = [
  {
    id: "b1",
    title: "Pesta Buku & Alat Tulis 2026",
    subtitle: "Diskon hingga 70% untuk semua kategori terpopuler!",
    imageBg: "from-blue-700 via-indigo-800 to-sky-900",
    ctaText: "Belanja Sekarang",
    href: "#katalog",
  },
  {
    id: "b2",
    title: "Back to Campus Super Sale",
    subtitle: "Kebutuhan kuliah & sekolah lengkap dengan cashback QRIS 50%",
    imageBg: "from-red-600 via-rose-700 to-amber-700",
    ctaText: "Lihat Promo",
    href: "#back-to-campus",
  },
  {
    id: "b3",
    title: "Rilisan Novel Best Seller Terbaru",
    subtitle: "Dapatkan edisi bertanda tangan penulis ternama!",
    imageBg: "from-emerald-800 via-teal-900 to-slate-900",
    ctaText: "Cek Katalog",
    href: "#buku-terlaris",
  },
];

export const HERO_SIDE_BANNERS = [
  {
    id: "sb1",
    title: "E-Book Bundling Promo",
    desc: "Hemat hingga 60% paket e-book digital pilihan",
    bgColor: "bg-gradient-to-br from-blue-900 to-blue-700",
    tag: "SPECIAL E-BOOK",
  },
  {
    id: "sb2",
    title: "Undian 56 Tahun Gramedia",
    desc: "Menangkan hadiah total ratusan juta rupiah",
    bgColor: "bg-gradient-to-br from-amber-600 to-orange-700",
    tag: "GEBYAR PRIZE",
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
