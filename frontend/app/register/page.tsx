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
  const { session, role, roleLoading, loading: authLoading, signUp, signInWithOAuth } = useAuth();

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

  async function handleOAuth(provider: "google" | "apple" | "github") {
    setPending(true);
    setErrorMessage("");
    setCharacterStatus(null);
    try {
      await signInWithOAuth(provider);
      setCharacterStatus({ type: "yay" });
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : `${provider} sign up failed.`);
      setCharacterStatus({ type: "nope" });
      setPending(false);
    }
  }

  function validate(): boolean {
    setErrorMessage("");
    const fail = (message: string) => {
      setErrorMessage(message);
      setCharacterStatus({ type: "nope" });
      return false;
    };

    const trimmedName = name.trim();
    if (!trimmedName) return fail("Full name is required.");
    if (trimmedName.length < 2) return fail("Name must be at least 2 characters.");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return fail("Email is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return fail("Invalid email format.");

    if (!password) return fail("Password is required.");
    if (password.length < 6) return fail("Password must be at least 6 characters.");
    if (!confirmPassword) return fail("Please confirm your password.");
    if (password !== confirmPassword) return fail("Passwords do not match.");

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
    <section className="flex min-h-screen w-full items-center justify-center bg-[#f4f4f5] dark:bg-zinc-950 p-4 sm:p-6 lg:p-8 selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-zinc-900">
      <div className="grid w-full max-w-6xl gap-4 rounded-[28px] bg-zinc-200/60 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/60 p-3 sm:p-4 lg:grid-cols-[1fr_29rem] shadow-xl backdrop-blur-xs">
        {/* Left Column: Interactive Cursor Following Characters */}
        <div className="mx-auto flex w-full max-w-md items-center justify-center overflow-hidden p-4 sm:p-6 lg:mx-0 lg:max-w-none lg:p-4">
          <LoginCharacters status={characterStatus} />
        </div>

        {/* Right Column: Clean White Authentication Card */}
        <div className="flex flex-1 flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 items-center justify-between gap-6 w-full p-6 sm:px-12 sm:py-12 lg:px-8 shadow-sm">
          {isSuccess ? (
            <div className="mx-auto flex h-full w-full max-w-sm flex-col items-center justify-center gap-6 text-center lg:max-w-none">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-950/5 dark:bg-white/10 text-zinc-900 dark:text-white">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  Account created.
                </h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {needsConfirmation
                    ? "We sent a confirmation link to your email. Check your inbox before signing in."
                    : "Your account is ready. Sign in to start exploring."}
                </p>
              </div>
              <Link
                href="/login"
                className="w-full h-11 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 active:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white font-medium text-sm transition-all shadow-xs"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center gap-6 lg:max-w-none">
                {/* Header Title & Subtitle */}
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                    Create your account.
                  </h1>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    Join and start exploring.
                  </p>
                </div>

                {/* Social Sign Up */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuth("google")}
                    disabled={pending || authLoading}
                    aria-label="Sign up with Google"
                    className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth("github")}
                    disabled={pending || authLoading}
                    aria-label="Sign up with Facebook"
                    className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuth("apple")}
                    disabled={pending || authLoading}
                    aria-label="Sign up with Apple"
                    className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4 fill-zinc-900 dark:fill-white" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  </button>
                </div>

                {/* Divider */}
                <div className="flex w-full items-center gap-4">
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                  <p className="shrink-0 text-xs text-zinc-400 font-normal uppercase tracking-wider">
                    Or continue with
                  </p>
                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1" />
                </div>

                <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
                  {/* Full Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Full name
                    </label>
                    <div className={fieldShell}>
                      <User className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="John Doe"
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
                        placeholder="name@example.com"
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
                      Password
                    </label>
                    <div className={fieldShell}>
                      <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="At least 6 characters"
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
                        aria-label={showPassword ? "Hide password" : "Show password"}
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
                      Confirm password
                    </label>
                    <div className={fieldShell}>
                      <Lock className="w-4 h-4 text-zinc-400 mr-2.5 shrink-0" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Repeat your password"
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

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={pending || authLoading}
                    className="mt-2 w-full h-11 inline-flex items-center justify-center rounded-lg bg-zinc-950 hover:bg-zinc-900 active:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {pending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Creating account...</span>
                      </span>
                    ) : (
                      <span>Create account</span>
                    )}
                  </button>

                  {errorMessage && (
                    <p role="status" className="min-h-5 text-center text-xs font-medium text-red-500">
                      {errorMessage}
                    </p>
                  )}
                </form>

                <p className="text-center text-sm font-normal text-zinc-500 dark:text-zinc-400">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-zinc-900 dark:text-white hover:underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
                <Link href="/terms" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  Privacy
                </Link>
                <Link href="/support" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                  Support
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
