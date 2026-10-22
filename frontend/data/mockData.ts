export interface Product {
  id: number;
  title: string;
  author: string;
  price: number;
  originalPrice?: number;
  rating: number;
  sold: number;
  coverUrl: string;
  category: string;
}

// Export CATEGORIES yang hilang
export const CATEGORIES = [
  { id: "semua", name: "Semua", icon: "all" },
  { id: "buku-anak", name: "Buku Anak", icon: "book" },
  { id: "religi", name: "Religi", icon: "mosque" },
  { id: "biografi", name: "Biografi", icon: "user" },
  { id: "fiksi-sastra", name: "Fiksi & Sastra", icon: "feather" },
  { id: "self-dev", name: "Self-Dev", icon: "sparkles" },
  { id: "bisnis", name: "Bisnis", icon: "briefcase" },
  { id: "edukasi", name: "Edukasi", icon: "graduation" },
];

export const HERO_BANNERS = [
  {
    id: 1,
    title: "Buka Lembaran Baru. Semua Buku Diskon 15%!",
    subtitle: "Rayakan pembukaan Readr dengan potongan harga spesial untuk seluruh koleksi tanpa syarat rumit.",
    imageUrl: "/images/banner-kuning.jpg",
    imageBg: "from-yellow-600/80 to-transparent",
    href: "#",
    ctaText: "Klaim Diskon Sekarang",
  },
  {
    id: 2,
    title: "Ragu Mau Beli? Tanya AI & Bandingkan Harganya.",
    subtitle: "Dapatkan ringkasan pintar dari AI Review dan pastikan harga termurah dengan fitur perbandingan ke marketplace lain.",
    imageUrl: "/images/banner-ungu.jpg",
    imageBg: "from-purple-800/80 to-transparent",
    href: "#",
    ctaText: "Coba Fitur AI",
  },
  {
    id: 3,
    title: "Belanja Buku Makin Pintar & Mudah.",
    subtitle: "Era baru toko buku cerdas yang mengerti kamu telah hadir. Temukan bacaan favoritmu sekarang.",
    imageUrl: "/images/banner-hijau.jpg",
    imageBg: "from-green-700/80 to-transparent",
    href: "#",
    ctaText: "Eksplor Sekarang",
  },
];

export const HERO_SIDE_BANNERS = [
  {
    id: 1,
    type: "video",
    mediaUrl: "/videos/promo-video.mp4",
    tag: "HIGHLIGHT",
    title: "Tonton Cuplikan Buku Populer",
    desc: "Review visual eksklusif buku terlaris bulan ini.",
    bgColor: "from-black/80 via-black/30 to-transparent",
    href: "#",
    ctaText: "Tonton Sekarang",
  },
  {
    id: 2,
    type: "image",
    mediaUrl: "/images/komunitas-banner.jpg",
    tag: "KOMUNITAS READR",
    title: "Jangan Baca Sendirian!",
    desc: "Ngobrol bareng sesama bookworm, bahas buku favorit, semudah pakai WA.",
    bgColor: "from-blue-900/90 via-blue-900/40 to-transparent",
    href: "#",
    ctaText: "Gabung Diskusi",
  },
];