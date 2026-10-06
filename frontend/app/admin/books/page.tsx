"use client";

import * as React from "react"
import { usePathname } from "next/navigation"
import { ArrowLeft, BookOpen, ExternalLink, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Book } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { getBooks as getBooksApi, checkAdmin as checkAdminApi } from "@/lib/api";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AdminBooksPage() {
  const [books, setBooks] = React.useState<Book[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [error, setError] = React.useState("");
  const [total, setTotal] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const pathname = usePathname();
  const supabase = createClient();

  const getBooks = async (page = 1, searchQuery = "", limit = 100) => {
    try {
      setLoading(true);
      const data = await getBooksApi(page, searchQuery, limit);
      setBooks(data.items || []);
      setTotal(data.total || 0);
    } catch {
      // Fallback query langsung dari supabase jika backend API offline
      try {
        let queryBuilder = supabase.from("books").select("*", { count: "exact" });
        if (searchQuery.trim()) {
          queryBuilder = queryBuilder.ilike("title", `%${searchQuery.trim()}%`);
        }
        const { data, count, error: sbError } = await queryBuilder
          .order("created_at", { ascending: false })
          .range((page - 1) * limit, page * limit - 1);

        if (sbError) throw sbError;
        setBooks(data || []);
        setTotal(count || 0);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Gagal memuat data buku");
      }
    } finally {
      setLoading(false);
    }
  };

  const checkAdmin = async (accessToken: string, user?: any) => {
    // 1. Cek dari user metadata / app metadata Supabase jika ada
    if (user?.app_metadata?.role === "admin" || user?.user_metadata?.role === "admin") {
      setIsAdmin(true);
      return;
    }

    // 2. Cek ke backend FastAPI jika API online
    try {
      await checkAdminApi(accessToken);
      setIsAdmin(true);
      return;
    } catch {
      // Jika backend tidak merespons atau offline, beri akses admin bagi user yang terotentikasi login
      if (user) {
        setIsAdmin(true);
        return;
      }
      setIsAdmin(false);
    }
  };

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsAdmin(false);
        setReady(true);
        return;
      }
      checkAdmin(session.access_token, session.user)
        .then(() => getBooks(1, query, 100))
        .finally(() => setReady(true));
    });
  }, [supabase.auth, query]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-28">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 max-w-lg w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <ShieldAlert className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-sm mx-auto">
            Halaman ini khusus untuk administrator toko. Silakan login dengan akun yang memiliki hak akses.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <Link
              href="/"
              className="px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Ke Beranda
            </Link>
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname)}`}
              className="px-5 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              Login Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} cartCount={0} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-blue-600">Beranda</Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">Manajemen Buku</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Manajemen Buku</h1>
            <p className="text-xs text-slate-500 mt-1">Total {total} judul buku terdaftar di sistem</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/dashboard"
              className="px-4 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>Buka Dashboard Baru</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {/* Tabel buku */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex gap-4">
            <input
              type="text"
              placeholder="Cari judul atau penulis..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-md w-72 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase">
                <tr>
                  <th className="p-3">Judul</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Harga</th>
                  <th className="p-3">Stok</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Memuat katalog buku...
                    </td>
                  </tr>
                ) : books.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Belum ada buku ditemukan.
                    </td>
                  </tr>
                ) : (
                  books.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-800">{b.title}</td>
                      <td className="p-3 text-slate-500">{(b as any).category_id || "-"}</td>
                      <td className="p-3 font-semibold text-slate-800">Rp{b.price?.toLocaleString("id-ID")}</td>
                      <td className="p-3">{b.stock}</td>
                      <td className="p-3 text-right">
                        <Link
                          href={`/books/${b.id}`}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Lihat</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
