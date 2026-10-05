"use client";

import { useEffect, useState } from "react";
import { getBooks } from "@/lib/api";
import type { Book, BookPage } from "@/lib/types";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import CategoryShortcuts from "@/components/CategoryShortcuts";
import ProductCard from "@/components/ProductCard";
import ProductSection from "@/components/ProductSection";
import Footer from "@/components/Footer";
import FloatingCS from "@/components/FloatingCS";
import {
  BACK_TO_CAMPUS_PRODUCTS,
  BESTSELLER_BOOKS,
  BRAND_RECOMMENDATIONS,
  Product,
} from "@/data/mockData";

const initialPage: BookPage = { items: [], total: 0, page: 1, page_size: 12 };

export default function Home() {
  const [page, setPage] = useState<BookPage>(initialPage);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getBooks(page.page, query)
      .then((data) => active && setPage(data))
      .catch(() => active && setError("Katalog buku gagal dimuat. Menampilkan koleksi mock Gramedia."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page.page, query]);

  const handleSearchSubmit = (q: string) => {
    setPage((curr) => ({ ...curr, page: 1 }));
    setQuery(q);
  };

  // Convert Backend API Books to Product shape for unified component rendering
  const apiProducts: Product[] = page.items.map((b: Book) => ({
    id: b.id,
    title: b.title,
    authorOrBrand: b.author,
    price: typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000,
    originalPrice: (typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000) * 1.2,
    discountPercent: 15,
    soldCount: (b.stock || 5) * 42,
    badgeLanguage: "ID",
    coverUrl: b.cover_url || "",
    category: "katalog",
    type: "book",
  }));

  const pageCount = Math.max(1, Math.ceil(page.total / page.page_size));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* 1. Top Bar */}
      <TopBar />

      {/* 2. Sticky Header */}
      <Header
        query={query}
        onSearchSubmit={handleSearchSubmit}
        cartCount={page.total > 0 ? page.total : 0}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {/* 3. Hero Banner Carousel */}
        <HeroCarousel />

        {/* 4. Quick Categories */}
        <CategoryShortcuts
          activeId={activeCategory}
          onSelectCategory={(id) => setActiveCategory(id)}
        />

        {/* 5. Section: Back To Campus */}
        <ProductSection
          id="back-to-campus"
          title="Back To Campus 2026"
          products={BACK_TO_CAMPUS_PRODUCTS}
          cardAspect="square"
        />

        {/* 6. Section: Buku Terlaris */}
        <ProductSection
          id="buku-terlaris"
          title="Buku Terlaris Gramedia"
          products={BESTSELLER_BOOKS}
          sideBanner={{
            tag: "BESTSELLER 2026",
            title: "Koleksi Buku Pilihan Paling Dicari",
            subtitle: "Dari fiksi mendalam hingga pengembangan diri inspiratif.",
            bgGradient: "from-blue-900 via-indigo-900 to-sky-900",
          }}
          cardAspect="book"
        />

        {/* 7. Section: Rekomendasi Brand Pilihan */}
        <ProductSection
          id="brand-pilihan"
          title="Rekomendasi Brand Pilihan"
          products={BRAND_RECOMMENDATIONS}
          sideBanner={{
            tag: "LIFESTYLE & IT",
            title: "Brand Favorit & Original",
            subtitle: "Jaminan produk 100% asli dari distributor resmi Gramedia.",
            bgGradient: "from-amber-700 via-orange-800 to-red-900",
          }}
          cardAspect="square"
        />

        {/* 8. Full Catalog / Backend Integration Section */}
        <section id="katalog" className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 pb-4 border-b border-gray-200 gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                Katalog Lengkap Toko Buku
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {query ? `Hasil pencarian untuk "${query}"` : "Semua koleksi buku yang tersedia di database."}
              </p>
            </div>
            {page.total > 0 && (
              <span className="text-xs text-gray-500 font-medium">
                Total {page.total} buku ditemukan
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 mb-6 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-3">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-3 border border-gray-100 animate-pulse h-64 flex flex-col justify-between">
                  <div className="w-full h-36 bg-gray-100 rounded-lg mb-2" />
                  <div className="space-y-2">
                    <div className="w-3/4 h-3 bg-gray-100 rounded" />
                    <div className="w-1/2 h-3 bg-gray-100 rounded" />
                  </div>
                  <div className="w-full h-4 bg-gray-100 rounded mt-2" />
                </div>
              ))}
            </div>
          ) : apiProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {apiProducts.map((prod) => (
                <ProductCard key={prod.id} product={prod} aspectRatio="book" />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <span className="text-4xl block mb-2">📚</span>
              <p className="text-sm font-semibold text-gray-700">Buku tidak ditemukan</p>
              <p className="text-xs text-gray-400 mt-1">Coba gunakan kata kunci pencarian yang berbeda.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                type="button"
                disabled={page.page <= 1}
                onClick={() => setPage((c) => ({ ...c, page: c.page - 1 }))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                &larr; Sebelumnya
              </button>
              <span className="text-xs text-gray-500 font-medium px-2">
                Halaman {page.page} dari {pageCount}
              </span>
              <button
                type="button"
                disabled={page.page >= pageCount}
                onClick={() => setPage((c) => ({ ...c, page: c.page + 1 }))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Selanjutnya &rarr;
              </button>
            </div>
          )}
        </section>
      </main>

      {/* 9. Footer */}
      <Footer />

      {/* 10. Floating Customer Service WhatsApp */}
      <FloatingCS />
    </div>
  );
}
