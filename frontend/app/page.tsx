"use client";

import { useEffect, useState, useMemo } from "react";
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
import BookDetailModal from "@/components/BookDetailModal";
import { Product } from "@/data/mockData";
import { ArrowDownUp, Check, RotateCcw, Sparkles } from "lucide-react";

const initialPage: BookPage = { items: [], total: 0, page: 1, page_size: 12 };

type SortOption = "relevance" | "price_asc" | "price_desc" | "title_asc";

export default function Home() {
  const [page, setPage] = useState<BookPage>(initialPage);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filter & Sorting state
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Fetch initial featured books for showcase sections
  useEffect(() => {
    let active = true;
    getBooks(1, "", 24)
      .then((data) => {
        if (active && data?.items) {
          setFeaturedBooks(data.items);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getBooks(page.page, query)
      .then((data) => {
        if (active) {
          setPage(data);
          setError("");
        }
      })
      .catch(() => active && setError("Katalog buku gagal dimuat dari server."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page.page, query]);

  const handleSearchSubmit = (q: string) => {
    setPage((curr) => ({ ...curr, page: 1 }));
    setQuery(q);
  };

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategory(categoryId);
    // Smooth scroll to catalog
    const catalogElem = document.getElementById("katalog");
    if (catalogElem) {
      catalogElem.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setActiveCategory("all");
    setSortBy("relevance");
    setOnlyInStock(false);
    setPage((curr) => ({ ...curr, page: 1 }));
  };

  const toProduct = (b: Book, category = "buku"): Product => ({
    id: b.id,
    title: b.title,
    authorOrBrand: b.author,
    price: typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000,
    originalPrice: (typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000) * 1.15,
    discountPercent: 15,
    soldCount: (b.stock || 5) * 12,
    badgeLanguage: "ID",
    coverUrl: b.cover_url || "",
    category,
    type: "book",
    stock: b.stock,
  });

  // Showcase books
  const bestsellerProducts: Product[] = (featuredBooks.length > 0 ? featuredBooks.slice(0, 8) : page.items.slice(0, 8)).map((b) => toProduct(b, "terlaris"));
  const campusBooks: Product[] = (featuredBooks.length > 8 ? featuredBooks.slice(8, 16) : page.items.slice(0, 6)).map((b) => toProduct(b, "edukasi"));
  const newReleaseBooks: Product[] = (featuredBooks.length > 16 ? featuredBooks.slice(16, 24) : page.items.slice(0, 6)).map((b) => toProduct(b, "rekomendasi"));

  // Processed catalog products with sorting and stock filtering
  const processedProducts = useMemo(() => {
    let items = page.items.map((b) => toProduct(b, "katalog"));

    if (onlyInStock) {
      items = items.filter((p) => p.stock === undefined || p.stock > 0);
    }

    if (sortBy === "price_asc") {
      items.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      items.sort((a, b) => b.price - a.price);
    } else if (sortBy === "title_asc") {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }

    return items;
  }, [page.items, onlyInStock, sortBy]);

  const pageCount = Math.max(1, Math.ceil(page.total / page.page_size));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* 1. Top Bar */}
      <TopBar />

      {/* 2. Sticky Header with User Identifier */}
      <Header
        query={query}
        onSearchSubmit={handleSearchSubmit}
        cartCount={page.total > 0 ? page.total : 0}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {/* 3. Hero Banner Carousel & Trust Badges */}
        <HeroCarousel />

        {/* 4. Quick Categories */}
        <CategoryShortcuts
          activeId={activeCategory}
          onSelectCategory={handleCategorySelect}
        />

        {/* 5. Section: Buku Terlaris */}
        {bestsellerProducts.length > 0 && (
          <ProductSection
            id="buku-terlaris"
            title="Buku Terlaris & Populer"
            products={bestsellerProducts}
            onSelectProduct={(p) => setSelectedProduct(p)}
            sideBanner={{
              tag: "BESTSELLER 2026",
              title: "Koleksi Buku Pilihan Paling Dicari",
              subtitle: "Dari fiksi mendalam hingga pengembangan diri inspiratif.",
              bgGradient: "from-slate-950/95 via-slate-900/85 to-slate-900/60",
              imageUrl: "/images/reading-corner.jpg",
            }}
            cardAspect="book"
          />
        )}

        {/* 6. Section: Rekomendasi Pilihan */}
        {campusBooks.length > 0 && (
          <ProductSection
            id="edukasi"
            title="Rekomendasi Buku Pilihan"
            products={campusBooks}
            onSelectProduct={(p) => setSelectedProduct(p)}
            sideBanner={{
              tag: "EDUKASI & SASTRA",
              title: "Bacaan Inspiratif Masa Kini",
              subtitle: "Koleksi sastra Indonesia dan pengembangan diri terlengkap.",
              bgGradient: "from-slate-950/95 via-stone-900/85 to-stone-900/60",
              imageUrl: "/images/bookstore-visitor.jpg",
            }}
            cardAspect="book"
          />
        )}

        {/* 7. Section: Buku Baru & Unggulan */}
        {newReleaseBooks.length > 0 && (
          <ProductSection
            id="buku-unggulan"
            title="Buku Baru & Unggulan"
            products={newReleaseBooks}
            onSelectProduct={(p) => setSelectedProduct(p)}
            cardAspect="book"
          />
        )}

        {/* 8. Full Catalog / Backend Integration Section */}
        <section id="katalog" className="max-w-[1200px] mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-gray-200 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  Katalog Lengkap Toko Buku
                </h3>
                {query && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-[#0052cc]">
                    Pencarian
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {query
                  ? `Hasil pencarian untuk "${query}"`
                  : "Jelajahi koleksi buku resmi kami dengan berbagai kategori bacaan."}
              </p>
            </div>

            {/* Catalog Controls: Sorting & Filter */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              {/* Ready Stock Filter Toggle */}
              <button
                type="button"
                onClick={() => setOnlyInStock(!onlyInStock)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  onlyInStock
                    ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                    onlyInStock
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {onlyInStock && <Check className="w-3 h-3" />}
                </div>
                <span>Stok Tersedia</span>
              </button>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-700 shadow-2xs">
                <ArrowDownUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-400 text-[11px] hidden sm:inline">Urutkan:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-transparent text-xs font-semibold text-gray-800 focus:outline-none cursor-pointer py-0.5"
                >
                  <option value="relevance">Paling Relevan</option>
                  <option value="price_asc">Harga: Rendah ke Tinggi</option>
                  <option value="price_desc">Harga: Tinggi ke Rendah</option>
                  <option value="title_asc">Judul: A - Z</option>
                </select>
              </div>

              {(query || onlyInStock || sortBy !== "relevance") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-1.5 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1"
                  title="Reset Filter"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
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
          ) : processedProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {processedProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  aspectRatio="book"
                  onSelect={(p) => setSelectedProduct(p)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white rounded-2xl border border-gray-100 max-w-md mx-auto my-6 shadow-xs">
              <span className="text-4xl block mb-3">📚</span>
              <h4 className="text-sm font-bold text-gray-800">Buku tidak ditemukan</h4>
              <p className="text-xs text-gray-400 mt-1 mb-4">
                {query
                  ? `Tidak ada buku yang cocok dengan "${query}".`
                  : "Tidak ada buku yang sesuai dengan filter yang dipilih."}
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0052cc] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pencarian & Filter</span>
              </button>
            </div>
          )}

          {/* Pagination Controls */}
          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                type="button"
                disabled={page.page <= 1}
                onClick={() => setPage((c) => ({ ...c, page: c.page - 1 }))}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-2xs"
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
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-2xs"
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

      {/* 11. Modal Detail Buku & Tambah ke Keranjang */}
      <BookDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
