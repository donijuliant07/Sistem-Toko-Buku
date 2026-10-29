import type { Metadata } from "next";
import Link from "next/link";
import DocumentShell, { type DocSection } from "@/components/legal/DocumentShell";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Ketentuan Layanan",
  description: "Aturan penggunaan Readr: akun, pesanan, pembayaran, pengembalian, dan poin.",
};

const sections: DocSection[] = [
  {
    id: "akun",
    title: "Akun",
    body: (
      <>
        <p>
          Satu akun dipakai satu orang dan tidak boleh dipinjamkan. Kamu bertanggung jawab
          atas keamanan kata sandi dan atas semua pesanan yang dibuat dari akunmu.
        </p>
        <p>
          Data yang kamu isi saat mendaftar harus benar. Nama penerima dan alamat yang salah
          bisa membuat pesanan dikirim ke tempat yang keliru, dan itu bukan tanggung jawab
          Readr.
        </p>
      </>
    ),
  },
  {
    id: "pesanan",
    title: "Pesanan",
    body: (
      <>
        <p>
          Pesanan yang belum dibayar berlaku <strong>24 jam</strong> sejak dibuat. Setelah
          lewat, pesanan dibatalkan otomatis dan stoknya kembali tersedia untuk pembeli lain.
        </p>
        <p>
          Harga, stok, dan ongkos kirim dihitung ulang oleh server saat pesanan dibuat. Bila
          terjadi selisih yang membuat pesanan tidak bisa dipenuhi, kami membatalkan pesanan
          dan mengembalikan dana yang sudah kamu bayar.
        </p>
      </>
    ),
  },
  {
    id: "pembayaran",
    title: "Pembayaran",
    body: (
      <>
        <p>
          Pembayaran dilakukan dengan transfer manual. Setelah mengirim dana, unggah bukti
          transfer di halaman pesanan. Pesanan berstatus <strong>menunggu verifikasi</strong>{" "}
          sampai bukti diperiksa admin — status ini belum berarti lunas.
        </p>
        <p>
          Bukti yang tidak terbaca atau nominalnya tidak sesuai akan ditolak dengan alasan.
          Kamu bisa mengunggah bukti baru selama pesanan masih berlaku.
        </p>
      </>
    ),
  },
  {
    id: "pengembalian",
    title: "Pengembalian",
    body: (
      <>
        <p>
          Kirim buku yang tidak sesuai sampai <strong>3 hari</strong> setelah diterima, dalam
          kondisi masih layak dibaca, beserta nomor pesanan. Buku rusak akibat pengiriman
          diganti tanpa biaya tambahan.
        </p>
        <p>
          Pengembalian karena berubah pikiran hanya bisa dilakukan bila buku masih tersegel.
          Buku digital dan konten yang sudah dibuka tidak dapat dikembalikan.
        </p>
      </>
    ),
  },
  {
    id: "poin",
    title: "Poin dan reward",
    body: (
      <>
        <p>
          Poin diberikan setelah pesanan berstatus <strong>selesai</strong>: 10 poin per
          kelipatan Rp10.000 dari total pesanan. Ulasan yang disetujui moderator memberi 20
          poin, kontribusi diskusi 5 poin, dan jawaban yang ditandai membantu 10 poin.
        </p>
        <p>
          Poin bisa dipakai untuk fitur AI Readr: 10 poin per pesan Book Advisor, 100 poin
          untuk ulasan AI tingkat sedang, dan 300 poin untuk tingkat berat. Pesanan yang
          dibatalkan menarik kembali poin yang sudah diberikan.
        </p>
        <p>
          Poin tidak bisa ditukar dengan uang dan tidak berpindah ke akun lain.
        </p>
      </>
    ),
  },
  {
    id: "isi",
    title: "Isi dan komunitas",
    body: (
      <>
        <p>
          Ulasan dan diskusi di komunitas harus ditulis sendiri, dengan hormat, dan tanpa
          membocorkan isi cerita yang bisa merusak pengalaman pembaca lain. Sertakan penanda
          spoiler bila perlu.
        </p>
        <p>
          Kami dapat menyembunyikan atau menghapus kiriman yang melanggar, dan menonaktifkan
          akun yang berulang kali melanggar.
        </p>
      </>
    ),
  },
  {
    id: "perubahan",
    title: "Perubahan ketentuan",
    body: (
      <>
        <p>
          Ketentuan ini dapat berubah. Perubahan penting diumumkan di halaman ini beserta
          tanggal berlakunya, dan pesanan yang sudah dibuat tetap mengikuti ketentuan saat
          pesanan itu dibuat.
        </p>
        <p>
          Ada yang ingin ditanyakan? <Link href="/support">Hubungi kami</Link> atau baca{" "}
          <Link href="/privacy">kebijakan privasi</Link>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <DocumentShell
      current="/terms"
      title="Ketentuan Layanan"
      intro="Aturan yang berlaku saat kamu memakai Readr. Ditulis agar bisa dibaca sekali duduk, bukan untuk disembunyikan."
      facts={[
        { label: "Berlaku sejak", value: "1 Oktober 2026" },
        { label: "Diperbarui", value: "29 Okt 2026" },
        { label: "Masa bayar pesanan", value: "24 jam" },
        { label: "Kontak", value: siteConfig.adminEmail },
      ]}
      sections={sections}
    />
  );
}