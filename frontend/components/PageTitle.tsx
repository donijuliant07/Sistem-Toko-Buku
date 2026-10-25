"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Judul tab untuk rute yang halamannya komponen klien.
 *
 * Next hanya mengizinkan `export const metadata` di Server Component, sedangkan
 * hampir semua halaman di aplikasi ini `"use client"`. Untuk rute publik yang
 * penting bagi SEO (beranda, detail buku) judul tetap datang dari metadata di
 * server; komponen ini melengkapi rute di balik login (admin, checkout,
 * pesanan, poin, komunitas) yang tidak diindeks mesin pencari.
 *
 * Rute yang judulnya sudah ditetapkan metadata server (beranda, detail buku,
 * dashboard admin) sengaja TIDAK didaftarkan di sini supaya keduanya tidak
 * saling menimpa.
 */
const TITLES: Array<[RegExp, string]> = [
  [/^\/login$/, "Masuk"],
  [/^\/register$/, "Daftar Akun"],
  [/^\/checkout$/, "Penyelesaian Pesanan"],
  [/^\/orders$/, "Riwayat Pesanan"],
  [/^\/orders\/[^/]+\/payment$/, "Pembayaran Pesanan"],
  [/^\/orders\/[^/]+$/, "Detail Pesanan"],
  [/^\/poin$/, "Poin Rewards"],
  [/^\/komunitas$/, "Komunitas"],
  [/^\/admin\/pesanan$/, "Kelola Pesanan"],
  [/^\/admin\/pembayaran$/, "Verifikasi Pembayaran"],
  [/^\/admin\/produk$/, "Kelola Produk"],
  [/^\/admin\/inventori$/, "Inventori & Stok"],
  [/^\/admin\/pelanggan$/, "Pelanggan"],
  [/^\/admin\/promo$/, "Promo & Voucher"],
  [/^\/admin\/laporan$/, "Laporan Penjualan"],
  [/^\/admin\/rewards$/, "Poin & Reward"],
  [/^\/admin\/marketplace-sources$/, "Link Harga Marketplace"],
  [/^\/admin\/pengaturan$/, "Pengaturan Admin"],
];

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname ?? ""));
    if (match) document.title = `${match[1]} | Readr`;
  }, [pathname]);

  return null;
}
