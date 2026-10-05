export const siteConfig = {
  name: "PustakaGram",
  shortName: "Pustaka",
  description: "Platform Toko Buku Online Modern Terlengkap",
  url: "https://pustakagram.local",
  author: "PustakaGram Team",
  whatsappNumber: "6281234567890",
  adminEmail: "admin@pustakagram.com",
  adminUser: {
    name: "Rendy Pratama",
    email: "rendy@pustakagram.com",
    role: "Super Admin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  brandName: "Gramedia",
  tagline: "Toko Buku Online Terbesar, Terlengkap dan Terpercaya di Indonesia",
  promoTags: [
    { label: "Buku Pilihan", href: "#katalog" },
    { label: "Buku Terlaris", href: "#buku-terlaris" },
    { label: "Back to Campus", href: "#back-to-campus" },
    { label: "Brand Pilihan", href: "#brand-pilihan" },
    { label: "Voucher Diskon", href: "/admin/promo", isHighlight: true },
  ],
  socials: {
    facebook: "https://facebook.com/gramediabooks",
    twitter: "https://twitter.com/gramedia",
    instagram: "https://instagram.com/gramedia",
    tiktok: "https://tiktok.com/@gramedia",
  },
  topBarLinks: [
    { label: "Tentang Kami", href: "#" },
    { label: "Bantuan & FAQ", href: "#" },
    { label: "Lacak Pesanan", href: "/admin/pesanan" },
  ],
  links: {
    dashboard: "/admin/dashboard",
    products: "/admin/produk",
    orders: "/admin/pesanan",
    customers: "/admin/pelanggan",
    inventory: "/admin/inventori",
    promos: "/admin/promo",
    reports: "/admin/laporan",
    settings: "/admin/pengaturan",
  },
}

export type SiteConfig = typeof siteConfig
