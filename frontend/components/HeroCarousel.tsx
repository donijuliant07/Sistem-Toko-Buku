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
    <section className="max-w-7xl mx-auto px-4 pt-4 pb-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Main Banner Carousel (Lebar 8 Kolom) */}
        <div
          className="lg:col-span-8 relative rounded-2xl overflow-hidden shadow-xs aspect-[2/1] bg-slate-900 group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {HERO_BANNERS.map((banner, index) => (
            <a
              key={banner.id}
              href={banner.href || "#"}
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === currentIndex ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {banner.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt="Main Banner"
                  className="w-full h-full object-cover object-center"
                />
              )}
            </a>
          ))}

          {/* Prev Button */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Slide Sebelumnya"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 focus:outline-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Next Button */}
          <button
            type="button"
            onClick={handleNext}
            aria-label="Slide Selanjutnya"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 focus:outline-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 right-5 z-20 flex gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {HERO_BANNERS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  i === currentIndex ? "bg-white w-6" : "bg-white/50 w-2"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Side Banners (Lebar 4 Kolom, Flex Col dengan Spacing yang Seimbang) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4 lg:gap-5">
          {HERO_SIDE_BANNERS.map((side) => (
            <a
              key={side.id}
              href={side.href || "#"}
              className="relative w-full aspect-[2.15/1] rounded-2xl shadow-xs overflow-hidden group hover:shadow-md transition-shadow bg-slate-900 block shrink-0"
            >
              {side.type === "video" ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 block"
                >
                  <source src={side.mediaUrl} type="video/mp4" />
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={side.mediaUrl}
                  alt="Side Banner"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 block"
                />
              )}
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}