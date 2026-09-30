"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdmin, createBook, deleteBook, getBooks, updateBook } from "@/lib/api";
import type { Book, BookInput, BookPage } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

const emptyPage: BookPage = { items: [], total: 0, page: 1, page_size: 20 };
const emptyForm: BookInput = { title: "", author: "", isbn: "", description: "", price: 0, stock: 0, cover_url: "" };

function asForm(book: Book): BookInput {
  return { title: book.title, author: book.author, isbn: book.isbn, description: book.description ?? "", price: Number(book.price), stock: book.stock, cover_url: book.cover_url ?? "" };
}

export default function AdminBooksPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [page, setPage] = useState(emptyPage);
  const [form, setForm] = useState<BookInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!authLoading && !session) router.replace("/login");
  }, [authLoading, router, session]);

  useEffect(() => {
    if (!session) return;
    checkAdmin(session.access_token)
      .then(() => setAllowed(true))
      .catch((cause) => {
        setAllowed(false);
        setError(cause instanceof Error ? cause.message : "Akun ini bukan admin.");
      });
  }, [session]);

  useEffect(() => {
    if (!session || !allowed) return;
    getBooks(page.page, query, page.page_size)
      .then(setPage)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Katalog gagal dimuat."))
      .finally(() => setLoading(false));
  }, [allowed, page.page, page.page_size, query, session]);

  function change(field: keyof BookInput, value: string) {
    setForm((current) => ({ ...current, [field]: field === "price" || field === "stock" ? Number(value) : value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setPending(true);
    setError("");
    setNotice("");
    const payload = { ...form, isbn: form.isbn.replace(/[- ]/g, ""), description: form.description || null, cover_url: form.cover_url || null };
    try {
      if (editingId) await updateBook(editingId, payload, session.access_token);
      else await createBook(payload, session.access_token);
      setForm(emptyForm);
      setEditingId(null);
      setNotice(editingId ? "Buku diperbarui." : "Buku ditambahkan.");
      setPage((current) => ({ ...current, page: 1 }));
      const refreshed = await getBooks(1, query, page.page_size);
      setPage(refreshed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
    } finally {
      setPending(false);
    }
  }

  async function remove(book: Book) {
    if (!session || !window.confirm(`Hapus “${book.title}”?`)) return;
    setError("");
    try {
      await deleteBook(book.id, session.access_token);
      setNotice("Buku dihapus.");
      setPage((current) => ({ ...current, page: 1 }));
      setPage(await getBooks(1, query, page.page_size));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Buku gagal dihapus.");
    }
  }

  if (authLoading || !session || allowed === null) return <main className="admin-page"><div className="state">Menyiapkan ruang pengelola...</div></main>;
  if (!allowed) return <main className="admin-page"><header className="site-header"><Link className="wordmark" href="/">rak buku<span>.</span></Link></header><div className="state state-error"><h1>Akses admin diperlukan.</h1><p>Akun ini belum punya izin mengelola katalog.</p><Link className="back-link" href="/">Kembali ke koleksi</Link></div></main>;

  return (
    <main className="admin-page">
      <header className="site-header"><Link className="wordmark" href="/">rak buku<span>.</span></Link><Link className="back-link" href="/">← Lihat koleksi</Link></header>
      <section className="admin-shell" aria-labelledby="admin-title">
        <div className="admin-heading"><div><p className="eyebrow">Ruang pengelola</p><h1 id="admin-title">Katalog buku</h1></div><span className="admin-count">{page.total} judul</span></div>
        <form className="book-form" onSubmit={submit}><h2>{editingId ? "Edit buku" : "Tambah buku"}</h2><div className="form-grid"><label>Judul<input value={form.title} onChange={(event) => change("title", event.target.value)} required /></label><label>Penulis<input value={form.author} onChange={(event) => change("author", event.target.value)} required /></label><label>ISBN<input value={form.isbn} onChange={(event) => change("isbn", event.target.value)} required /></label><label>Harga<input type="number" min="0" step="0.01" value={form.price} onChange={(event) => change("price", event.target.value)} required /></label><label>Stok<input type="number" min="0" value={form.stock} onChange={(event) => change("stock", event.target.value)} required /></label><label>URL sampul<input type="url" value={form.cover_url ?? ""} onChange={(event) => change("cover_url", event.target.value)} /></label><label className="form-wide">Deskripsi<textarea rows={3} value={form.description ?? ""} onChange={(event) => change("description", event.target.value)} /></label></div><div className="form-actions"><button className="primary-action" type="submit" disabled={pending}>{pending ? "Menyimpan..." : editingId ? "Simpan perubahan" : "Tambah buku"}</button>{editingId && <button className="secondary-action" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Batal</button>}</div></form>
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
        <div className="admin-toolbar"><h2>Semua buku</h2><form className="search" onSubmit={(event) => { event.preventDefault(); setPage((current) => ({ ...current, page: 1 })); setQuery(query.trim()); }}><label className="sr-only" htmlFor="admin-search">Cari buku</label><input id="admin-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari buku" /><button type="submit" aria-label="Cari">⌕</button></form></div>
        {loading ? <div className="state">Memuat katalog...</div> : <div className="admin-list">{page.items.map((book) => <article className="admin-row" key={book.id}><div><p className="book-author">{book.author}</p><h3>{book.title}</h3><p className="admin-meta">ISBN {book.isbn} · {book.stock} stok · Rp {Number(book.price).toLocaleString("id-ID")}</p></div><div className="row-actions"><button className="secondary-action" type="button" onClick={() => { setEditingId(book.id); setForm(asForm(book)); }}>Edit</button><button className="danger-action" type="button" onClick={() => remove(book)}>Hapus</button></div></article>)}{page.items.length === 0 && <div className="state">Belum ada buku yang cocok.</div>}</div>}
        <div className="pagination"><button type="button" disabled={page.page <= 1} onClick={() => setPage((current) => ({ ...current, page: current.page - 1 }))}>Sebelumnya</button><span>{page.page} / {Math.max(1, Math.ceil(page.total / page.page_size))}</span><button type="button" disabled={page.page >= Math.ceil(page.total / page.page_size)} onClick={() => setPage((current) => ({ ...current, page: current.page + 1 }))}>Berikutnya</button></div>
      </section>
    </main>
  );
}
