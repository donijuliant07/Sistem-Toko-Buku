"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoginCharacters } from "@/components/auth/LoginCharacters";
import { formatAuthError } from "@/lib/auth-utils";

const fieldShell =
  "relative flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs transition-all focus-within:border-zinc-950 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-950/5 dark:focus-within:ring-white/10 h-10 px-3";
const fieldInput =
  "w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none";

export default function RegisterPage() {
  const router = useRouter();
  const { session, role, roleLoading, loading: authLoading, signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [characterStatus, setCharacterStatus] = useState<{ type: "nope" | "yay" } | null>(null);

  // Sudah punya sesi: kirim ke area sesuai role, sama seperti halaman login.
  useEffect(() => {
    if (authLoading || !session || roleLoading) return;
    router.replace(role === "admin" ? "/admin/dashboard" : "/");
  }, [authLoading, roleLoading, role, router, session]);

  function validate(): boolean {
    setErrorMessage("");
    const fail = (message: string) => {
      setErrorMessage(message);
      setCharacterStatus({ type: "nope" });
      return false;
    };

    const trimmedName = name.trim();
    if (!trimmedName) return fail("Nama lengkap wajib diisi.");
    if (trimmedName.length < 2) return fail("Nama minimal harus 2 karakter.");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return fail("Email wajib diisi.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return fail("Format email tidak valid.");

    if (!password) return fail("Kata sandi wajib diisi.");
    if (password.length < 6) return fail("Kata sandi minimal harus 6 karakter.");
    if (!confirmPassword) return fail("Silakan konfirmasi kata sandi Anda.");
    if (password !== confirmPassword) return fail("Konfirmasi kata sandi tidak cocok.");

    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setErrorMessage("");
    setCharacterStatus(null);

    try {
      const res = await signUp(email.trim(), password, name.trim());
      setIsSuccess(true);
      setCharacterStatus({ type: "yay" });
      if (res && res.user && !res.session) setNeedsConfirmation(true);
    } catch (cause) {
      setErrorMessage(formatAuthError(cause));
      setCharacterStatus({ type: "nope" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>

      <section
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        className="flex min-h-screen w-full items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
      >
        <div className="grid w-full max-w-6xl gap-4 rounded-[28px] bg-zinc-200/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-3 sm:p-4 lg:grid-cols-[1fr_29rem] shadow-xl backdrop-blur-xs">
          {/* Left Column: Interactive Cursor Following Characters */}
          <div className="mx-auto flex w-full max-w-md items-center justify-center overflow-hidden p-4 sm:p-6 lg:mx-0 lg:max-w-none lg:p-4">
            <LoginCharacters status={characterStatus} />
          </div>

          {/* Right Column: Clean White Authentication Card */}
          <div className="flex flex-1 flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-6 w-full p-6 sm:px-12 sm:py-12 lg:px-8 shadow-sm">
            {isSuccess ? (
              <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-6 text-center lg:max-w-none">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                    Akun berhasil dibuat.
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {needsConfirmation
                      ? "Kami telah mengirimkan tautan konfirmasi ke email Anda. Cek kotak masuk sebelum masuk."
                      : "Akun Anda sudah siap. Masuk untuk mulai menjelajah."}
                  </p>
                </div>
                <Link
                  href="/login"
                  className="w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-sm transition-all shadow-xs"
                >
                  Masuk
                </Link>
              </div>
            ) : (
              <>
                <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-6 lg:max-w-none">
                  {/* Header Title & Subtitle */}
                  <div className="flex flex-col items-center text-center">
                    <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                      Buat Akun <span className="text-blue-600 dark:text-blue-400">Readr</span> Anda
                    </h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Bergabung dan mulai jelajahi.
                    </p>
                  </div>

                  <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Nama lengkap
                      </label>
                      <div className={fieldShell}>
                        <User className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                        <input
                          id="name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          placeholder="Nama Lengkap Anda"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (errorMessage) setErrorMessage("");
                          }}
                          disabled={pending || authLoading}
                          required
                          className={fieldInput}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                          disabled={pending || authLoading}
                          required
                          className={fieldInput}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        Kata sandi
                      </label>
                      <div className={fieldShell}>
                        <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                        <input
                          id="password"
                          name="password"
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
                          className={`${fieldInput} pr-2`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0 p-1"
                          aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="confirmPassword"
                        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        Konfirmasi kata sandi
                      </label>
                      <div className={fieldShell}>
                        <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Ulangi kata sandi Anda"
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

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={pending || authLoading}
                      className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {pending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Membuat akun...</span>
                        </span>
                      ) : (
                        <span>Buat akun</span>
                      )}
                    </button>

                    {errorMessage && (
                      <p role="status" className="min-h-5 text-center text-xs font-medium text-red-500">
                        {errorMessage}
                      </p>
                    )}
                  </form>

                  <p className="text-center text-sm font-normal text-zinc-500 dark:text-zinc-400">
                    Sudah punya akun?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-zinc-900 dark:text-white hover:underline underline-offset-4"
                    >
                      Masuk
                    </Link>
                  </p>
                </div>

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
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}