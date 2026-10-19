"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  addCartItem,
  clearCartRequest,
  getCart,
  mergeCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/api";
import type { CartItem, CartPayload } from "@/lib/types";

/**
 * Keranjang.
 *
 * - User login: sumber kebenaran adalah server (`carts`/`cart_items`). Harga dan
 *   stok selalu berasal dari tabel `books`, jadi tidak ada angka basi di UI.
 * - Tamu: tetap di `localStorage`; saat login isinya digabungkan ke server.
 */
export type { CartItem };

/** Bentuk minimum yang dibutuhkan untuk menambah buku ke keranjang. */
export type CartAddInput = {
  id: string;
  title?: string;
  author?: string;
  authorOrBrand?: string;
  price?: number;
  coverUrl?: string;
  stock?: number;
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: CartAddInput, quantity?: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  hasUnavailableItems: boolean;
  loading: boolean;
  error: string;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "pustakagram_cart";

/** Baris `localStorage` untuk tamu. Harga/stok hanya untuk tampilan sementara. */
type GuestCartItem = {
  id: string;
  title: string;
  author: string;
  price: number;
  coverUrl: string;
  quantity: number;
  stock: number;
};

function readGuestCart(): GuestCartItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as GuestCartItem[]) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(items: GuestCartItem[]) {
  try {
    if (items.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage bisa diblokir (mode privat); keranjang tamu cukup tidak tersimpan.
  }
}

/** Payload server -> bentuk yang dipakai UI (harga & stok dari server). */
function toCartItems(payload: CartPayload | null): CartItem[] {
  return payload?.items ?? [];
}

function toGuestItem(product: CartAddInput, quantity: number): GuestCartItem {
  return {
    id: product.id,
    title: product.title ?? "Buku",
    author: product.author || product.authorOrBrand || "Penulis",
    price: typeof product.price === "number" ? product.price : parseFloat(String(product.price)) || 0,
    coverUrl: product.coverUrl || "",
    quantity,
    stock: product.stock ?? 0,
  };
}

/** Baris tamu dipetakan ke bentuk `CartItem` server, hanya untuk ditampilkan. */
function guestToCartItems(items: GuestCartItem[]): CartItem[] {
  return items.map((item) => ({
    id: item.id,
    book_id: item.id,
    title: item.title,
    author: item.author,
    cover_url: item.coverUrl || null,
    unit_price: item.price,
    stock: item.stock,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
    available: item.stock >= item.quantity,
  }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { session, role } = useAuth();
  const token = session?.access_token;
  // Admin mengelola toko dan tidak berbelanja dengan akunnya; backend juga
  // menolak cart/checkout admin, ini hanya mencegah UI menawarkannya.
  const isAdmin = role === "admin";

  const [serverCart, setServerCart] = useState<CartPayload | null>(null);
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>([]);
  const [guestLoaded, setGuestLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);

  // User yang keranjangnya sudah dimuat/di-merge; mencegah merge berulang.
  const syncedUserRef = useRef<string | null>(null);

  // Keranjang tamu hanya dibaca saat belum login.
  useEffect(() => {
    if (token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keranjang tamu hanya ada di localStorage (sistem eksternal), dibaca setelah mount
    setGuestItems(readGuestCart());
    setGuestLoaded(true);
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token || isAdmin) return;
    try {
      const res = await getCart(token);
      setServerCart(res.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat keranjang.");
    }
  }, [token, isAdmin]);

  // Login pertama: gabungkan keranjang tamu, lalu selalu baca dari server.
  useEffect(() => {
    if (!token) {
      syncedUserRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- logout: buang keranjang server dari state
      setServerCart(null);
      return;
    }
    // Admin tidak punya keranjang; jangan memanggil endpoint yang pasti 403.
    if (isAdmin) {
      setServerCart(null);
      setLoading(false);
      return;
    }
    if (syncedUserRef.current === token) return;

    let active = true;
    setLoading(true);
    (async () => {
      try {
        const guest = readGuestCart();
        const res = guest.length
          ? await mergeCart({ items: guest.map((item) => ({ book_id: item.id, quantity: item.quantity })) }, token)
          : await getCart(token);
        if (!active) return;
        setServerCart(res.data);
        if (guest.length) writeGuestCart([]);
        syncedUserRef.current = token;
        setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Gagal memuat keranjang.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token, isAdmin]);

  // Harga/stok bisa berubah kapan saja di server; segarkan saat tab kembali aktif
  // atau drawer dibuka, bukan lewat polling berkala.
  useEffect(() => {
    if (!token || isAdmin) return;
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [token, isAdmin, refresh]);

  const addToCart = useCallback(
    async (product: CartAddInput, quantity = 1) => {
      if (isAdmin) {
        throw new Error("Administrator tidak dapat menambahkan buku ke keranjang.");
      }
      if (!token) {
        setGuestItems((prev) => {
          const index = prev.findIndex((item) => item.id === product.id);
          let next: GuestCartItem[];
          if (index > -1) {
            next = [...prev];
            next[index] = { ...next[index], quantity: next[index].quantity + quantity };
          } else {
            next = [...prev, toGuestItem(product, quantity)];
          }
          writeGuestCart(next);
          return next;
        });
        return;
      }

      setLoading(true);
      try {
        const res = await addCartItem({ book_id: product.id, quantity }, token);
        setServerCart(res.data);
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal menambahkan ke keranjang.");
        throw cause;
      } finally {
        setLoading(false);
      }
    },
    [token, isAdmin]
  );

  const removeFromCart = useCallback(
    async (id: string) => {
      if (!token) {
        setGuestItems((prev) => {
          const next = prev.filter((item) => item.id !== id);
          writeGuestCart(next);
          return next;
        });
        return;
      }
      setLoading(true);
      try {
        const res = await removeCartItem(id, token);
        setServerCart(res.data);
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal menghapus dari keranjang.");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (quantity <= 0) {
        await removeFromCart(id);
        return;
      }
      if (!token) {
        setGuestItems((prev) => {
          const next = prev.map((item) => (item.id === id ? { ...item, quantity } : item));
          writeGuestCart(next);
          return next;
        });
        return;
      }
      setLoading(true);
      try {
        const res = await updateCartItem(id, quantity, token);
        setServerCart(res.data);
        setError("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Gagal memperbarui jumlah.");
      } finally {
        setLoading(false);
      }
    },
    [token, removeFromCart]
  );

  const clearCart = useCallback(async () => {
    if (!token) {
      setGuestItems([]);
      writeGuestCart([]);
      return;
    }
    setLoading(true);
    try {
      const res = await clearCartRequest(token);
      setServerCart(res.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal mengosongkan keranjang.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const items = isAdmin ? [] : token ? toCartItems(serverCart) : guestLoaded ? guestToCartItems(guestItems) : [];
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => acc + item.subtotal, 0);
  const hasUnavailableItems = items.some((item) => !item.available);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refresh,
        totalItems,
        totalPrice,
        hasUnavailableItems,
        loading,
        error,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
