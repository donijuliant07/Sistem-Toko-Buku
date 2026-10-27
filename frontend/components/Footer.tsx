"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Send, Globe } from "lucide-react";
import { siteConfig } from "@/config/site";
import FooterInfoModal, { type InfoModalTab } from "@/components/FooterInfoModal";
import ReadrLogo from "@/components/ReadrLogo";

/** Tautan koleksi dan kategori buku nyata yang aktif di beranda dan halaman aplikasi */
const PRODUCT_LINKS = [
  { label: "Buku Terlaris", href: "/#buku-terlaris" },
  { label: "Rekomendasi Pilihan", href: "/#edukasi" },
  { label: "Buku Baru & Unggulan", href: "/#buku-unggulan" },
  { label: "Katalog Semua Buku", href: "/#katalog" },
  { label: "Komunitas Pembaca", href: "/komunitas" },
];

/** Tautan informasi interaktif: membuka dialog panduan atau mengarah ke fitur aplikasi */
interface InfoActionItem {
  label: string;
  tab?: InfoModalTab;
  href?: string;
}

const INFO_ACTIONS: InfoActionItem[] = [
  { label: "Cara Berbelanja", tab: "cara-belanja" },
  { label: "Metode Pembayaran", tab: "pembayaran" },
  { label: "Biaya & Pengiriman", tab: "pengiriman" },
  { label: "Garansi & Kebijakan", tab: "kebijakan" },
  { label: "Lacak Pesanan", href: "/orders" },
  { label: "Poin & Hadiah Member", href: "/poin" },
];

export default function Footer() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<InfoModalTab>("cara-belanja");

  const handleOpenModal = (tab: InfoModalTab) => {
    setActiveModalTab(tab);
    setIsModalOpen(true);
  };
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
            <ReadrLogo size="sm" variant="dark" href="/" />
            <p className="text-sm text-gray-700 leading-relaxed max-w-sm">
              Toko buku online terpercaya di Indonesia. Menyediakan ribuan
              koleksi buku fisik & digital terlengkap untuk menemani perjalanan
              literasimu.
            </p>

            {/* Social Media Icons (Brand Colors) */}
            <div className="flex items-center gap-3 pt-2">
              {/* Discord */}
              <a
                href={siteConfig.socials.discord}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-[#5865F2] hover:bg-[#4752C4] flex items-center justify-center text-white transition-all shadow-sm hover:scale-105"
                title="Discord"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>

              {/* GitHub */}
              <a
                href={siteConfig.socials.github}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-gray-900 hover:bg-black flex items-center justify-center text-white transition-all shadow-sm hover:scale-105"
                title="GitHub"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links 1 */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wide uppercase">
              Koleksi Buku
            </h3>
            <ul className="space-y-2 text-sm">
              {PRODUCT_LINKS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-gray-700 hover:text-[#0052cc] font-medium transition-colors inline-block"
                  >
                    {item.label}
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
              {INFO_ACTIONS.map((item) => (
                <li key={item.label}>
                  {item.tab ? (
                    <button
                      type="button"
                      onClick={() => handleOpenModal(item.tab!)}
                      className="text-gray-700 hover:text-[#0052cc] font-medium transition-colors cursor-pointer text-left inline-block"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <Link
                      href={item.href || "/"}
                      className="text-gray-700 hover:text-[#0052cc] font-medium transition-colors inline-block"
                    >
                      {item.label}
                    </Link>
                  )}
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

      {/* Modal Dialog Panduan & Bantuan */}
      <FooterInfoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeTab={activeModalTab}
        onTabChange={setActiveModalTab}
      />
    </footer>
  );
}
