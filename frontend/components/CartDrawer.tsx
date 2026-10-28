"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { formatRupiah } from "@/components/ProductCard";

export default function CartDrawer() {
  const router = useRouter();
  const {
    items,
    removeFromCart,
    updateQuantity,
    totalPrice,
    totalItems,
    hasUnavailableItems,
    loading,
    error,
    isCartOpen,
    setIsCartOpen,
    refresh,
  } = useCart();

  // Harga/stok bisa berubah di server; segarkan setiap drawer dibuka.
  useEffect(() => {
    if (isCartOpen) void refresh();
  }, [isCartOpen, refresh]);

  if (!isCartOpen) return null;

  const handleCheckout = () => {
    if (items.length === 0 || hasUnavailableItems) return;
    setIsCartOpen(false);
    router.push("/checkout");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-gray-900">Keranjang Belanja</span>
            <span className="bg-blue-50 text-[#0052cc] text-xs font-bold px-2 py-0.5 rounded-full">
              {totalItems} item
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <span className="text-4xl mb-2">🛒</span>
              <p className="text-sm font-semibold text-gray-700">Keranjang masih kosong</p>
              <p className="text-xs text-gray-400 mt-1">Pilih buku favorit Anda dari katalog untuk mulai belanja.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  item.available ? "bg-gray-50 border-gray-100" : "bg-red-50/50 border-red-100"
                }`}
              >
                <div className="w-12 h-16 bg-white rounded-md overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                  {item.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover_url} alt={item.title} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">📖</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-800 truncate">{item.title}</h4>
                  <span className="text-[11px] text-gray-400 block">{item.author}</span>
                  <span className="text-xs font-extrabold text-[#0052cc] mt-1 block">
                    {formatRupiah(item.unit_price)}
                  </span>
                  {item.available ? (
                    item.stock <= 5 && (
                      <span className="text-[10px] text-amber-600 font-semibold block">
                        Sisa {item.stock} eksemplar
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-red-600 font-semibold block">
                      Stok tidak mencukupi (tersedia {item.stock})
                    </span>
                  )}
                </div>

                {/* Quantity Controls */}
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => void removeFromCart(item.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 font-semibold"
                  >
                    Hapus
                  </button>
                  <div className="flex items-center border border-gray-200 rounded-md bg-white">
                    <button
                      type="button"
                      onClick={() => void updateQuantity(item.id, item.quantity - 1)}
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100 font-bold"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => void updateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-5 h-5 flex items-center justify-center text-xs text-gray-600 hover:bg-gray-100 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Checkout Summary */}
        {items.length > 0 && (
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Subtotal Belanja</span>
              <span className="font-extrabold text-base text-gray-900">{formatRupiah(totalPrice)}</span>
            </div>

            {error && (
              <p className="text-[11px] font-medium text-red-600">{error}</p>
            )}
            {hasUnavailableItems && (
              <p className="text-[11px] font-medium text-red-600">
                Ada buku yang stoknya tidak mencukupi. Sesuaikan jumlah atau hapus dulu.
              </p>
            )}

            {/* Tombol bayar menempel di dasar viewport ponsel, jadi footer diberi
                jarak aman dari bilah gestur iOS. */}
            <button
              type="button"
              onClick={handleCheckout}
              disabled={hasUnavailableItems || loading}
              className="w-full py-3 bg-[#0052cc] hover:bg-[#0041a8] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <span>Lanjutkan ke Pembayaran</span>
              <span>&rarr;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
