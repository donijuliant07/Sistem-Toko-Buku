"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/admin/books");
  }, [loading, router, session]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/admin/books");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email atau password tidak benar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <header className="site-header"><Link className="wordmark" href="/">rak buku<span>.</span></Link><Link className="back-link" href="/">← Kembali ke koleksi</Link></header>
      <section className="auth-shell" aria-labelledby="login-title">
        <p className="eyebrow">Ruang pengelola</p>
        <h1 id="login-title">Masuk ke rak buku.</h1>
        <p className="auth-intro">Gunakan akun Supabase yang sudah terdaftar untuk mengelola katalog.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email<input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label htmlFor="password">Password<input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-action" type="submit" disabled={pending || loading}>{pending ? "Memeriksa..." : "Masuk"}</button>
        </form>
      </section>
    </main>
  );
}
