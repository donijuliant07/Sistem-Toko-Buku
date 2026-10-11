"use client";

import { useEffect, useState } from "react";
import { HERO_BANNERS, HERO_SIDE_BANNERS } from "@/data/mockData";
import { ChevronLeft, ChevronRight, ShieldCheck, Truck, PackageCheck, Sparkles } from "lucide-react";

export default function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? HERO_BANNERS.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % HERO_BANNERS.length);
  };

  return (
    <section className="max-w-[1200px] mx-auto px-4 pt-4 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Carousel with Bookstore & People Images (approx 8 cols) */}
        <div
          className="lg:col-span-8 relative rounded-2xl overflow-hidden shadow-sm aspect-[16/9] sm:aspect-[3/1] lg:aspect-[16/7] bg-slate-900 flex items-center group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {HERO_BANNERS.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 p-6 sm:p-10 flex flex-col justify-center text-white ${
                index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {/* Background Image of Bookstore with Humans */}
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              )}

              {/* Gradient Scrim for Text Legibility */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${banner.imageBg} z-1`}
              />

              {/* Banner Text & Action */}
              <div className="relative z-10 max-w-lg">
                <span className="inline-block self-start px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-md text-[11px] font-bold tracking-wider uppercase mb-2 text-white">
                  PROMO SPESIAL
                </span>
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight mb-2 text-white drop-shadow-sm">
                  {banner.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-100/95 max-w-md line-clamp-2 mb-4 drop-shadow-sm">
                  {banner.subtitle}
                </p>
                <a
                  href={banner.href}
                  className="self-start inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 rounded-xl text-xs sm:text-sm font-extrabold shadow-md transition-all hover:scale-105 active:scale-95"
                  style={{ color: "#0f172a" }}
                >
                  <span style={{ color: "#0f172a" }}>{banner.ctaText}</span>
                  <span style={{ color: "#0052cc" }} className="font-black">&rarr;</span>
                </a>
              </div>
            </div>
          ))}

          {/* Prev / Next Buttons */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Slide Sebelumnya"
            className="absolute left-2.5 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-75 focus:outline-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Slide Selanjutnya"
            className="absolute right-2.5 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-75 focus:outline-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Nav Dots */}
          <div className="absolute bottom-3 right-4 z-20 flex gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {HERO_BANNERS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === currentIndex ? "bg-white w-5" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 2 Side Banners with Bookstore Photography */}
        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
          {HERO_SIDE_BANNERS.map((side) => (
            <div
              key={side.id}
              className="flex-1 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow p-5 text-white min-h-[140px]"
            >
              {/* Bookstore Photography Background */}
              {side.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={side.imageUrl}
                  alt={side.title}
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              )}

              {/* Scrim Overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-t ${side.bgColor} z-1`}
              />

              <div className="relative z-10">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 backdrop-blur-xs text-amber-300 uppercase tracking-wider">
                  {side.tag}
                </span>
                <h3 className="font-bold text-base sm:text-lg mt-2 leading-snug drop-shadow-sm">
                  {side.title}
                </h3>
                <p className="text-xs text-white/90 mt-1 line-clamp-2 drop-shadow-sm">
                  {side.desc}
                </p>
              </div>

              <div className="relative z-10 mt-2">
                <a
                  href={side.href || "#katalog"}
                  className="text-xs font-semibold text-white inline-flex items-center gap-1 group-hover:underline"
                >
                  {side.ctaText || "Cek Sekarang"} &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Badges Strip (Value Propositions) */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#0052cc] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800">100% Buku Asli</h4>
            <p className="text-[10px] text-gray-500">Langsung dari penerbit resmi</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800">Pengiriman Cepat</h4>
            <p className="text-[10px] text-gray-500">Beragam pilihan kurir express</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800">Kemasan Aman</h4>
            <p className="text-[10px] text-gray-500">Free bubble wrap & kardus</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-800">AI Book Review</h4>
            <p className="text-[10px] text-gray-500">Ulasan & spoiler control cerdas</p>
          </div>
        </div>
      </div>
    </section>
  );
}
