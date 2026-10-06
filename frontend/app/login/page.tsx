"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AuthLayout from "@/components/auth/AuthLayout";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { formatAuthError } from "@/lib/auth-utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin/books";
  const { session, loading: authLoading, signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      router.replace(redirectTo);
    }
  }, [authLoading, router, session, redirectTo]);

  function validate(): boolean {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setServerError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email wajib diisi.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Format email tidak valid.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password wajib diisi.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password minimal 6 karakter.");
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setPending(true);
    setServerError("");

    try {
      await signIn(email.trim(), password);
      router.replace(redirectTo);
    } catch (cause) {
      setServerError(formatAuthError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {/* Global Error Banner */}
      {serverError && (
        <div
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          role="alert"
        >
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Email Field */}
      <AuthInput
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="nama@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (emailError) setEmailError("");
          if (serverError) setServerError("");
        }}
        error={emailError}
        icon={<Mail className="w-4 h-4" />}
        disabled={pending || authLoading}
        required
      />

      {/* Password Field */}
      <div className="space-y-1">
        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Masukkan password Anda"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (passwordError) setPasswordError("");
            if (serverError) setServerError("");
          }}
          error={passwordError}
          disabled={pending || authLoading}
          required
        />

        <div className="flex justify-end pt-1">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("Silakan hubungi administrator toko untuk mereset password akun Anda.");
            }}
            className="text-xs font-semibold text-[#128C7E] hover:text-[#0E6C61] transition-colors"
          >
            Lupa password?
          </a>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <AuthSubmitButton loading={pending} loadingText="Sedang masuk...">
          Masuk
        </AuthSubmitButton>
      </div>

      {/* Link to Register */}
      <div className="text-center pt-4 border-t border-[var(--border,#E3EAE5)]">
        <p className="text-xs sm:text-sm text-[var(--muted-foreground,#5C6B63)]">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-bold text-[#128C7E] hover:text-[#0E6C61] underline underline-offset-4 transition-colors"
          >
            Daftar Sekarang
          </Link>
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthLayout
      authType="login"
      title="Selamat Datang Kembali"
      subtitle="Masuk ke akun Anda untuk mengelola katalog & belanja buku"
    >
      <Suspense fallback={<div className="py-12 text-center text-sm text-slate-400">Memuat...</div>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
