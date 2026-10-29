import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  HelpCircle,
  Mail,
  MessageCircle,
  Plus,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Bantuan",
  description: "Pertanyaan yang sering muncul soal pesanan, pembayaran, poin, dan akun Readr.",
};

/** Urutan mengikuti kekerapan masalah, bukan urutan fitur di aplikasi. */
const guides = [
  {
    title: "Membayar pesanan",
    steps: [
      "Buka pesanan di halaman Lacak Pesanan, lalu lihat nominal dan rekening tujuan.",
      "Transfer sesuai nominal — jangan dibulatkan, karena admin mencocokkan angka persis.",
      "Unggah foto atau tangkapan layar bukti transfer pada pesanan yang sama.",
      "Tunggu verifikasi. Status berubah menjadi Lunas setelah admin menerimanya.",
    ],
  },
  {
    title: "Bukti pembayaran ditolak",
    steps: [
      "Buka detail pesanan dan baca alasan penolakannya.",
      "Perbaiki penyebabnya: foto buram, nominal kurang, atau rekening berbeda.",
      "Unggah ulang bukti yang benar selama pesanan belum kedaluwarsa (24 jam sejak dibuat).",
    ],
  },
  {
    title: "Pesanan dibatalkan otomatis",
    steps: [
      "Pesanan yang tidak dibayar dalam 24 jam dibatalkan dan stoknya dikembalikan.",
      "Jika kamu sudah transfer tetapi pesanan sudah batal, hubungi kami dengan bukti transfer dan nomor pesanan.",
    ],
  },
  {
    title: "Poin tidak bertambah",
    steps: [
      "Poin pembelian diberikan setelah pesanan berstatus Selesai, bukan saat dibayar.",
      "Periksa riwayat poin di halaman Poin untuk melihat setiap perubahan dan sumbernya.",
      "Pesanan yang dibatalkan akan menarik kembali poin yang pernah diberikan.",
    ],
  },
  {
    title: "Lupa kata sandi",
    steps: [
      "Dari halaman Masuk, pilih Lupa kata sandi dan masukkan email akunmu.",
      "Buka email reset, klik tautannya, lalu isi kata sandi baru.",
      <>Tautan hanya berlaku sekali. Jika sudah kedaluwarsa, <Link href="/forgot-password">minta tautan baru</Link>.</>,
    ],
  },
];

const faqs = [
  {
    q: "Apakah boleh bayar di tempat?",
    a: "Belum. Saat ini semua pembayaran lewat transfer manual dan diverifikasi admin sebelum pesanan diproses.",
  },
  {
    q: "Berapa lama pesanan dikirim?",
    a: "Pesanan diproses setelah pembayaran terverifikasi. Lama pengiriman tergantung kurir yang kamu pilih dan ditampilkan saat memilih layanan.",
  },
  {
    q: "Bisakah mengganti alamat setelah pesanan dibuat?",
    a: "Belum bisa dari aplikasi. Hubungi kami secepatnya sebelum pesanan dikirim; jika paket sudah dalam perjalanan, alamat tidak dapat diubah.",
  },
  {
    q: "Apakah poin bisa diuangkan?",
    a: "Tidak. Poin hanya bisa dipakai untuk fitur AI Readr dan tidak berpindah ke akun lain.",
  },
];

export default function SupportPage() {
  const waNumber = siteConfig.whatsappNumber.replace(/\D/g, "");
  // Nomor disimpan format internasional (`62…`) agar tautan wa.me valid, tetapi
  // pembaca Indonesia lebih akrab melihatnya sebagai `08…`.
  const waDisplay = waNumber.startsWith("62") ? `0${waNumber.slice(2)}` : waNumber;

  return (
    <div className="admin-theme min-h-screen bg-[var(--background)] font-sans text-[var(--foreground)] antialiased selection:bg-blue-600 selection:text-white">
      <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 pb-24 sm:p-6 lg:p-8">
        {/* 1. Header Banner */}
        <header className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                Pusat Bantuan
              </span>
              <span className="text-xs text-zinc-400">•</span>
              <span className="text-xs font-medium text-zinc-500">Readr Storefront</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Bantuan</h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed font-normal text-zinc-600 sm:text-sm">
              Mulai dari masalah yang paling dekat: pesanan, pembayaran, atau akun. Sebagian besar
              pertanyaan selesai tanpa perlu menghubungi siapa pun.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-xs transition-all hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-zinc-600" />
              <span>Kembali ke Toko</span>
            </Link>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white shadow-xs transition-all hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span>Lacak Pesanan</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {/* 2. Panduan + Panel Kontak */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5 pb-4">
                <div>
                  <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-zinc-900">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span>Panduan Singkat</span>
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-zinc-600">
                    {guides.length} langkah penyelesaian masalah tersering
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {guides.length} Topik
                </span>
              </div>

              <div className="divide-y divide-zinc-100">
                {guides.map((guide, guideIndex) => (
                  <section
                    key={guide.title}
                    className="p-5 transition-colors hover:bg-zinc-50/70 sm:p-6"
                  >
                    <h3 className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-zinc-900">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-50 px-1.5 font-mono text-[11px] font-semibold text-blue-600 tabular-nums">
                        {String(guideIndex + 1).padStart(2, "0")}
                      </span>
                      {guide.title}
                    </h3>
                    <ol className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-600">
                      {guide.steps.map((step, index) => (
                        <li key={index} className="flex gap-2.5">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 font-mono text-[10px] font-semibold text-zinc-500 tabular-nums">
                            {index + 1}
                          </span>
                          <span className="min-w-0 [&_a]:font-medium [&_a]:text-zinc-900 [&_a]:underline [&_a]:decoration-blue-500 [&_a]:decoration-2 [&_a]:underline-offset-4">
                            {step}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5 pb-4">
                <div>
                  <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-zinc-900">
                    <HelpCircle className="h-4 w-4 text-blue-600" />
                    <span>Pertanyaan Umum</span>
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-zinc-600">
                    Klik untuk membuka jawabannya
                  </p>
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {faqs.map((faq) => (
                  <details key={faq.q} className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 text-sm font-semibold text-zinc-900 transition-colors marker:content-none hover:bg-zinc-50/70 [&::-webkit-details-marker]:hidden">
                      {faq.q}
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 transition-transform group-open:rotate-45"
                      >
                        <Plus className="h-3 w-3" />
                      </span>
                    </summary>
                    <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-600">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
              <h2 className="text-xs font-semibold tracking-tight text-zinc-600">
                Butuh Bantuan Manusia?
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Siapkan nomor pesananmu agar kami bisa langsung memeriksa.
              </p>
              <ul className="mt-4 space-y-2">
                <li>
                  <a
                    href={`mailto:${siteConfig.adminEmail}`}
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-zinc-500">Email</span>
                      <span className="block truncate text-xs font-semibold text-zinc-900">
                        {siteConfig.adminEmail}
                      </span>
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] text-zinc-500">WhatsApp</span>
                      <span className="block truncate text-xs font-semibold text-zinc-900 tabular-nums">
                        {waDisplay}
                      </span>
                    </span>
                  </a>
                </li>
              </ul>
              <Link
                href="/orders"
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white shadow-xs transition-all hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span>Lacak Pesanan</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
              <h3 className="text-xs font-semibold tracking-tight text-zinc-600">Dokumen Lain</h3>
              <div className="mt-3 space-y-1">
                <Link
                  href="/terms"
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900"
                >
                  <span>Ketentuan</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
                </Link>
                <Link
                  href="/privacy"
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900"
                >
                  <span>Privasi</span>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
                </Link>
              </div>
            </div>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 text-xs text-zinc-500 shadow-xs">
          <p>© {new Date().getFullYear()} Readr</p>
          <div className="flex gap-5">
            <Link href="/terms" className="font-medium transition-colors hover:text-zinc-900">
              Ketentuan
            </Link>
            <Link href="/privacy" className="font-medium transition-colors hover:text-zinc-900">
              Privasi
            </Link>
            <Link href="/support" className="font-medium transition-colors hover:text-zinc-900">
              Bantuan
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}