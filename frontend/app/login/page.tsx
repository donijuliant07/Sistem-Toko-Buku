"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LoginCharacters } from "@/components/auth/LoginCharacters";
import { Checkbox } from "@/components/ui/checkbox";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const requestedRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : null;

  const { session, role, roleLoading, loading: authLoading, signIn, signInWithOAuth } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const errorFromUrl = searchParams.get("error");
  const [errorMessage, setErrorMessage] = useState(
    errorFromUrl ? decodeURIComponent(errorFromUrl) : ""
  );
  const [pending, setPending] = useState(false);
  const [characterStatus, setCharacterStatus] = useState<{ type: "nope" | "yay" } | null>(
    errorFromUrl ? { type: "nope" } : null
  );

  // Redirect if session is already active
  useEffect(() => {
    if (authLoading || !session || roleLoading) return;
    const fallback = role === "admin" ? "/admin/dashboard" : "/";
    const target =
      requestedRedirect && !(role !== "admin" && requestedRedirect.startsWith("/admin"))
        ? requestedRedirect
        : fallback;
    router.replace(target);
  }, [authLoading, roleLoading, role, router, session, requestedRedirect]);

  function validate(): boolean {
    setErrorMessage("");
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Email atau nama pengguna wajib diisi.");
      setCharacterStatus({ type: "nope" });
      return false;
    }

    if (!password) {
      setErrorMessage("Kata sandi wajib diisi.");
      setCharacterStatus({ type: "nope" });
      return false;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi minimal harus 6 karakter.");
      setCharacterStatus({ type: "nope" });
      return false;
    }

    return true;
  }

  async function handleOAuth(provider: "google" | "facebook" | "github") {
    setPending(true);
    setErrorMessage("");
    setCharacterStatus(null);
    try {
      await signInWithOAuth(provider);
      setCharacterStatus({ type: "yay" });
    } catch (cause) {
      const err = cause instanceof Error ? cause.message : `Gagal masuk dengan ${provider}.`;
      setErrorMessage(err);
      setCharacterStatus({ type: "nope" });
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setErrorMessage("");
    setCharacterStatus(null);
    try {
      await signIn(email.trim(), password);
      setCharacterStatus({ type: "yay" });
    } catch (cause) {
      const rawError = cause instanceof Error ? cause.message : "";
      
      // Mengubah pesan dari Supabase/Backend ke Bahasa Indonesia
      let friendlyError = "Email atau kata sandi salah. Silakan coba lagi.";
      
      if (rawError.toLowerCase().includes("invalid login credentials")) {
        friendlyError = "Email atau kata sandi salah. Silakan coba lagi.";
      } else if (rawError) {
        friendlyError = rawError;
      }

      setErrorMessage(friendlyError);
      setCharacterStatus({ type: "nope" });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* Import stylesheet JetBrains Mono resmi dari CDN */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono/web/woff2/jetbrains-mono.css"
      />

      {/* Terapkan font JetBrains Mono khusus di pembungkus login */}
      <section 
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
        className="flex min-h-screen w-full items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900"
      >
        <div className="grid w-full max-w-6xl gap-4 rounded-[28px] bg-zinc-200/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-3 sm:p-4 lg:grid-cols-[1fr_29rem] shadow-xl backdrop-blur-xs">
          {/* Left Column: Interactive Cursor Following Characters */}
          <div className="mx-auto flex w-full max-w-md items-center justify-center overflow-hidden p-4 sm:p-6 lg:mx-0 lg:max-w-none lg:p-4">
            <LoginCharacters
              shy={isPasswordFocused}
              reveal={showPassword}
              status={characterStatus}
            />
          </div>

          {/* Right Column: Clean White Authentication Card */}
          <div className="flex flex-1 flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-6 w-full p-6 sm:px-12 sm:py-12 lg:px-8 shadow-sm">
            <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-6 lg:max-w-none">
              {/* Header Title & Subtitle */}
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Selamat Datang di <span className="text-blue-600 dark:text-blue-400">Readr</span>
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  Masuk untuk melanjutkan ke akun Anda
                </p>
              </div>

              {/* Social Logins: Google, Facebook, GitHub */}
              <div className="flex items-center gap-3">
                {/* Google Button */}
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={pending || authLoading}
                  aria-label="Lanjutkan dengan Google"
                  className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </button>

                {/* Facebook Button */}
                <button
                  type="button"
                  onClick={() => handleOAuth("facebook")}
                  disabled={pending || authLoading}
                  aria-label="Lanjutkan dengan Facebook"
                  className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </button>

                {/* GitHub Button (menggantikan Apple) */}
                <button
                  type="button"
                  onClick={() => handleOAuth("github")}
                  disabled={pending || authLoading}
                  aria-label="Lanjutkan dengan GitHub"
                  className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 fill-zinc-900 dark:fill-white" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="flex w-full items-center gap-4">
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                <p className="shrink-0 text-xs text-zinc-400 font-normal uppercase tracking-wider">
                  Atau masuk dengan email
                </p>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
              </div>

              {/* Login Form */}
              <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                {/* Email or Username Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Email atau nama pengguna
                  </label>
                  <div className="relative flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs transition-all focus-within:border-zinc-950 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-950/5 dark:focus-within:ring-white/10 h-10 px-3">
                    <Mail className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      id="email"
                      name="email"
                      type="text"
                      autoComplete="username email"
                      placeholder="nama@contoh.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      disabled={pending || authLoading}
                      required
                      className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Kata sandi
                  </label>
                  <div className="relative flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-xs transition-all focus-within:border-zinc-950 dark:focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-950/5 dark:focus-within:ring-white/10 h-10 px-3">
                    <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Masukkan kata sandi Anda"
                      value={password}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage("");
                      }}
                      disabled={pending || authLoading}
                      required
                      className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none pr-2"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0 p-1"
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember me & Forgot Password Row */}
                <div className="flex items-center justify-between text-sm pt-0.5">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                      className="border-zinc-300 dark:border-zinc-700 data-[state=checked]:bg-emerald-600 dark:data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-600 dark:data-[state=checked]:border-emerald-500 data-[state=checked]:text-white"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm font-normal text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
                    >
                      Ingat saya
                    </label>
                  </div>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:underline underline-offset-4"
                  >
                    Lupa Kata Sandi?
                  </Link>
                </div>

                {/* Submit Button (Hijau) */}
                <button
                  type="submit"
                  disabled={pending || authLoading}
                  className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-200 active:bg-emerald-400 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {pending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </span>
                  ) : (
                    <span>Masuk</span>
                  )}
                </button>

                {/* Error Status Banner */}
                {errorMessage && (
                  <p
                    role="status"
                    className="min-h-5 text-center text-xs font-medium text-red-500 animate-fade-in"
                  >
                    {errorMessage}
                  </p>
                )}
              </form>

              {/* Create Account Link */}
              <p className="text-center text-sm font-normal text-zinc-500 dark:text-zinc-400">
                Belum punya akun?{" "}
                <Link
                  href="/register"
                  className="font-medium text-zinc-900 dark:text-white hover:underline underline-offset-4"
                >
                  Buat akun baru
                </Link>
              </p>
            </div>

            {/* Legal and Support Links Footer */}
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
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}