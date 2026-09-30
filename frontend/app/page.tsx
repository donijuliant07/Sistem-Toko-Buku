"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getBooks } from "@/lib/api";
import AuthButton from "@/components/AuthButton";
import type { Book, BookPage } from "@/lib/types";

const initialPage: BookPage = { items: [], total: 0, page: 1, page_size: 12 };

function formatPrice(price: Book["price"]) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(price));
}

function BookCover({ book }: { book: Book }) {
  return book.cover_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="book-cover" src={book.cover_url} alt={`Sampul ${book.title}`} />
  ) : (
    <div className="cover-placeholder" aria-hidden="true"><span>{book.title.slice(0, 1)}</span></div>
  );
}

export default function Home() {
  const [page, setPage] = useState<BookPage>(initialPage);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getBooks(page.page, query)
      .then((data) => active && setPage(data))
      .catch(() => active && setError("Katalog belum bisa dimuat. Pastikan backend berjalan."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [page.page, query]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage((current) => ({ ...current, page: 1 }));
    setQuery(input);
  }

  const pageCount = Math.max(1, Math.ceil(page.total / page.page_size));
  const showLoading = loading && page.items.length === 0;

  return (
    <main>
      <header className="site-header">
        <Link className="wordmark" href="/">rak buku<span>.</span></Link>
        <nav aria-label="Navigasi utama"><a href="#koleksi">Koleksi</a><a href="#tentang">Tentang</a></nav>
        <AuthButton />
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Toko buku pilihan</p>
          <h1 id="hero-title">Cerita baik,<br /><em>tinggal dibaca.</em></h1>
          <p className="hero-intro">Temukan buku yang ingin kamu bawa pulang—dari rak kami ke meja bacamu.</p>
        </div>
        <div className="hero-mark" aria-hidden="true"><span>R</span><i>since<br />2024</i></div>
      </section>

      <section className="catalog" id="koleksi" aria-labelledby="catalog-title">
        <div className="catalog-heading">
          <div><p className="eyebrow">Rak terbaru</p><h2 id="catalog-title">Jelajahi koleksi</h2></div>
          <form className="search" onSubmit={submitSearch} role="search">
            <label className="sr-only" htmlFor="book-search">Cari judul atau penulis</label>
            <input id="book-search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Cari judul atau penulis" />
            <button type="submit" aria-label="Cari">⌕</button>
          </form>
        </div>

        {showLoading ? <div className="state">Membuka rak...</div> : error ? <div className="state state-error">{error}</div> : page.items.length === 0 ? <div className="state">Belum ada buku yang cocok. Coba kata kunci lain.</div> : (
          <>
            <p className="result-count">{page.total} buku tersedia</p>
            <div className="book-grid">
              {page.items.map((book) => (
                <Link className="book-card" href={`/books/${book.id}`} key={book.id}>
                  <div className="card-cover"><BookCover book={book} />{book.stock === 0 && <span className="stock-badge">Habis</span>}</div>
                  <div className="book-info"><p className="book-author">{book.author}</p><h3>{book.title}</h3><p className="book-price">{formatPrice(book.price)}</p></div>
                </Link>
              ))}
            </div>
            <div className="pagination" aria-label="Paginasi">
              <button type="button" disabled={page.page <= 1} onClick={() => setPage((current) => ({ ...current, page: current.page - 1 }))}>Sebelumnya</button>
              <span>{page.page} / {pageCount}</span>
              <button type="button" disabled={page.page >= pageCount} onClick={() => setPage((current) => ({ ...current, page: current.page + 1 }))}>Berikutnya</button>
            </div>
          </>
        )}
      </section>

      <footer id="tentang"><p>rak buku<span>.</span></p><small>Tempat buku-buku menemukan pembacanya.</small></footer>
    </main>
  );
}
