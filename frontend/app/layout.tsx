import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import { SoundEffects } from "@/components/ui/sound";
import PageTitle from "@/components/PageTitle";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display-stack", subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Dipakai khusus area /komunitas; dimuat sebagai variable font agar tidak memilih bobot per bagian.
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });
// Wajah khusus modal Ulasan AI Readr. Dimuat terpisah dari DM Sans agar
// halaman lain tidak ikut mengunduh berkasnya.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  // Setiap halaman menetapkan judulnya sendiri dan otomatis diberi akhiran
  // "| Readr" lewat template ini.
  title: {
    template: "%s | Readr",
    default: "Readr",
  },
  description:
    "Beli buku pilihan, bandingkan harga di marketplace, kumpulkan poin Rewards, dan berdiskusi di komunitas Readr.",
};

// `viewportFit: "cover"` memberi tahu Safari iOS bahwa layar penuh boleh dipakai;
// `env(safe-area-inset-*)` di globals.css lalu menjaga tombol keranjang, tombol
// kirim chat, dan bilah bawah tetap di area yang bisa disentuh, bukan di bawah
// home indicator. Nilai zoom sengaja tidak dikunci: pengguna tetap bisa pinch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${sans.variable} ${display.variable} ${inter.variable} ${mono.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <SoundEffects>
          <AuthProvider>
            <CartProvider>
              <PageTitle />
              {children}
              <CartDrawer />
            </CartProvider>
          </AuthProvider>
        </SoundEffects>
      </body>
    </html>
  );
}
