import type { Metadata } from "next";
import Link from "next/link";
import DocumentShell, { type DocSection } from "@/components/legal/DocumentShell";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Data apa yang Readr simpan saat kamu berbelanja, mengapa disimpan, dan cara memintanya dihapus.",
};

const sections: DocSection[] = [
  {
    id: "data",
    title: "Data yang kami simpan",
    body: (
      <>
        <ul>
          <li>
            <strong>Akun:</strong> nama, alamat email, dan kata sandi yang disimpan dalam
            bentuk terenkripsi oleh layanan autentikasi. Kami tidak pernah melihat kata sandi
            aslinya.
          </li>
          <li>
            <strong>Pesanan:</strong> buku yang dibeli, alamat pengiriman, kurir, dan nomor
            telepon penerima.
          </li>
          <li>
            <strong>Pembayaran:</strong> bukti transfer yang kamu unggah dan catatan
            verifikasinya.
          </li>
          <li>
            <strong>Aktivitas:</strong> ulasan, diskusi komunitas, dan riwayat poin.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "tujuan",
    title: "Mengapa data itu dipakai",
    body: (
      <>
        <p>
          Untuk memproses pesanan dan pengiriman, memverifikasi pembayaran, menghitung poin,
          menampilkan ulasan dan diskusi, serta memberi bantuan saat kamu menghubungi kami.
        </p>
        <p>
          Pesan ke AI Book Advisor dipakai untuk menyusun jawaban. Setiap pesan yang diproses
          memotong poin di akunmu, dan tercatat di riwayat poin agar bisa kamu periksa.
        </p>
      </>
    ),
  },
  {
    id: "berbagi",
    title: "Siapa yang melihat data",
    body: (
      <>
        <p>
          Alamat dan nomor telepon penerima dibagikan hanya kepada jasa pengiriman yang kamu
          pilih, sebatas yang dibutuhkan untuk mengantar paket.
        </p>
        <p>
          Data tidak dijual. Data hanya dibuka untuk pihak lain bila diwajibkan hukum atau
          diminta otoritas yang berwenang.
        </p>
      </>
    ),
  },
  {
    id: "bukti",
    title: "Bukti pembayaran",
    body: (
      <>
        <p>
          Bukti transfer disimpan di penyimpanan privat. Hanya kamu dan admin yang menangani
          verifikasi yang bisa membukanya, dan tautannya berlaku terbatas.
        </p>
      </>
    ),
  },
  {
    id: "kendali",
    title: "Kendali atas data kamu",
    body: (
      <>
        <ul>
          <li>Ubah nama atau kata sandi kapan saja dari akun.</li>
          <li>
            Minta salinan atau penghapusan data dengan mengirim email ke{" "}
            <a href={`mailto:${siteConfig.adminEmail}`}>{siteConfig.adminEmail}</a>.
          </li>
          <li>
            Penghapusan akun menghapus data pribadi, tetapi catatan pesanan dan pembayaran
            disimpan dalam bentuk yang tidak lagi menunjuk ke kamu, karena dibutuhkan untuk
            pembukuan.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "keamanan",
    title: "Keamanan",
    body: (
      <>
        <p>
          Akses data dibatasi per peran: pembeli hanya melihat pesanannya sendiri, admin
          melihat data yang diperlukan untuk memproses pesanan dan verifikasi.
        </p>
        <p>
          Tetap kelola kata sandi dengan hati-hati. Kami tidak akan pernah memintanya lewat
          email, telepon, atau pesan langsung.
        </p>
      </>
    ),
  },
  {
    id: "perubahan",
    title: "Perubahan kebijakan",
    body: (
      <>
        <p>
          Bila cara kami menangani data berubah, halaman ini diperbarui beserta tanggalnya.
          Pertanyaan lain bisa dikirim ke <Link href="/support">halaman bantuan</Link> atau
          dibaca bersama <Link href="/terms">ketentuan layanan</Link>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <DocumentShell
      current="/privacy"
      title="Kebijakan Privasi"
      intro="Data apa yang kami simpan, mengapa, dan siapa yang bisa melihatnya. Ditulis dengan bahasa yang sama seperti saat kami menjelaskannya langsung."
      facts={[
        { label: "Berlaku sejak", value: "1 Oktober 2026" },
        { label: "Diperbarui", value: "29 Oktober 2026" },
        { label: "Permintaan data", value: siteConfig.adminEmail },
      ]}
      sections={sections}
    />
  );
}