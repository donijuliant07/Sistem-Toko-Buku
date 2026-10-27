"use client";

import React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  CreditCard,
  Truck,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import ReadrLogo from "@/components/ReadrLogo";

export type InfoModalTab =
  | "cara-belanja"
  | "pembayaran"
  | "pengiriman"
  | "kebijakan";

interface FooterInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: InfoModalTab;
  onTabChange: (tab: InfoModalTab) => void;
}

export default function FooterInfoModal({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
}: FooterInfoModalProps) {
  const waUrl = `https://wa.me/${siteConfig.whatsappNumber}?text=Halo%20Readr,%20saya%20ingin%20bertanya%20tentang%20layanan%20toko.`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl bg-white border border-gray-100 shadow-2xl">
        {/* Modal Header */}
        <DialogHeader className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40">
          <div className="flex items-center gap-2.5">
            <ReadrLogo size="md" showText={false} />
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Pusat Informasi & Panduan Pembeli
              </DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Segala hal yang perlu kamu ketahui tentang berbelanja di {siteConfig.brandName}
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-2">
            <button
              type="button"
              onClick={() => onTabChange("cara-belanja")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "cara-belanja"
                  ? "bg-[#0052cc] text-white shadow-sm"
                  : "bg-white/80 hover:bg-white text-gray-600 border border-gray-200/80"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Cara Belanja</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("pembayaran")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "pembayaran"
                  ? "bg-[#0052cc] text-white shadow-sm"
                  : "bg-white/80 hover:bg-white text-gray-600 border border-gray-200/80"
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pembayaran</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("pengiriman")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "pengiriman"
                  ? "bg-[#0052cc] text-white shadow-sm"
                  : "bg-white/80 hover:bg-white text-gray-600 border border-gray-200/80"
              }`}
            >
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pengiriman</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("kebijakan")}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "kebijakan"
                  ? "bg-[#0052cc] text-white shadow-sm"
                  : "bg-white/80 hover:bg-white text-gray-600 border border-gray-200/80"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Garansi & Privasi</span>
            </button>
          </div>
        </DialogHeader>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[50vh] text-sm">
          {/* 1. Cara Belanja */}
          {activeTab === "cara-belanja" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-900 bg-blue-50/70 p-3 rounded-xl border border-blue-100/80">
                <ShoppingBag className="w-5 h-5 text-[#0052cc] shrink-0" />
                <span className="text-xs font-medium">
                  Belanja buku favoritmu mudah dan cepat hanya dalam 4 langkah praktis.
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                      Pilih Buku Favorit
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Jelajahi koleksi buku terlaris, kategori pilihan, atau gunakan fitur pencarian &amp; konsultasi AI Book Advisor.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                      Masukkan ke Keranjang &amp; Cek Detail
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Klik buku untuk membaca ulasan AI bebas spoiler, cek stok langsung, atau bandingkan harga dengan marketplace lain.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                      Checkout &amp; Isi Alamat Pengiriman
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Isi data penerima secara lengkap dan pilih opsi kurir pengiriman yang diinginkan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-6 h-6 rounded-full bg-[#0052cc] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                      Bayar Aman &amp; Lacak Pesanan
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Selesaikan transaksi menggunakan QRIS atau Virtual Account. Status dan resi pengiriman dapat dipantau langsung di menu{" "}
                      <Link
                        href="/orders"
                        onClick={onClose}
                        className="text-[#0052cc] font-semibold underline"
                      >
                        Lacak Pesanan
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Metode Pembayaran */}
          {activeTab === "pembayaran" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-900 bg-emerald-50/70 p-3 rounded-xl border border-emerald-100/80">
                <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium">
                  Semua transaksi diproses secara instan dan aman melalui Payment Gateway berstandar enkripsi resmi.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>QRIS (Instant)</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Dukung semua e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja) dan seluruh aplikasi mobile banking di Indonesia.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Virtual Account Bank</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Transfer otomatis tanpa verifikasi manual via BCA, Mandiri, BNI, BRI, dan Permata Bank (24 Jam).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Poin Hadiah Member</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Kumpulkan poin dari setiap pembelian buku dan tukarkan langsung menjadi voucher potongan belanja di halaman{" "}
                    <Link
                      href="/poin"
                      onClick={onClose}
                      className="text-[#0052cc] font-semibold underline"
                    >
                      Poin Reward
                    </Link>
                    .
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-gray-900 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Enkripsi 3D Secure</span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Semua transaksi dilindungi sistem keamanan enkripsi TLS/SSL tingkat tinggi, bebas penipuan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Biaya & Pengiriman */}
          {activeTab === "pengiriman" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-900 bg-indigo-50/70 p-3 rounded-xl border border-indigo-100/80">
                <Truck className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-xs font-medium">
                  Pengiriman cepat dan terpercaya ke seluruh penjuru Nusantara.
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    📦 Pengemasan Berlapis Ekstra Aman (Gratis)
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Setiap pesanan buku dikemas dengan bubble wrap tebal dan kardus pelindung khusus secara cuma-cuma, sehingga buku tidak mudah penyok, tertekuk, atau rusak karena basah.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    ⏱️ Estimasi Waktu Pengiriman
                  </h4>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside mt-1">
                    <li>Jabodetabek: 1 - 2 hari kerja</li>
                    <li>Pulau Jawa &amp; Bali: 2 - 3 hari kerja</li>
                    <li>Luar Pulau Jawa: 3 - 6 hari kerja (tergantung kota tujuan)</li>
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    🔍 Pelacakan Resi Otomatis
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Setelah paket diserahkan ke kurir (JNE, SiCepat, J&amp;T), nomor resi akan langsung aktif dan bisa kamu pantau di halaman{" "}
                    <Link
                      href="/orders"
                      onClick={onClose}
                      className="text-[#0052cc] font-semibold underline"
                    >
                      Lacak Pesanan
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4. Garansi & Privasi */}
          {activeTab === "kebijakan" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-900 bg-amber-50/70 p-3 rounded-xl border border-amber-100/80">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-xs font-medium">
                  Komitmen kami: 100% buku original resmi penerbit dengan jaminan kenyamanan pembaca.
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    🛡️ Jaminan 100% Buku Asli / Original
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {siteConfig.brandName} menolak keras buku bajakan. Seluruh katalog kami disuplai langsung dari penerbit resmi nasional dan internasional (Gramedia, Mizan, Erlangga, Periplus, dll).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    🔄 Garansi Retur 3x24 Jam
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Apabila buku yang kamu terima mengalami cacat cetak pabrik (halaman hilang, cetakan buram/terbalik), hubungi CS kami dalam 3 hari untuk penggantian buku baru tanpa dipungut biaya tambahan.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                  <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                    🔒 Keamanan &amp; Privasi Data
                  </h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Alamat, nomor telepon, dan data akun kamu dijaga kerahasiaannya dengan ketat dan tidak akan pernah dibagikan atau diperjualbelikan kepada pihak mana pun.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-gray-500 text-center sm:text-left">
            Butuh bantuan lebih lanjut terkait pesananmu?
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25d366] hover:bg-[#20ba59] text-white font-semibold transition-colors shadow-2xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat WhatsApp</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 font-semibold border border-gray-200 transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

