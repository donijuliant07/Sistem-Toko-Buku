import type { Metadata } from "next";
import { DM_Sans, Fraunces, Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import BookAdvisorWidget from "@/components/BookAdvisorWidget";
import { SoundEffects } from "@/components/ui/sound";
import PageTitle from "@/components/PageTitle";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/jetbrains-mono.css"
        />
      </head>
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
