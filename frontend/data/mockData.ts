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
  tag?: string;
  icon: string;
  color: string;
  bgGlow?: string;
  keywords?: string[];
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
  {
    id: "all",
    name: "Semua",
    tag: "Koleksi Lengkap",
    icon: "all",
    color: "text-blue-600 bg-blue-50/70 border-blue-200",
    bgGlow: "from-blue-500/10 to-indigo-500/10",
  },
  {
    id: "fiksi",
    name: "Fiksi & Sastra",
    tag: "Novel & Prosa",
    icon: "fiksi",
    color: "text-purple-600 bg-purple-50/70 border-purple-200",
    bgGlow: "from-purple-500/10 to-pink-500/10",
    keywords: ["fiksi", "sastra", "novel", "bumi", "laut", "cantik", "dilan", "perahu", "supernova", "hujan", "pergi", "gadis", "orang-orang biasa", "max havelaar", "alkemis", "harry potter", "hobbit", "pangeran kecil", "ayat-ayat", "pulang", "1984", "ronggeng", "menara", "laskar"],
  },
  {
    id: "self-dev",
    name: "Self-Dev",
    tag: "Pengembangan Diri",
    icon: "self-dev",
    color: "text-emerald-600 bg-emerald-50/70 border-emerald-200",
    bgGlow: "from-emerald-500/10 to-teal-500/10",
    keywords: ["atomic habits", "seni untuk bersikap bodo amat", "tidak disukai", "filosofi teras", "goodbye", "tidur", "sleep", "ikigai", "enzyme", "heart", "magnet rezeki", "kebiasaan", "mental", "kebahagiaan"],
  },
  {
    id: "bisnis",
    name: "Bisnis",
    tag: "Finansial & Karir",
    icon: "bisnis",
    color: "text-amber-600 bg-amber-50/70 border-amber-200",
    bgGlow: "from-amber-500/10 to-orange-500/10",
    keywords: ["money", "rich dad", "zero to one", "good to great", "think and grow", "bisnis", "finansial", "investasi", "rezeki"],
  },
  {
    id: "edukasi",
    name: "Edukasi",
    tag: "Akademik & Sains",
    icon: "edukasi",
    color: "text-sky-600 bg-sky-50/70 border-sky-200",
    bgGlow: "from-sky-500/10 to-blue-500/10",
    keywords: ["politik", "penelitian", "hukum", "pendidikan", "matematika", "madilog", "sapiens", "astrofisika", "cosmos", "waktu", "life 3.0", "kuliah", "teori", "ilmiah", "diskrit"],
  },
  {
    id: "komik",
    name: "Komik",
    tag: "Manga & Grafis",
    icon: "komik",
    color: "text-rose-600 bg-rose-50/70 border-rose-200",
    bgGlow: "from-rose-500/10 to-pink-500/10",
    keywords: ["one piece", "naruto", "conan", "spy x family", "miiko", "komik", "manga", "vol."],
  },
  {
    id: "english",
    name: "Buku Asing",
    tag: "Buku Internasional",
    icon: "english",
    color: "text-indigo-600 bg-indigo-50/70 border-indigo-200",
    bgGlow: "from-indigo-500/10 to-blue-500/10",
    keywords: ["the ", "atomic", "rich dad", "zero to one", "good to great", "think and grow", "why we sleep", "goodbye", "life 3.0", "cosmos", "1984", "hobbit", "harry potter", "sapiens", "ikigai", "freire", "english"],
  },
  {
    id: "teknologi",
    name: "Teknologi",
    tag: "IT & Komputer",
    icon: "teknologi",
    color: "text-cyan-600 bg-cyan-50/70 border-cyan-200",
    bgGlow: "from-cyan-500/10 to-teal-500/10",
    keywords: ["life 3.0", "ai", "kecerdasan buatan", "matematika diskrit", "elon musk", "zero to one", "teknologi"],
  },
  {
    id: "anak",
    name: "Buku Anak",
    tag: "Cerita & Dongeng",
    icon: "anak",
    color: "text-pink-600 bg-pink-50/70 border-pink-200",
    bgGlow: "from-pink-500/10 to-rose-500/10",
    keywords: ["lima sekawan", "charlie", "wimpy kid", "na willa", "pangeran kecil", "tanah melus", "anak", "dongeng"],
  },
  {
    id: "religi",
    name: "Religi",
    tag: "Spiritual & Hikmah",
    icon: "religi",
    color: "text-emerald-700 bg-emerald-50/70 border-emerald-300",
    bgGlow: "from-emerald-500/10 to-green-500/10",
    keywords: ["rasulullah", "tasawuf", "riyadhus", "shalihin", "sirah", "la tahzan", "rezeki", "ayat-ayat", "islam", "spiritual"],
  },
  {
    id: "biografi",
    name: "Biografi",
    tag: "Tokoh Inspiratif",
    icon: "biografi",
    color: "text-amber-700 bg-amber-50/70 border-amber-300",
    bgGlow: "from-amber-500/10 to-yellow-500/10",
    keywords: ["bung karno", "elon musk", "becoming", "gus dur", "habibie", "biografi"],
  },
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
