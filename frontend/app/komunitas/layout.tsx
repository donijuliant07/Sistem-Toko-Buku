"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";

/**
 * Layout area komunitas: semua halaman di `/komunitas` wajib login.
 *
 * Gerbang ini hanya untuk UX — backend tetap menolak permintaan tanpa token.
 * Selama sesi masih dimuat, tampilkan pemuat alih-alih mengalihkan, supaya
 * pengguna yang sudah login tidak terlempar ke `/login` saat refresh.
 */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || session) return;
    // `/login` hanya menerima path internal tanpa query, jadi alamat tujuan
    // cukup path-nya; grup yang sedang dibuka diingat di `?g=`.
    const redirect = pathname?.startsWith("/komunitas") ? pathname : "/komunitas";
    router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [loading, session, router, pathname]);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 flex items-center justify-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
          <span>Memuat sesi…</span>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
