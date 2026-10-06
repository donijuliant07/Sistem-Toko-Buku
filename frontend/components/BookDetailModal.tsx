"use client";

import React, { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Product } from "@/data/mockData";
import { formatRupiah } from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { getAIReview } from "@/lib/api";
import type { AIReviewResponse, SpoilerLevel } from "@/lib/types";
import SpoilerSelectorModal from "@/components/books/SpoilerSelectorModal";
import AIReviewResult from "@/components/books/AIReviewResult";

interface BookDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function BookDetailModal({
  product,
  isOpen,
  onClose,
}: BookDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, setIsCartOpen } = useCart();

  // AI Review States
  const [isSpoilerModalOpen, setIsSpoilerModalOpen] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "generating" | "success" | "error">("idle");
  const [aiReview, setAiReview] = useState<AIReviewResponse | null>(null);
  const [aiError, setAiError] = useState("");

  if (!isOpen || !product) return null;

  const stock = (product as any).stock ?? 15;
  const isOutOfStock = stock <= 0;

  const handleIncrement = () => {
    if (quantity < stock) setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    onClose();
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    onClose();
    setIsCartOpen(true);
  };

  const handleGenerateReview = async (level: SpoilerLevel) => {
    setAiState("generating");
    setAiError("");
    setIsSpoilerModalOpen(false);

    try {
      const bookId = String(product.id || "1");
      const res = await getAIReview(bookId, level);
      setAiReview(res);
      setAiState("success");
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Gagal membuat review AI.");
      setAiState("error");
    }
  };

  const subtotal = product.price * quantity;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div
          className="bg-white rounded-2xl shadow-xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="overflow-y-auto flex-1">
            {/* Main Product Info (Split Grid) */}
            <div className="flex flex-col md:flex-row">
              {/* Cover Section */}
              <div className="md:w-5/12 bg-gray-50 p-6 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-gray-100 relative">
                <div className="flex flex-col items-center w-full">
                  <div className="relative w-40 md:w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-white flex items-center justify-center">
                    {product.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.coverUrl}
                        alt={product.title}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-bold tracking-widest text-amber-300">GRAMEDIA</span>
                        <p className="text-sm font-bold line-clamp-3">{product.title}</p>
                      </div>
                    )}
                  </div>
                  <span className="mt-3 text-[11px] font-medium text-gray-500">
                    Penerbit Resmi Gramedia
                  </span>
                </div>

                {/* AI Review Button below Cover */}
                <div className="w-full max-w-[200px] mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSpoilerModalOpen(true)}
                    disabled={aiState === "generating"}
                    className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {aiState === "generating" ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                        <span>Menganalisis...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        <span>✨ AI Review</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Details Section */}
              <div className="md:w-7/12 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-blue-50 text-[#0052cc] text-[10px] font-bold px-2 py-0.5 rounded">
                      Buku Asli
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isOutOfStock ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isOutOfStock ? "Stok Habis" : `Tersedia ${stock} Eksemplar`}
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsSpoilerModalOpen(true)}
                      disabled={aiState === "generating"}
                      className="md:hidden inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>✨ AI Review</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 leading-snug">
                    {product.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium">
                    Penulis: <span className="text-gray-800 font-semibold">{product.authorOrBrand}</span>
                  </p>

                  {/* Price Row */}
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-[#0052cc]">
                      {formatRupiah(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatRupiah(product.originalPrice)}
                      </span>
                    )}
                    {product.discountPercent && product.discountPercent > 0 && (
                      <span className="bg-[#e61c24] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Diskon {product.discountPercent}%
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-bold text-gray-800 mb-1">Deskripsi Buku</h4>
                    <p className="text-xs text-gray-600 leading-relaxed max-h-24 overflow-y-auto pr-1">
                      {(product as any).description ||
                        "Buku pilihan berkualitas tinggi dari toko Gramedia. Cocok untuk koleksi pribadi, referensi studi, maupun hadiah bermakna."}
                    </p>
                  </div>
                </div>

                {/* Controls & Add to Cart */}
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-4">
                  {/* Quantity Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Tentukan Jumlah</span>
                    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={handleDecrement}
                        disabled={quantity <= 1 || isOutOfStock}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setQuantity(Math.min(stock, Math.max(1, val)));
                        }}
                        className="w-12 h-8 text-center text-xs font-bold text-gray-800 border-x border-gray-200 focus:outline-none"
                        min={1}
                        max={stock}
                      />
                      <button
                        type="button"
                        onClick={handleIncrement}
                        disabled={quantity >= stock || isOutOfStock}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Subtotal preview */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Total Harga:</span>
                    <span className="font-extrabold text-gray-900 text-sm">{formatRupiah(subtotal)}</span>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock}
                      className="w-full py-2.5 px-3 rounded-xl border border-[#0052cc] text-[#0052cc] hover:bg-blue-50 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      <span>+ Keranjang</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={isOutOfStock}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#0052cc] hover:bg-[#0041a8] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Beli Langsung</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {aiState === "generating" && (
              <div className="p-6 bg-emerald-50/70 border-t border-emerald-100 text-center space-y-2 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-emerald-900">
                  ✨ AI sedang menganalisis buku &ldquo;{product.title}&rdquo;...
                </p>
                <p className="text-[11px] text-emerald-700">
                  Menganalisis gaya penulisan, penokohan, dan kesimpulan sesuai spoiler level.
                </p>
              </div>
            )}

            {/* Error Message */}
            {aiState === "error" && (
              <div className="p-4 bg-red-50 border-t border-red-100 flex items-center justify-between gap-3 text-xs text-red-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{aiError || "Gagal membuat ulasan AI."}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSpoilerModalOpen(true)}
                  className="px-3 py-1 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* AI Review Result Inside Modal */}
            {aiState === "success" && aiReview && (
              <div className="p-6 border-t border-gray-100 bg-slate-50/50">
                <AIReviewResult
                  review={aiReview}
                  onReset={() => setIsSpoilerModalOpen(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Spoiler Selector */}
      <SpoilerSelectorModal
        isOpen={isSpoilerModalOpen}
        onClose={() => setIsSpoilerModalOpen(false)}
        onConfirm={handleGenerateReview}
        bookTitle={product.title}
        bookAuthor={product.authorOrBrand}
        isGenerating={aiState === "generating"}
      />
    </>
  );
}
