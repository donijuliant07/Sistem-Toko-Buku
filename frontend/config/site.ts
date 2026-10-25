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
  brandName: "Readr",
  tagline: "Toko Buku Online Terbesar, Terlengkap dan Terpercaya di Indonesia",
  // Anchor harus menunjuk ke `id` yang benar-benar ada di beranda. Tautan tanpa
  // halaman tujuan ("Tentang Kami", "Voucher Diskon") dihapus: sebelumnya
  // berakhir di `href="#"` / `#promo` yang tidak membawa ke mana pun.
  promoTags: [
    { label: "Buku Pilihan", href: "/#katalog" },
    { label: "Buku Terlaris", href: "/#buku-terlaris" },
    { label: "Back to Campus", href: "/#edukasi" },
    { label: "Brand Pilihan", href: "/#buku-unggulan" },
    { label: "Komunitas", href: "/komunitas" },
  ],
  socials: {
    facebook: "https://facebook.com/inforbook",
    twitter: "https://twitter.com/inforbook",
    instagram: "https://instagram.com/inforbook",
    tiktok: "https://tiktok.com/@inforbook",
  },
  // Hanya tautan yang punya halaman ("Lacak Pesanan"). "Tentang Kami" dan
  // "Bantuan & FAQ" belum punya halaman, jadi tidak dipasang sebagai `#`.
  topBarLinks: [
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
