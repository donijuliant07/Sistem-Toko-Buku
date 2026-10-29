export const siteConfig = {
  name: "Readr",
  shortName: "Readr",
  description: "Platform Toko Buku Online Modern Terlengkap",
  url: "https://readr.local",
  author: "Readr Team",
  // Format internasional tanpa "+" agar bisa langsung dipakai tautan wa.me.
  whatsappNumber: "6282193127895",
  adminEmail: "rendyren585@gmail.com",
  adminUser: {
    name: "Rendy Pratama",
    email: "rendy@readr.com",
    role: "Super Admin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
  },
  brandName: "Readr",
  tagline: "Toko Buku Online Terbesar, Terlengkap dan Terpercaya di Indonesia",
  // Tautan navigasi cepat di bawah kolom pencarian header
  promoTags: [
    { label: "Buku Terlaris", href: "/#buku-terlaris" },
    { label: "Rekomendasi Pilihan", href: "/#edukasi" },
    { label: "Buku Baru & Unggulan", href: "/#buku-unggulan" },
    { label: "Katalog Lengkap", href: "/#katalog" },
    { label: "Komunitas", href: "/komunitas" },
    { label: "Poin Reward", href: "/poin" },
  ],
  socials: {
    discord: "https://discord.gg/KJW3aHGVZ",
    github: "https://github.com/r3nddy/Sistem-Toko-Buku",
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
