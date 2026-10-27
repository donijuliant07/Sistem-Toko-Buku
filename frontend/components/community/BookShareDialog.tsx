"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/components/ProductCard";
import { getBooks } from "@/lib/api";
import type { Book } from "@/lib/types";

type BookShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `false` = pengiriman gagal; `ChatRoom` sudah menampilkan galatnya sendiri. */
  onPick: (bookId: string) => Promise<boolean>;
};

type Result = { term: string; books: Book[]; error: string };

/** Cari buku di katalog lalu kirim sebagai pesan `book`. */
export function BookShareDialog({ open, onOpenChange, onPick }: BookShareDialogProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (term: string) => {
    try {
      const page = await getBooks(1, term, 12);
      setResult({ term, books: page.items, error: "" });
    } catch (cause) {
      setResult({
        term,
        books: [],
        error: cause instanceof Error ? cause.message : "Katalog gagal dimuat.",
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(debounced), 300);
    return () => clearTimeout(timer);
  }, [open, debounced, load]);

  // Hasil untuk istilah lain dianggap masih memuat — tanpa setState sinkron di effect.
  const loading = !result || result.term !== debounced;
  const books = result?.term === debounced ? result.books : [];
  const error = result?.term === debounced ? result.error : "";

  const handlePick = async (book: Book) => {
    setPickingId(book.id);
    try {
      // `false` = pengiriman gagal; ChatRoom sudah menampilkan galatnya.
      if (!(await onPick(book.id))) return;
      toast.success(`"${book.title}" dibagikan.`);
      onOpenChange(false);
      setQuery("");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Buku gagal dibagikan.");
    } finally {
      setPickingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="font-community max-w-md">
        <DialogHeader>
          <DialogTitle>Bagikan buku</DialogTitle>
          <DialogDescription>Pilih buku dari katalog untuk dikirim ke percakapan.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari judul atau penulis…"
            aria-label="Cari buku"
            className="pl-9"
          />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => void load(debounced)}>
                Coba lagi
              </Button>
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <BookOpen className="w-7 h-7 text-gray-300" aria-hidden />
              <p className="text-sm text-gray-700">Buku tidak ditemukan.</p>
              <p className="text-xs text-gray-500">Coba kata kunci lain.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {books.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => void handlePick(book)}
                    disabled={!!pickingId}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                  >
                    {book.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- cover katalog eksternal
                      <img src={book.cover_url} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                    ) : (
                      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
                        <BookOpen className="w-4 h-4" aria-hidden />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-medium text-gray-900">{book.title}</span>
                      <span className="block text-xs text-gray-500">{book.author}</span>
                      <span className="block text-xs font-semibold text-[var(--primary-deep)] tabular-nums">
                        {formatRupiah(book.price)}
                      </span>
                    </span>
                    {pickingId === book.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
