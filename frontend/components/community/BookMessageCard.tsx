"use client";

import Link from "next/link";
import { formatRupiah } from "@/components/ProductCard";
import type { SharedBook } from "@/lib/types";
import { BookOpen } from "lucide-react";

type BookMessageCardProps = {
  book: SharedBook | null;
};

/**
 * Kartu buku di dalam gelembung chat. Data dibaca dari katalog saat pesan
 * disajikan, jadi harga selalu mengikuti katalog — bukan harga saat dikirim.
 */
export function BookMessageCard({ book }: BookMessageCardProps) {
  if (!book) {
    return (
      <div className="rounded-lg bg-black/5 px-3 py-2 text-xs italic text-gray-600">
        Buku ini sudah tidak tersedia di katalog.
      </div>
    );
  }

  return (
    <Link
      href={`/books/${book.id}`}
      className="group/book flex w-56 items-center gap-2.5 rounded-lg bg-white/80 p-2 transition-[background-color,box-shadow] duration-150 hover:bg-white hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      aria-label={`Lihat buku ${book.title}`}
    >
      {book.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- cover dari sumber katalog eksternal
        <img
          src={book.cover_url}
          alt=""
          className="h-16 w-11 shrink-0 rounded object-cover transition-transform duration-200 group-hover/book:scale-[1.04] motion-reduce:transition-none"
        />
      ) : (
        <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
          <BookOpen className="w-5 h-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0">
        <span className="line-clamp-2 text-xs font-semibold text-gray-900">{book.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-gray-500">{book.author}</span>
        <span className="mt-0.5 block text-xs font-bold text-[var(--primary-deep)] tabular-nums">
          {formatRupiah(book.price)}
        </span>
      </span>
    </Link>
  );
}
