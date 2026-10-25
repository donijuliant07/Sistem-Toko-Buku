"use client";

import React from "react";
import Link from "next/link";
import { Send, Globe } from "lucide-react";
import { siteConfig } from "@/config/site";

/** Kategori belum punya halaman sendiri; semuanya memfilter katalog di beranda. */
const PRODUCT_LINKS = [
  "Buku & E-book",
  "Alat Tulis & Kantor",
  "Mainan & Hobi",
  "Komputer & IT",
  "Majalah & Tabloid",
];

/** Halaman informasi belum ada di aplikasi, jadi ditampilkan tanpa tautan. */
const INFO_LINKS = [
  "Cara Berbelanja",
  "Metode Pembayaran",
  "Biaya & Pengiriman",
  "Syarat & Ketentuan",
  "Kebijakan Privasi",
];

export default function Footer() {
  return (
    <footer className="relative text-gray-900 border-t border-gray-100 overflow-hidden pt-16 pb-8 select-none bg-white">
      {/* 
        ========================================
        VIDEO / ANIMATED BACKGROUND SECTION
        ========================================
      */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Tambahan scale-125 untuk membesarkan (zoom) video agar memenuhi area dengan lebih baik */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 min-w-full min-h-full w-auto h-auto object-cover -translate-x-1/2 -translate-y-1/2 scale-125"
        >
          <source src="/videos/animasi-footer.mp4" type="video/mp4" />
        </video>

        {/* Gradien transisi di sisi atas agar menyatu halus (tidak kepotong) dengan seksi di atasnya */}
        <div className="absolute top-0 left-0 w-full h-48 bg-linear-to-b from-white via-white/80 to-transparent z-10"></div>

        {/* Tingkat putih diturunkan ke bg-white/40 dan efek blur dikurangi agar video lebih terang & jelas */}
        <div className="absolute inset-0 bg-white/40 z-0"></div>
      </div>

      {/* KONTEN FOOTER UTAMA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 pb-12 border-b border-gray-200/60">
          {/* Col 1: Brand Info & Social Links */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center text-white font-black text-lg shadow-sm">
                R
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                Readr
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed max-w-sm">
              Toko buku online terpercaya di Indonesia. Menyediakan ribuan
              koleksi buku fisik & digital terlengkap untuk menemani perjalanan
              literasimu.
            </p>

            {/* Social Media Icons (Brand Colors) */}
            <div className="flex items-center gap-3 pt-2">
              {/* Instagram */}              <a
                href={siteConfig.socials.instagram}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-linear-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white transition-all shadow-sm hover:opacity-90 hover:scale-105"
                title="Instagram"
              >
                <svg
                  className="w-4 h-4 stroke-current fill-none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>

              {/* X / Twitter */}
              <a
                href={siteConfig.socials.twitter}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-black hover:bg-gray-800 flex items-center justify-center text-white transition-all shadow-sm hover:scale-105"
                title="X / Twitter"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>

              {/* TikTok */}
              <a
                href={siteConfig.socials.tiktok}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-900 transition-all border border-gray-200 shadow-sm hover:scale-105"
                title="TikTok"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M16.6 5.82A5.6 5.6 0 0 1 15.3 2h-3.1v13.1a2.6 2.6 0 1 1-1.86-2.5V9.4a5.72 5.72 0 1 0 4.96 5.66V8.9a8.7 8.7 0 0 0 4.7 1.38V7.15a5.6 5.6 0 0 1-3.4-1.33z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links 1 */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
              Produk
            </h3>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((label) => (
                <li key={label}>
                  <Link
                    href="/#katalog"
                    className="text-gray-700 hover:text-[#0052cc] font-medium transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Navigation Links 2 */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
              Informasi
            </h3>
            <ul className="space-y-2 text-sm">
              {INFO_LINKS.map((label) => (
                <li key={label} className="text-gray-700 font-medium">
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Newsletter & Badges */}
          <div className="md:col-span-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
              Berlangganan Newsletter
            </h3>
            <p className="text-xs text-gray-700">
              Dapatkan promo eksklusif dan rekomendasi buku terbaru setiap
              minggu.
            </p>

            {/* Input Newsletter Box */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex items-center gap-2"
            >
              <input
                type="email"
                placeholder="Masukkan email kamu..."
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0052cc]/20 focus:border-[#0052cc] shadow-sm"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-[#0052cc] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Partner / Trust Badges */}
            <div className="pt-2 flex flex-wrap items-center gap-4 opacity-70 grayscale hover:grayscale-0 transition-all">
              <span className="text-xs font-bold tracking-tight text-gray-800">
                Gramedia
              </span>
              <span className="text-xs font-bold tracking-tight text-gray-800">
                Mizan
              </span>
              <span className="text-xs font-bold tracking-tight text-gray-800">
                Erlangga
              </span>
              <span className="text-xs font-bold tracking-tight text-gray-800">
                Periplus
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar / Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600 font-medium">
          <p>© 2026 Readr Media. Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-gray-500" /> Indonesia
            </span>
            <span className="text-gray-300">•</span>
            <span>Versi Desktop</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
