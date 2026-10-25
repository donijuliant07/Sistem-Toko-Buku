import type { Metadata } from "next";
import { DM_Sans, Fraunces, Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { CartProvider } from "@/context/CartContext";
import CartDrawer from "@/components/CartDrawer";
import BookAdvisorWidget from "@/components/BookAdvisorWidget";
import { SoundEffects } from "@/components/ui/sound";
import "./globals.css";

const sans = DM_Sans({ variable: "--font-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Readr — Toko buku pilihan",
  description: "Temukan buku yang ingin kamu bawa pulang.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${sans.variable} ${display.variable} ${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SoundEffects>
          <AuthProvider>
            <CartProvider>
              {children}
              <CartDrawer />
              <BookAdvisorWidget />
            </CartProvider>
          </AuthProvider>
        </SoundEffects>
      </body>
    </html>
  );
}
