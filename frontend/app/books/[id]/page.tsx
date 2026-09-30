import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBook } from "@/lib/api";

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(price));
}

export default async function BookDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let book;
  try {
    book = await getBook(id);
  } catch {
    notFound();
  }

  return (
    <main className="detail-page">
      <header className="site-header"><Link className="wordmark" href="/">rak buku<span>.</span></Link><Link className="back-link" href="/">← Kembali ke koleksi</Link></header>
      <article className="detail">
        <div className="detail-cover">{book.cover_url ? <Image className="book-cover" src={book.cover_url} alt={`Sampul ${book.title}`} width={600} height={800} unoptimized /> : <div className="cover-placeholder" aria-hidden="true"><span>{book.title.slice(0, 1)}</span></div>}</div>
        <div className="detail-copy"><p className="eyebrow">Detail buku</p><p className="book-author">{book.author}</p><h1>{book.title}</h1><p className="detail-description">{book.description || "Belum ada deskripsi untuk buku ini."}</p><div className="detail-meta"><div><span>Harga</span><strong>{formatPrice(book.price)}</strong></div><div><span>ISBN</span><strong>{book.isbn}</strong></div><div><span>Ketersediaan</span><strong>{book.stock > 0 ? `${book.stock} eksemplar` : "Stok habis"}</strong></div></div><button className="primary-action" type="button" disabled={book.stock === 0}>{book.stock > 0 ? "Simpan ke keranjang" : "Beri tahu saat tersedia"}</button></div>
      </article>
    </main>
  );
}
