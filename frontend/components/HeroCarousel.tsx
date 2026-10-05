"use client";

import { useEffect, useState } from "react";
import { HERO_BANNERS, HERO_SIDE_BANNERS } from "@/data/mockData";

export default function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="max-w-[1200px] mx-auto px-4 pt-4 pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Carousel (approx 8 cols) */}
        <div className="lg:col-span-8 relative rounded-2xl overflow-hidden shadow-sm aspect-[16/8] sm:aspect-[3/1] lg:aspect-[16/7] bg-slate-900 flex items-center">
          {HERO_BANNERS.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 bg-gradient-to-r ${banner.imageBg} p-6 sm:p-10 flex flex-col justify-center text-white ${
                index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <span className="inline-block self-start px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-md text-[11px] font-bold tracking-wider uppercase mb-2">
                PROMO SPESIAL
              </span>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold max-w-lg leading-tight mb-2">
                {banner.title}
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 max-w-md line-clamp-2 mb-4">
                {banner.subtitle}
              </p>
              <a
                href={banner.href}
                className="self-start inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg text-xs sm:text-sm font-bold shadow-md hover:bg-gray-100 transition-all hover:scale-105"
              >
                {banner.ctaText} &rarr;
              </a>
            </div>
          ))}

          {/* Nav Dots */}
          <div className="absolute bottom-3 right-4 z-20 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
            {HERO_BANNERS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentIndex ? "bg-white w-5" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 2 Static Side Banners */}
        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
          {HERO_SIDE_BANNERS.map((side) => (
            <div
              key={side.id}
              className={`flex-1 ${side.bgColor} text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow`}
            >
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/25 text-amber-300 uppercase tracking-wider">
                  {side.tag}
                </span>
                <h3 className="font-bold text-base sm:text-lg mt-2 leading-snug">
                  {side.title}
                </h3>
                <p className="text-xs text-white/80 mt-1 line-clamp-2">
                  {side.desc}
                </p>
              </div>
              <a
                href="#katalog"
                className="text-xs font-semibold mt-3 text-white inline-flex items-center gap-1 group-hover:underline"
              >
                Cek Sekarang &rarr;
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
