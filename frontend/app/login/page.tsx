"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AuthLayout from "@/components/auth/AuthLayout";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only accept internal paths so a crafted ?redirect= cannot send users off-site.
  const redirectParam = searchParams.get("redirect");
  const requestedRedirect = redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
    ? redirectParam
    : null;
  const { session, role, roleLoading, loading: authLoading, signIn, signInWithOAuth } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  // Redirect if already logged in — tujuan mengikuti role dari backend.
  useEffect(() => {
    if (authLoading || !session || roleLoading) return;
    // `?redirect=` tetap dihormati, tapi tidak boleh mengirim pelanggan ke area admin.
    const fallback = role === "admin" ? "/admin/dashboard" : "/";
    const target = requestedRedirect && !(role !== "admin" && requestedRedirect.startsWith("/admin"))
      ? requestedRedirect
      : fallback;
    router.replace(target);
  }, [authLoading, roleLoading, role, router, session, requestedRedirect]);

  function validate(): boolean {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setServerError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Invalid email format.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    }

    return valid;
  }

  async function handleOAuth(provider: "github" | "google" | "apple") {
    setPending(true);
    setServerError("");
    try {
      await signInWithOAuth(provider);
    } catch (cause) {
      const err = cause instanceof Error ? cause.message : "OAuth sign in failed.";
      setServerError(err);
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setServerError("");

    try {
      await signIn(email.trim(), password);
      // Efek di atas menunggu role dari backend lalu mengarahkan ke tujuan yang
      // sesuai; di sini cukup biarkan sesi tersinkron tanpa menebak role.
    } catch (cause) {
      const err = cause instanceof Error ? cause.message : "Login failed. Please try again.";
      setServerError(err);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">
          Sign in to your account
        </h1>
        <p className="text-sm text-zinc-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-green-400 hover:text-green-300 font-medium transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {/* Global Error Banner */}
        {serverError && (
          <div
            className="p-3 rounded-md bg-red-950/50 border border-red-800/60 text-red-200 text-xs font-medium flex items-start gap-2.5"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-[11px] font-semibold tracking-widest uppercase text-zinc-400 select-none"
          >
            Enter Work Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="me@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
              if (serverError) setServerError("");
            }}
            disabled={pending || authLoading}
            required
            aria-invalid={!!emailError}
            className="w-full h-11 px-3.5 rounded-md bg-[#1a1a1a] border border-zinc-800 text-zinc-100 text-sm placeholder:text-zinc-600 outline-none transition-all focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {emailError && (
            <p className="text-xs text-red-400 mt-1" role="alert">
              {emailError}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="flex items-center gap-1.5 text-[11px] font-semibold tracking-widest uppercase text-zinc-400 select-none"
          >
            Enter Password
            <Info className="w-3.5 h-3.5 text-zinc-500" />
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="············"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
              if (serverError) setServerError("");
            }}
            disabled={pending || authLoading}
            required
            aria-invalid={!!passwordError}
            className="w-full h-11 px-3.5 rounded-md bg-[#1a1a1a] border border-zinc-800 text-zinc-100 text-sm placeholder:text-zinc-500 outline-none tracking-widest transition-all focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {passwordError && (
            <p className="text-xs text-red-400 mt-1" role="alert">
              {passwordError}
            </p>
          )}
        </div>

        {/* Primary CTA Button */}
        <button
          type="submit"
          disabled={pending || authLoading}
          className="w-full h-12 rounded-md bg-green-500 hover:bg-green-400 active:bg-green-600 text-black font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-950/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Social Buttons */}
        <div className="space-y-3 pt-1">
          {/* GitHub */}
          <button
            type="button"
            disabled={pending || authLoading}
            onClick={() => handleOAuth("github")}
            className="w-full h-11 rounded-md bg-[#1a1a1a] border border-zinc-800 hover:bg-[#242424] text-zinc-200 font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* GitHub Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
            </svg>
            Sign in with GitHub
          </button>

          {/* Apple */}
          <button
            type="button"
            disabled={pending || authLoading}
            onClick={() => handleOAuth("apple")}
            className="w-full h-11 rounded-md bg-[#1a1a1a] border border-zinc-800 hover:bg-[#242424] text-zinc-200 font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Apple Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Sign in with Apple
          </button>

          {/* Google */}
          <button
            type="button"
            disabled={pending || authLoading}
            onClick={() => handleOAuth("google")}
            className="w-full h-11 rounded-md bg-[#1a1a1a] border border-zinc-800 hover:bg-[#242424] text-zinc-200 font-bold text-xs tracking-widest uppercase flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Google Icon */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Legal Footer */}
        <p className="text-center text-[11px] text-zinc-600 pt-2 leading-relaxed">
          By signing in, you agree to our{" "}
          <a href="#" className="underline underline-offset-2 hover:text-zinc-400 transition-colors">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-2 hover:text-zinc-400 transition-colors">
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout authType="login">
      <Suspense fallback={<div className="py-12 text-center text-sm text-zinc-400">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
