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

export const CATEGORIES = [
  { id: "semua", name: "Semua", icon: "all" },
  { id: "buku-anak", name: "Buku Anak", icon: "book" },
  { id: "religi", name: "Religi", icon: "mosque" },
  { id: "biografi", name: "Biografi", icon: "user" },
  { id: "fiksi-sastra", name: "Fiksi & Sastra", icon: "feather" },
  { id: "self-dev", name: "Self-Dev", icon: "sparkles" },
  { id: "bisnis", name: "Bisnis", icon: "briefcase" },
  { id: "edukasi", name: "Edukasi", icon: "graduation" },
  {
    id: "manga",
    name: "Komik & Manga",
    icon: "/images/naruto-icon.jpg", 
    href: "/kategori/manga",
  },
];

export const HERO_BANNERS = [
  {
    id: 1,
    imageUrl: "/images/banner-kuning.jpg",
    href: "#",
  },
  {
    id: 2,
    imageUrl: "/images/banner-ungu.jpg",
    href: "#",
  },
  {
    id: 3,
    imageUrl: "/images/banner-hijau.jpg",
    href: "#",
  },
];

export const HERO_SIDE_BANNERS = [
  {
    id: 1,
    type: "video",
    mediaUrl: "/videos/promo-video.mp4",
    href: "#",
  },
  {
    id: 2,
    type: "image",
    mediaUrl: "/images/komunitas-banner.jpg",
    href: "komunitas",
  },
];