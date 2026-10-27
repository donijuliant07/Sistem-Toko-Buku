"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function AuthButton() {
  const router = useRouter();
  const { session, role, loading, signOut } = useAuth();

  if (loading) {
    return <span className="text-xs text-gray-400 font-medium px-2">Memuat...</span>;
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-[#0052cc] hover:bg-[#0041a8] rounded-full transition-colors shadow-sm"
      >
        Masuk
      </Link>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  // Menu mengikuti role dari backend: admin tidak melihat tautan pelanggan,
  // dan pelanggan tidak melihat tautan dashboard admin.
  const isAdmin = role === "admin";

  return (
    <div className="flex items-center gap-2 font-mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {isAdmin ? (
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-[var(--primary)] bg-[var(--primary-soft)] hover:opacity-90 rounded-lg transition-colors border border-[var(--primary)]/20"
        >
          Dashboard Admin
        </Link>
      ) : (
        <Link
          href="/orders"
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-[#0052cc] hover:bg-blue-50 rounded-lg transition-colors"
        >
          Pesanan Saya
        </Link>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
      >
        Keluar
      </button>
    </div>
  );
}

