import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";

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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface-muted">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 lg:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span aria-hidden="true">←</span> Readr
          </Link>
          <h1 className="mt-6 max-w-[22ch] font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Bantuan
          </h1>
          <div className="mt-5 h-px w-16 bg-accent" aria-hidden="true" />
          <p className="mt-5 max-w-[62ch] text-[15px] leading-7 text-muted-foreground">
            Mulai dari masalah yang paling dekat: pesanan, pembayaran, atau akun. Sebagian
            besar pertanyaan selesai tanpa perlu menghubungi siapa pun.
          </p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16 lg:py-14">
        <div className="min-w-0">
          <h2 className="font-display text-2xl tracking-tight">Panduan singkat</h2>
          <div className="mt-6 space-y-10">
            {guides.map((guide) => (
              <section key={guide.title}>
                <h3 className="text-base font-semibold">{guide.title}</h3>
                <ol className="mt-3 space-y-2 border-l border-border pl-5 text-[15px] leading-7 text-muted-foreground">
                  {guide.steps.map((step, index) => (
                    <li key={index} className="relative">
                      <span className="absolute -left-5 top-0 w-4 text-right font-mono text-xs tabular-nums text-accent">
                        {index + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>

          <h2 className="mt-14 font-display text-2xl tracking-tight">Pertanyaan umum</h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 font-mono text-accent transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[62ch] text-[15px] leading-7 text-muted-foreground">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="border-t-2 border-accent bg-surface-muted p-6">
            <h2 className="text-base font-semibold">Butuh bantuan manusia?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Siapkan nomor pesananmu agar kami bisa langsung memeriksa.
            </p>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <span className="block text-xs text-muted-foreground">Email</span>
                <a
                  href={`mailto:${siteConfig.adminEmail}`}
                  className="font-medium underline decoration-accent decoration-2 underline-offset-4"
                >
                  {siteConfig.adminEmail}
                </a>
              </li>
              <li>
                <span className="block text-xs text-muted-foreground">WhatsApp</span>
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline decoration-accent decoration-2 underline-offset-4"
                >
                  +{waNumber}
                </a>
              </li>
            </ul>
            <Link
              href="/orders"
              className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Lacak pesanan
            </Link>
          </div>

          <p className="mt-6 text-xs leading-6 text-muted-foreground">
            Soal data pribadi? Lihat{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              kebijakan privasi
            </Link>{" "}
            dan{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
              ketentuan layanan
            </Link>
            .
          </p>
        </aside>
      </div>
    </main>
  );
}