"use client";

import * as React from "react"
import { BookOpen, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Book } from "@/lib/types";
import { createClient } from "@/lib/supabase";
import { getBooks as getBooksApi } from "@/lib/api";
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

  // Akses admin sudah dijaga `app/admin/layout.tsx` (role dari `GET /me`).
  // Tidak ada lagi cek lokal yang bisa dilewati lewat metadata sesi.
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setReady(true);
        return;
      }
      getBooks(1, query, 100).finally(() => setReady(true));
    });
    // getBooks hanya memakai `query` saat ini; memasukkannya ke deps memicu fetch tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase.auth, query]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-28">
        <RefreshCw className="w-6 h-6 animate-spin text-[var(--primary)]" />
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
                      <td className="p-3 text-slate-500">{(b as Book & { category_id?: string | null }).category_id || "-"}</td>
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
