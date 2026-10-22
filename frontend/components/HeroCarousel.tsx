"use client";

import { useEffect, useState } from "react";
import { HERO_BANNERS, HERO_SIDE_BANNERS } from "@/data/mockData";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    <section className="max-w-7xl mx-auto px-4 pt-4 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Main Carousel */}
        <div
          className="lg:col-span-8 relative rounded-2xl overflow-hidden shadow-sm aspect-[4/3] sm:aspect-[16/10] lg:min-h-[520px] bg-slate-900 flex items-center group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {HERO_BANNERS.map((banner, index) => (
            <div
              key={banner.id}
              className={`absolute inset-0 transition-opacity duration-700 p-8 sm:p-12 lg:p-16 flex flex-col justify-center text-white ${
                index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
              )}

              <div
                className={`absolute inset-0 bg-gradient-to-r ${banner.imageBg} z-1`}
              />

              <div className="relative z-10 max-w-lg">
                <span className="inline-block self-start px-3 py-1 bg-white/20 backdrop-blur-md rounded-md text-xs font-bold tracking-wider uppercase mb-4 text-white">
                  PROMO SPESIAL
                </span>
                <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4 text-white drop-shadow-sm">
                  {banner.title}
                </h2>
                <p className="text-sm sm:text-base lg:text-lg text-gray-100/95 max-w-md line-clamp-3 mb-8 drop-shadow-sm">
                  {banner.subtitle}
                </p>
                <a
                  href={banner.href}
                  className="self-start inline-flex items-center gap-2 px-7 py-3.5 bg-white hover:bg-slate-100 rounded-xl text-sm sm:text-base font-extrabold shadow-md transition-all hover:scale-105 active:scale-95"
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
            className="absolute left-3 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-75 focus:outline-none cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Slide Selanjutnya"
            className="absolute right-3 z-20 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 sm:opacity-75 focus:outline-none cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Nav Dots */}
          <div className="absolute bottom-5 right-6 z-20 flex gap-2 bg-black/40 backdrop-blur-sm px-3.5 py-2 rounded-full">
            {HERO_BANNERS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  i === currentIndex ? "bg-white w-7" : "bg-white/50 w-2.5"
                }`}
              />
            ))}
          </div>
        </div>

        {/* 2 Side Banners */}
        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
          {HERO_SIDE_BANNERS.map((side) => (
            <div
              key={side.id}
              className="flex-1 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow p-6 text-white min-h-[230px] lg:min-h-[250px]"
            >
              {side.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={side.imageUrl}
                  alt={side.title}
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              )}

              <div
                className={`absolute inset-0 bg-gradient-to-t ${side.bgColor} z-1`}
              />

              <div className="relative z-10">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/40 backdrop-blur-xs text-amber-300 uppercase tracking-wider">
                  {side.tag}
                </span>
                <h3 className="font-bold text-lg sm:text-2xl mt-2 leading-snug drop-shadow-sm">
                  {side.title}
                </h3>
                <p className="text-xs sm:text-sm text-white/90 mt-1.5 line-clamp-2 drop-shadow-sm">
                  {side.desc}
                </p>
              </div>

              <div className="relative z-10 mt-3">
                <a
                  href={side.href || "#katalog"}
                  className="text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1 group-hover:underline"
                >
                  {side.ctaText || "Cek Sekarang"} &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}