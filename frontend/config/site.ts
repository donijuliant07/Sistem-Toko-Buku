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
  brandName: "InforBook",
  tagline: "Toko Buku Online Terbesar, Terlengkap dan Terpercaya di Indonesia",
  promoTags: [
    { label: "Buku Pilihan", href: "#katalog" },
    { label: "Buku Terlaris", href: "#buku-terlaris" },
    { label: "Back to Campus", href: "#back-to-campus" },
    { label: "Brand Pilihan", href: "#brand-pilihan" },
    { label: "Komunitas", href: "/komunitas" },
    // Tidak ada tautan ke area admin dari storefront publik.
    { label: "Voucher Diskon", href: "#promo", isHighlight: true },
  ],
  socials: {
    facebook: "https://facebook.com/inforbook",
    twitter: "https://twitter.com/inforbook",
    instagram: "https://instagram.com/inforbook",
    tiktok: "https://tiktok.com/@inforbook",
  },
  topBarLinks: [
    { label: "Tentang Kami", href: "#" },
    { label: "Bantuan & FAQ", href: "#" },
    { label: "Lacak Pesanan", href: "/orders" },
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
