"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoginCharacters } from "@/components/auth/LoginCharacters";
import { formatAuthError } from "@/lib/auth-utils";

const fieldShell =
  "relative flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs transition-all focus-within:border-zinc-950 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-950/5 dark:focus-within:ring-white/10 h-10 px-3";
const fieldInput =
  "w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none pr-8";

/**
 * Tahap kedua alur lupa kata sandi. Tautan email mendarat di
 * `/auth/callback?next=/reset-password` (mode PKCE: tukar `code`; mode implicit:
 * sesi recovery sudah terbentuk dari `#access_token=...&type=recovery`), atau
 * langsung di sini bila AuthProvider mendeteksi tautan recovery di halaman
 * lain. Tanpa sesi, tautan dianggap kedaluwarsa.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f4f5] dark:bg-zinc-950" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading, updatePassword, signOut } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Pesan dari `/auth/callback` untuk tautan yang sudah kedaluwarsa/dipakai.
  const errorFromUrl = searchParams.get("error") ?? "";
  const [errorMessage, setErrorMessage] = useState(
    errorFromUrl ? decodeURIComponent(errorFromUrl) : "",
  );
  // Tautan dianggap kedaluwarsa bila sesi recovery tidak terbentuk. Diturunkan
  // dari AuthProvider (bukan state di effect) supaya tidak memicu render berantai.
  const [expiredLink, setExpiredLink] = useState(Boolean(errorFromUrl));
  const noSession = expiredLink || (!authLoading && !session);
  const [pending, setPending] = useState(false);
  const [characterStatus, setCharacterStatus] = useState<{ type: "nope" | "yay" } | null>(null);

  function validate(): boolean {
    setErrorMessage("");
    const fail = (message: string) => {
      setErrorMessage(message);
      setCharacterStatus({ type: "nope" });
      return false;
    };
    if (!password) return fail("Kata sandi baru wajib diisi.");
    if (password.length < 6) return fail("Kata sandi minimal harus 6 karakter.");
    if (!confirmPassword) return fail("Silakan konfirmasi kata sandi baru Anda.");
    if (password !== confirmPassword) return fail("Konfirmasi kata sandi tidak cocok.");
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setCharacterStatus(null);
    try {
      await updatePassword(password);
      setCharacterStatus({ type: "yay" });
      // Sesi recovery diganti sesi biasa lewat login ulang dengan sandi baru.
      await signOut();
      router.replace(
        `/login?message=${encodeURIComponent("Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.")}`,
      );
    } catch (cause) {
      const friendly = formatAuthError(cause);
      setErrorMessage(friendly);
      setCharacterStatus({ type: "nope" });
      if (friendly.toLowerCase().includes("kedaluwarsa")) setExpiredLink(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      className="flex min-h-screen w-full items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
    >
      <div className="grid w-full max-w-6xl gap-4 rounded-[28px] bg-zinc-200/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-3 sm:p-4 lg:grid-cols-[1fr_29rem] shadow-xl backdrop-blur-xs">
        <div className="mx-auto flex w-full max-w-md items-center justify-center overflow-hidden p-4 sm:p-6 lg:mx-0 lg:max-w-none lg:p-4">
          <LoginCharacters
            shy={password.length > 0}
            reveal={showPassword}
            status={characterStatus}
          />
        </div>

        <div className="flex flex-1 flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-6 w-full p-6 sm:px-12 sm:py-12 lg:px-8 shadow-sm">
          {noSession ? (
            <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-6 text-center lg:max-w-none">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
                <AlertCircle className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Tautan tidak berlaku
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tautan reset sudah kedaluwarsa atau sudah dipakai. Minta tautan baru untuk
                  melanjutkan.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-xs"
              >
                Minta tautan baru
              </Link>
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
                  Kata Sandi Baru
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Buat kata sandi baru untuk akun Anda.
                </p>
              </div>

              <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Kata sandi baru
                  </label>
                  <div className={fieldShell}>
                    <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      id="password"
                      name="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      disabled={pending || authLoading}
                      required
                      className={fieldInput}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Konfirmasi kata sandi baru
                  </label>
                  <div className={fieldShell}>
                    <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      id="confirm-password"
                      name="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Ulangi kata sandi baru"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      disabled={pending || authLoading}
                      required
                      className={fieldInput}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pending || authLoading}
                  className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {pending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </span>
                  ) : (
                    <span>Simpan kata sandi</span>
                  )}
                </button>

                {errorMessage && (
                  <p role="status" className="min-h-5 text-center text-xs font-medium text-red-500">
                    {errorMessage}
                  </p>
                )}
              </form>
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