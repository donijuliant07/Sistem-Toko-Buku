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

  const { session, role, roleLoading, loading: authLoading, signIn } = useAuth();

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