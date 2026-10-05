"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { siteConfig } from "@/config/site";
import AuthButton from "@/components/AuthButton";

interface HeaderProps {
  query: string;
  onSearchSubmit: (q: string) => void;
  cartCount: number;
}

export default function Header({ query, onSearchSubmit, cartCount }: HeaderProps) {
  const [input, setInput] = useState(query);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSearchSubmit(input);
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#0052cc] flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
              G
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl leading-tight text-[#0052cc] tracking-tight">
                {siteConfig.brandName}
              </span>
              <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">
                Online Store
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-2 sm:mx-6">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Cari buku, alat tulis, mainan, dll..."
                className="w-full h-10 pl-4 pr-11 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#0052cc] focus:bg-white transition-all"
              />
              <button
                type="submit"
                aria-label="Cari"
                className="absolute right-1 w-8 h-8 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-full flex items-center justify-center transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </form>

          {/* Actions: Wishlist/Notif, Cart, Auth */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="p-2 text-gray-600 hover:text-[#0052cc] relative hidden sm:block"
              title="Notifikasi"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </button>

            <Link
              href="#katalog"
              className="p-2 text-gray-600 hover:text-[#0052cc] relative"
              title="Keranjang Belanja"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#e61c24] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <div className="pl-2 border-l border-gray-200">
              <AuthButton />
            </div>
          </div>
        </div>

        {/* Promo Navigation Menu Bar */}
        <nav className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-4 text-xs font-semibold overflow-x-auto whitespace-nowrap scrollbar-none text-gray-700">
          {siteConfig.promoTags.map((tag) => (
            <Link
              key={tag.label}
              href={tag.href}
              className={`hover:text-[#0052cc] transition-colors py-1 ${
                tag.isHighlight
                  ? "text-[#e61c24] font-bold ml-auto"
                  : "text-gray-700"
              }`}
            >
              {tag.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
