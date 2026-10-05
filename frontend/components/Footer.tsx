import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-12 text-gray-600 text-xs">
      <div className="max-w-[1200px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info & App Badges */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                G
              </div>
              <span className="font-extrabold text-lg text-[#0052cc] tracking-tight">
                {siteConfig.brandName}
              </span>
            </div>
            <p className="text-gray-500 text-xs leading-relaxed max-w-sm">
              {siteConfig.tagline}
            </p>

            {/* Mobile App Badges */}
            <div className="pt-2">
              <span className="font-bold text-gray-800 block mb-2 text-xs">
                Aplikasi Seluler Kami
              </span>
              <div className="flex items-center gap-3">
                <a
                  href="#appstore"
                  className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-black transition-colors"
                >
                  <span className="text-lg">🍎</span>
                  <div className="text-left">
                    <span className="block text-[9px] text-gray-400 leading-none">Download on</span>
                    <span className="text-[11px] font-bold leading-none">App Store</span>
                  </div>
                </a>
                <a
                  href="#playstore"
                  className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-black transition-colors"
                >
                  <span className="text-lg">▶️</span>
                  <div className="text-left">
                    <span className="block text-[9px] text-gray-400 leading-none">GET IT ON</span>
                    <span className="text-[11px] font-bold leading-none">Google Play</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Social Media */}
            <div className="pt-2">
              <span className="font-bold text-gray-800 block mb-2 text-xs">
                Ikuti Media Sosial Kami
              </span>
              <div className="flex items-center gap-2 text-gray-500">
                <a
                  href={siteConfig.socials.facebook}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-blue-50 hover:text-[#0052cc] transition-colors"
                  aria-label="Facebook"
                >
                  f
                </a>
                <a
                  href={siteConfig.socials.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 hover:text-black transition-colors"
                  aria-label="X"
                >
                  𝕏
                </a>
                <a
                  href={siteConfig.socials.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-pink-50 hover:text-pink-600 transition-colors"
                  aria-label="Instagram"
                >
                  📸
                </a>
                <a
                  href={siteConfig.socials.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 hover:text-black transition-colors"
                  aria-label="TikTok"
                >
                  🎵
                </a>
              </div>
            </div>
          </div>

          {/* Links Column 1 */}
          <div>
            <h5 className="font-bold text-gray-900 mb-3 text-sm">Produk Gramedia</h5>
            <ul className="space-y-2 text-gray-500">
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Buku & E-book</Link></li>
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Alat Tulis & Kantor</Link></li>
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Mainan & Hobi</Link></li>
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Komputer & IT</Link></li>
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Fashion & Tas</Link></li>
              <li><Link href="#katalog" className="hover:text-[#0052cc]">Majalah & Tabloid</Link></li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div>
            <h5 className="font-bold text-gray-900 mb-3 text-sm">Informasi Belanja</h5>
            <ul className="space-y-2 text-gray-500">
              <li><Link href="#cara-beli" className="hover:text-[#0052cc]">Cara Berbelanja</Link></li>
              <li><Link href="#pembayaran" className="hover:text-[#0052cc]">Metode Pembayaran</Link></li>
              <li><Link href="#pengiriman" className="hover:text-[#0052cc]">Biaya & Pengiriman</Link></li>
              <li><Link href="#pengembalian" className="hover:text-[#0052cc]">Garansi & Retur</Link></li>
              <li><Link href="#faq" className="hover:text-[#0052cc]">Syarat & Ketentuan</Link></li>
              <li><Link href="#faq" className="hover:text-[#0052cc]">Kebijakan Privasi</Link></li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div>
            <h5 className="font-bold text-gray-900 mb-3 text-sm">Tentang Gramedia</h5>
            <ul className="space-y-2 text-gray-500">
              <li><Link href="#tentang" className="hover:text-[#0052cc]">Profil Perusahaan</Link></li>
              <li><Link href="#karir" className="hover:text-[#0052cc]">Karir & Rekrutmen</Link></li>
              <li><Link href="#kerjasama" className="hover:text-[#0052cc]">Kerjasama Korporat</Link></li>
              <li><Link href="#affiliate" className="hover:text-[#0052cc]">Program Affiliate</Link></li>
              <li><Link href="/admin/books" className="hover:text-[#0052cc]">Portal Admin</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-gray-400 gap-4">
          <p>© 2026 PT Gramedia Asri Media. Hak Cipta Dilindungi.</p>
          <div className="flex items-center gap-4 text-xs">
            <span>Indonesia</span>
            <span>•</span>
            <span>Versi Web 2.4.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
