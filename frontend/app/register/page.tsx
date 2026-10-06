"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, User, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import AuthLayout from "@/components/auth/AuthLayout";
import { AuthInput } from "@/components/auth/AuthInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { formatAuthError } from "@/lib/auth-utils";

export default function RegisterPage() {
  const router = useRouter();
  const { session, loading: authLoading, signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [serverError, setServerError] = useState("");

  const [pending, setPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      router.replace("/admin/books");
    }
  }, [authLoading, router, session]);

  function validate(): boolean {
    let valid = true;
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setServerError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Nama lengkap wajib diisi.");
      valid = false;
    } else if (trimmedName.length < 2) {
      setNameError("Nama minimal 2 karakter.");
      valid = false;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email wajib diisi.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Email tidak valid.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password wajib diisi.");
      valid = false;
    } else if (password.length < 8) {
      setPasswordError("Password minimal 8 karakter.");
      valid = false;
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Konfirmasi password wajib diisi.");
      valid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError("Password dan konfirmasi password tidak sama.");
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
      const res = await signUp(email.trim(), password, name.trim());
      setIsSuccess(true);
      // Jika Supabase mengembalikan user tanpa session, berarti butuh verifikasi email
      if (res && res.user && !res.session) {
        setNeedsConfirmation(true);
      }
    } catch (cause) {
      setServerError(formatAuthError(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      authType="register"
      title="Buat Akun Baru"
      subtitle="Mulai pengalaman belanja buku favoritmu di Toko Buku"
    >
      {isSuccess ? (
        <div className="space-y-6 text-center py-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-[var(--foreground,#14201B)]">
              Akun Berhasil Dibuat!
            </h2>
            <p className="text-sm text-[var(--muted-foreground,#5C6B63)] max-w-sm mx-auto leading-relaxed">
              {needsConfirmation
                ? "Kami telah mengirimkan tautan konfirmasi ke email Anda. Silakan periksa pesan masuk email Anda sebelum masuk."
                : "Selamat! Akun Anda telah siap digunakan. Silakan masuk untuk mulai belanja."}
            </p>
          </div>

          <div className="pt-2 space-y-3">
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center h-11 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-[#128C7E] to-[#25D366] hover:from-[#0E6C61] hover:to-[#20BD5A] transition-all shadow-md shadow-emerald-700/20"
            >
              Masuk Sekarang
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
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

          {/* Name Field */}
          <AuthInput
            id="name"
            label="Nama Lengkap"
            type="text"
            autoComplete="name"
            placeholder="Masukkan nama lengkap Anda"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
              if (serverError) setServerError("");
            }}
            error={nameError}
            icon={<User className="w-4 h-4" />}
            disabled={pending || authLoading}
            required
          />

          {/* Email Field */}
          <AuthInput
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="email@example.com"
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
          <PasswordInput
            id="password"
            label="Password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
              if (confirmPasswordError && e.target.value === confirmPassword) setConfirmPasswordError("");
              if (serverError) setServerError("");
            }}
            error={passwordError}
            disabled={pending || authLoading}
            required
          />

          {/* Confirm Password Field */}
          <PasswordInput
            id="confirmPassword"
            label="Konfirmasi Password"
            autoComplete="new-password"
            placeholder="Ulangi password di atas"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (confirmPasswordError) setConfirmPasswordError("");
              if (serverError) setServerError("");
            }}
            error={confirmPasswordError}
            disabled={pending || authLoading}
            required
          />

          {/* Submit Button */}
          <div className="pt-3">
            <AuthSubmitButton loading={pending} loadingText="Sedang mendaftar...">
              Daftar Akun Baru
            </AuthSubmitButton>
          </div>

          {/* Link to Login */}
          <div className="text-center pt-4 border-t border-[var(--border,#E3EAE5)]">
            <p className="text-xs sm:text-sm text-[var(--muted-foreground,#5C6B63)]">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                className="font-bold text-[#128C7E] hover:text-[#0E6C61] underline underline-offset-4 transition-colors"
              >
                Masuk
              </Link>
            </p>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
