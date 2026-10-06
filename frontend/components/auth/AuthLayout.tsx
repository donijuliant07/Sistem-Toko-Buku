"use client";

import Link from "next/link";
import { BookOpen, ArrowLeft, ShieldCheck, Sparkles, Star } from "lucide-react";
import { siteConfig } from "@/config/site";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  authType: "login" | "register";
}

export default function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-[var(--surface-muted,#F6F8F6)] flex flex-col justify-between selection:bg-[var(--primary-soft,#E8F9EE)] selection:text-[var(--primary-deep,#128C7E)]">
      {/* Top Bar Navigation */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-medium text-[var(--muted-foreground,#5C6B63)] hover:text-[var(--foreground,#14201B)] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-xs flex items-center justify-center group-hover:-translate-x-0.5 transition-transform border border-[var(--border,#E3EAE5)]">
            <ArrowLeft className="w-4 h-4 text-[var(--foreground,#14201B)]" />
          </div>
          <span className="hidden sm:inline">Kembali ke Beranda</span>
          <span className="sm:hidden">Beranda</span>
        </Link>

        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary,#25D366)] text-white flex items-center justify-center font-bold shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-[var(--foreground,#14201B)]">
            {siteConfig.brandName}
            <span className="text-[var(--primary,#25D366)]">.</span>
          </span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-emerald-950/5 border border-[var(--border,#E3EAE5)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">

          {/* Left Hero Section (Desktop only) */}
          <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#128C7E] via-[#0E6C61] to-[#0A4B43] p-8 lg:p-12 text-white flex-col justify-between relative overflow-hidden">
            {/* Subtle Decorative Pattern */}
            <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-16 top-12 w-48 h-48 bg-amber-300/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

            {/* Top Brand Info */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-emerald-100 border border-white/15 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Toko Buku Online pilihan #1</span>
              </div>

              <h2 className="text-3xl font-extrabold tracking-tight leading-tight mb-3">
                Jelajahi Ribuan Karya Terbaik
              </h2>
              <p className="text-emerald-100/90 text-sm leading-relaxed max-w-sm">
                Temukan buku favoritmu dari berbagai genre, penulis ternama, hingga terbitan eksklusif dengan penawaran menarik.
              </p>
            </div>

            {/* Middle Feature Highlights */}
            <div className="relative z-10 space-y-4 my-8">
              <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10">
                <div className="p-2 rounded-lg bg-emerald-400/20 text-emerald-200 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">100% Original & Terjamin</h4>
                  <p className="text-xs text-emerald-100/80">Seluruh koleksi langsung dari penerbit resmi.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10">
                <div className="p-2 rounded-lg bg-amber-400/20 text-amber-200 shrink-0">
                  <Star className="w-5 h-5 fill-amber-300/30" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">Pengiriman Cepat & Safe Packaging</h4>
                  <p className="text-xs text-emerald-100/80">Buku sampai dengan aman di depan pintumu.</p>
                </div>
              </div>
            </div>

            {/* Bottom Testimonial / Quote */}
            <div className="relative z-10 pt-4 border-t border-white/15">
              <p className="text-xs italic text-emerald-100/90">
                &ldquo;Buku adalah cermin: kamu hanya bisa melihat di dalamnya apa yang sudah kamu miliki di dalam dirimu.&rdquo;
              </p>
              <p className="text-[11px] font-medium text-emerald-200/80 mt-1">
                — Carlos Ruiz Zafón
              </p>
            </div>
          </div>

          {/* Right Form Section */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
            <div className="w-full max-w-md mx-auto">
              {/* Header Title */}
              <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground,#14201B)] tracking-tight">
                  {title}
                </h1>
                <p className="mt-2 text-sm text-[var(--muted-foreground,#5C6B63)]">
                  {subtitle}
                </p>
              </div>

              {/* Form content */}
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center text-xs text-[var(--muted-foreground,#5C6B63)]">
        &copy; {new Date().getFullYear()} {siteConfig.brandName}. Hak Cipta Dilindungi.
      </footer>
    </div>
  );
}
