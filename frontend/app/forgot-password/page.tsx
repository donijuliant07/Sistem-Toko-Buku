"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoginCharacters } from "@/components/auth/LoginCharacters";
import { formatAuthError } from "@/lib/auth-utils";

const fieldShell =
  "relative flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs transition-all focus-within:border-zinc-950 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-950/5 dark:focus-within:ring-white/10 h-10 px-3";
const fieldInput =
  "w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none";

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Halaman ini sengaja TIDAK me-redirect pengguna yang sudah login: ganti kata
 * sandi tetap berguna saat sesi aktif, dan admin bisa memakainya tanpa logout.
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [characterStatus, setCharacterStatus] = useState<{ type: "nope" | "yay" } | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Hitung mundur tombol "Kirim ulang". Supabase juga punya batasnya sendiri di
  // server; ini hanya mencegah klik beruntun yang pasti ditolak.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send(): Promise<void> {
    setPending(true);
    setErrorMessage("");
    setCharacterStatus(null);
    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback?next=/reset-password`
          : undefined;
      await requestPasswordReset(email.trim(), redirectTo);
      // Selalu tampil sukses kalau permintaan diterima: membedakan "email tidak
      // terdaftar" akan membocorkan akun mana yang ada.
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCharacterStatus({ type: "yay" });
    } catch (cause) {
      const friendly = formatAuthError(cause);
      const lower = friendly.toLowerCase();
      // Hanya galat nyata (rate limit / koneksi) yang ditampilkan. Galat lain —
      // termasuk "user not found" — tetap dianggap terkirim.
      if (
        lower.includes("terlalu banyak") ||
        lower.includes("terhubung ke server") ||
        lower.includes("rate limit")
      ) {
        setErrorMessage(friendly);
        setCharacterStatus({ type: "nope" });
      } else {
        setSent(true);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setCharacterStatus({ type: "yay" });
      }
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Email wajib diisi.");
      setCharacterStatus({ type: "nope" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage("Format email tidak valid.");
      setCharacterStatus({ type: "nope" });
      return;
    }
    void send();
  }

  return (
    <section
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      className="flex min-h-screen w-full items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
    >
      <div className="grid w-full max-w-6xl gap-4 rounded-[28px] bg-zinc-200/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-3 sm:p-4 lg:grid-cols-[1fr_29rem] shadow-xl backdrop-blur-xs">
        <div className="mx-auto flex w-full max-w-md items-center justify-center overflow-hidden p-4 sm:p-6 lg:mx-0 lg:max-w-none lg:p-4">
          <LoginCharacters status={characterStatus} />
        </div>

        <div className="flex flex-1 flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-6 w-full p-6 sm:px-12 sm:py-12 lg:px-8 shadow-sm">
          {sent ? (
            <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-6 text-center lg:max-w-none">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Cek email Anda
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Jika <span className="text-zinc-700 dark:text-zinc-300">{email.trim()}</span>{" "}
                  terdaftar, tautan reset kata sandi sudah dikirim. Tautan berlaku terbatas dan
                  hanya bisa dipakai sekali.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={pending || cooldown > 0}
                className="w-full h-11 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {pending
                  ? "Mengirim..."
                  : cooldown > 0
                    ? `Kirim ulang dalam ${cooldown} detik`
                    : "Kirim ulang tautan"}
              </button>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Tidak menerima email? Periksa folder spam atau pastikan alamatnya benar.
              </p>
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline underline-offset-4"
              >
                Kembali ke halaman masuk
              </Link>
            </div>
          ) : (
            <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-6 lg:max-w-none">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Lupa Kata Sandi?
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Masukkan email akun Anda, kami kirimkan tautan untuk membuat kata sandi baru.
                </p>
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Email
                  </label>
                  <div className={fieldShell}>
                    <Mail className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="nama@contoh.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      disabled={pending}
                      required
                      className={fieldInput}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {pending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengirim tautan...</span>
                    </span>
                  ) : (
                    <span>Kirim tautan reset</span>
                  )}
                </button>

                {errorMessage && (
                  <p role="status" className="min-h-5 text-center text-xs font-medium text-red-500">
                    {errorMessage}
                  </p>
                )}
              </form>

              <p className="text-center text-sm font-normal text-zinc-500 dark:text-zinc-400">
                Ingat kata sandi Anda?{" "}
                <Link
                  href="/login"
                  className="font-medium text-zinc-900 dark:text-white hover:underline underline-offset-4"
                >
                  Masuk
                </Link>
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Ketentuan
            </Link>
            <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Privasi
            </Link>
            <Link href="/support" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
              Bantuan
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}