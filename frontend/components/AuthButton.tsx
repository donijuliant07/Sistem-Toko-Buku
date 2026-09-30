"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function AuthButton() {
  const router = useRouter();
  const { session, loading, signOut } = useAuth();

  if (loading) return <span className="header-status">Memuat...</span>;
  if (!session) return <Link className="header-action" href="/login">Masuk</Link>;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <span className="auth-controls">
      <Link className="header-action" href="/admin/books">Kelola buku</Link>
      <button className="header-action header-action-quiet" type="button" onClick={handleSignOut}>Keluar</button>
    </span>
  );
}
