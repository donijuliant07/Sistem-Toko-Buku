"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { getBook, getAIReview } from "@/lib/api";
import type { Book, AIReviewResponse, SpoilerLevel } from "@/lib/types";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCS from "@/components/FloatingCS";
import { formatRupiah } from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import SpoilerSelectorModal from "@/components/books/SpoilerSelectorModal";
import AIReviewResult from "@/components/books/AIReviewResult";

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart, setIsCartOpen } = useCart();

  // AI Review States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [aiReview, setAiReview] = useState<AIReviewResponse | null>(null);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getBook(id)
      .then((data) => setBook(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleGenerateAIReview = async (spoilerLevel: SpoilerLevel) => {
    if (!book) return;
    setAiState("generating");
    setAiError("");
    setIsModalOpen(false);

    try {
      const result = await getAIReview(book.id, spoilerLevel);
      setAiReview(result);
      setAiState("success");
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Gagal membuat AI Review. Silakan coba lagi.");
      setAiState("error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-12 flex justify-center items-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#0052cc] border-t-transparent rounded-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-16 text-center">
          <span className="text-4xl block mb-3">📚</span>
          <h2 className="text-lg font-bold text-gray-800">Buku tidak ditemukan</h2>
          <p className="text-xs text-gray-500 mt-1 mb-6">ID buku tidak valid atau telah dihapus.</p>
          <Link
            href="/"
            className="px-4 py-2 bg-[#0052cc] text-white text-xs font-bold rounded-lg hover:bg-[#0041a8] transition-colors"
          >
            &larr; Kembali ke Katalog
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const price = typeof book.price === "number" ? book.price : parseFloat(book.price) || 85000;
  const isOutOfStock = book.stock <= 0;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(
      {
        id: book.id,
        title: book.title,
        author: book.author,
        price,
        coverUrl: book.cover_url || "",
        stock: book.stock,
      },
      quantity
    );
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    handleAddToCart();
    setIsCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-[#0052cc]">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/#katalog" className="hover:text-[#0052cc]">
            Katalog
          </Link>
          <span>/</span>
          <span className="text-gray-800 font-medium truncate max-w-xs">{book.title}</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Cover Left */}
          <div className="md:col-span-4 flex flex-col items-center">
            <div className="relative w-full max-w-[260px] aspect-[2/3] rounded-xl overflow-hidden shadow-md bg-gray-50 border border-gray-100 flex items-center justify-center">
              {book.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.cover_url} alt={book.title} className="w-full h-full object-contain p-2" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-6 flex flex-col justify-between">
                  <span className="text-xs font-bold text-amber-300">GRAMEDIA</span>
                  <p className="text-base font-bold line-clamp-4">{book.title}</p>
                </div>
              )}
            </div>

            {/* AI Review Button below Cover (Desktop/Mobile accessible) */}
            <div className="w-full max-w-[260px] mt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                disabled={aiState === "generating"}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {aiState === "generating" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    <span>⏳ Generating Review...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>✨ AI Review</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Details Right */}
          <div className="md:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="bg-blue-50 text-[#0052cc] text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Buku Resmi
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    isOutOfStock ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {isOutOfStock ? "Stok Habis" : `Tersedia ${book.stock} Eksemplar`}
                </span>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  disabled={aiState === "generating"}
                  className="sm:hidden inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-0.5 rounded-full"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI Review</span>
                </button>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
                {book.title}
              </h1>
              <p className="text-sm text-gray-600 mt-2 font-medium">
                Penulis: <span className="text-gray-900 font-bold">{book.author}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">ISBN: {book.isbn}</p>

              {/* Price */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl flex items-baseline gap-3">
                <span className="text-2xl md:text-3xl font-black text-[#0052cc]">
                  {formatRupiah(price)}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {formatRupiah(price * 1.15)}
                </span>
                <span className="bg-[#e61c24] text-white text-xs font-extrabold px-2 py-0.5 rounded">
                  Hemat 15%
                </span>
              </div>

              {/* Description */}
              <div className="mt-6">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Deskripsi Buku</h3>
                <p className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {book.description || "Belum ada deskripsi lengkap untuk buku ini."}
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
              {/* Quantity selector */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-bold text-gray-700">Jumlah:</span>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="w-9 h-9 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-bold text-gray-800">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(book.stock, q + 1))}
                    disabled={quantity >= book.stock || isOutOfStock}
                    className="w-9 h-9 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:flex-1">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-[#0052cc] text-[#0052cc] hover:bg-blue-50 text-xs md:text-sm font-extrabold transition-colors disabled:opacity-50"
                >
                  + Keranjang
                </button>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#0052cc] hover:bg-[#0041a8] text-white text-xs md:text-sm font-extrabold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  Beli Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Banner when generating review */}
        {aiState === "generating" && (
          <div className="mt-8 p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl text-center space-y-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
            <h3 className="text-base font-extrabold text-emerald-950">
              ✨ AI sedang menganalisis buku &ldquo;{book.title}&rdquo;...
            </h3>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              Mengekstrak informasi gaya penulisan, analisis karakter, kelebihan, dan gambaran umum sesuai tingkat spoiler yang dipilih.
            </p>
          </div>
        )}

        {/* Error Banner */}
        {aiState === "error" && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-3xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-red-900">
                ⚠️ Gagal membuat AI Review
              </h3>
              <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">
                {aiError || "Terjadi kesalahan saat memproses ulasan. Silakan coba lagi."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-2.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-sm"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Result Container */}
        {aiState === "success" && aiReview && (
          <AIReviewResult
            review={aiReview}
            onReset={() => setIsModalOpen(true)}
          />
        )}
      </main>

      {/* Modal Spoiler Selector */}
      <SpoilerSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleGenerateAIReview}
        bookTitle={book.title}
        bookAuthor={book.author}
        isGenerating={aiState === "generating"}
      />

      <Footer />
      <FloatingCS />
    </div>
  );
}
