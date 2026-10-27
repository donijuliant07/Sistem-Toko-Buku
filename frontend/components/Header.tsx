"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { siteConfig } from "@/config/site";
import UserDropdown from "@/components/UserDropdown";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/context/CartContext";
import { Search, X, Bell, ShoppingCart, Sparkles } from "lucide-react";
import BookAdvisorWidget from "@/components/BookAdvisorWidget";
import ReadrLogo from "@/components/ReadrLogo";

interface HeaderProps {
  query: string;
  onSearchSubmit: (q: string) => void;
  cartCount?: number;
}

export default function Header({ query, onSearchSubmit }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [input, setInput] = useState(query);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  
  const { totalItems, setIsCartOpen } = useCart();
  const { role } = useAuth();

  const showCart = role !== "admin";

  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setInput(query);
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pathname === "/") {
      onSearchSubmit(input);
      if (input.trim()) {
        setTimeout(() => {
          const catalogElem = document.getElementById("katalog");
          if (catalogElem) {
            catalogElem.scrollIntoView({ behavior: "smooth" });
          }
        }, 50);
      }
    } else {
      router.push(`/?q=${encodeURIComponent(input)}#katalog`);
    }
  };

  const handleClear = () => {
    setInput("");
    onSearchSubmit("");
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-xs border-b border-gray-100 transition-all">
      <div className="max-w-[1200px] mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo */}
          <ReadrLogo href="/" size="md" showTagline />

          {/* Search Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 max-w-2xl mx-1 sm:mx-6"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Cari buku, penulis, judul, topik..."
                className="w-full h-10 pl-10 pr-18 sm:pr-20 bg-gray-50 border border-gray-200 rounded-full text-xs sm:text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0052cc] focus:bg-white focus:ring-2 focus:ring-[#0052cc]/10 transition-all"
              />
              {input && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-10 sm:right-11 p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                aria-label="Cari"
                className="absolute right-1 w-8 h-8 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-full flex items-center justify-center transition-colors shadow-xs active:scale-95 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Actions: AI, Wishlist/Notif, Cart, User Identifier */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Tombol AI Advisor Header */}
            <button
              type="button"
              onClick={() => setIsAiSidebarOpen(true)}
              className="p-2 text-emerald-600 bg-transparent hover:bg-gray-100 rounded-full transition-colors relative hidden md:flex items-center justify-center cursor-pointer"
              title="AI Advisor"
            >
              <Sparkles className="w-5 h-5" />
            </button>

            <button
              type="button"
              className="p-2 text-gray-500 hover:text-[#0052cc] hover:bg-blue-50/50 rounded-full transition-colors relative hidden md:block"
              title="Notifikasi"
            >
              <Bell className="w-5 h-5" />
            </button>

            {/* Cart Button with Drawer Trigger */}
            {showCart && (
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="p-2 text-gray-600 hover:text-[#0052cc] hover:bg-blue-50/50 rounded-full transition-colors relative cursor-pointer active:scale-95"
                title="Keranjang Belanja"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#e61c24] text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-in zoom-in-50 shadow-xs">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            )}

            {/* User Identifier & Profile Menu */}
            <div className="pl-1 sm:pl-2 border-l border-gray-200">
              <UserDropdown />
            </div>
          </div>
        </div>

        {/* Promo Navigation Menu Bar */}
        <nav className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none text-gray-700">
          {siteConfig.promoTags.map((tag) => (
            <Link
              key={tag.label}
              href={tag.href}
              className="hover:text-[#0052cc] transition-colors py-1 text-gray-700"
            >
              {tag.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* AI Chat Sidebar — di-portal ke <body>: `backdrop-blur-md` pada
          <header> menjadikannya containing block bagi `position: fixed`,
          sehingga overlay/panel di dalamnya hanya menutupi tinggi header. */}
      {isAiSidebarOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Overlay transparan */}
            <div
              className="fixed inset-0 bg-black/20 z-[60]"
              onClick={() => setIsAiSidebarOpen(false)}
            />

            {/* Panel Sidebar Kanan */}
            <div className="fixed top-0 right-0 h-screen w-full sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-[70] flex flex-col transform transition-transform duration-300">
              <BookAdvisorWidget onClose={() => setIsAiSidebarOpen(false)} />
            </div>
          </>,
          document.body
        )}
    </header>
  );
}