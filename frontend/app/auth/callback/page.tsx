"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function processAuth() {
      // 1. Cek parameter error dari URL (misal: provider ditolak atau dibatalkan)
      const errorParam = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");
      const errorCode = searchParams.get("error_code");

      if (errorParam || errorDesc || errorCode) {
        // `otp_expired` = tautan reset/konfirmasi sudah lewat masa berlaku.
        const readableError =
          errorCode === "otp_expired"
            ? "Tautan sudah kedaluwarsa atau sudah dipakai. Silakan minta tautan baru."
            : errorDesc || errorParam || "Autentikasi pihak ketiga dibatalkan atau gagal.";
        if (active) {
          setErrorMessage(readableError);
          router.replace(`/login?error=${encodeURIComponent(readableError)}`);
        }
        return;
      }

      // 2. Cek path tujuan redirect setelah login
      const requestedNext = searchParams.get("next") ?? "/";
      const next =
        requestedNext.startsWith("/") && !requestedNext.startsWith("//")
          ? requestedNext
          : "/";

      // 3. Cek authorization code (PKCE flow)
      const code = searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) {
            setErrorMessage(exchangeError.message);
            router.replace(`/login?error=${encodeURIComponent(exchangeError.message)}`);
          }
          return;
        }

        if (active) {
          router.replace(next);
        }
        return;
      }

      // 4. Fallback jika menggunakan token fragment (#access_token=...) atau sesi sudah tersimpan
      const { data: initialSession } = await supabase.auth.getSession();
      if (initialSession.session) {
        if (active) {
          router.replace(next);
        }
        return;
      }

      // Tunggu sebentar untuk memberi waktu Supabase client memproses URL hash
      await new Promise((resolve) => setTimeout(resolve, 400));
      const { data: delayedSession } = await supabase.auth.getSession();
      if (delayedSession.session) {
        if (active) {
          router.replace(next);
        }
        return;
      }

      // Jika tidak ada kode atau sesi setelah diperiksa
      if (active) {
        router.replace("/login?error=Sesi+autentikasi+tidak+ditemukan");
      }
    }

    processAuth();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <div 
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      className="flex min-h-screen items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 font-mono text-zinc-900 dark:text-zinc-100"
    >
      <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg text-center max-w-sm w-full">
        {errorMessage ? (
          <>
            <AlertCircle className="w-8 h-8 text-red-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Gagal Menyambungkan
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {errorMessage}
            </p>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-[#0052cc]" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Menghubungkan Akun
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Mohon tunggu sebentar, sedang memverifikasi kredensial Anda...
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div 
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          className="flex min-h-screen items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 font-mono text-zinc-900 dark:text-zinc-100"
        >
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg text-center max-w-sm w-full">
            <Loader2 className="w-8 h-8 animate-spin text-[#0052cc]" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Memuat...
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}

