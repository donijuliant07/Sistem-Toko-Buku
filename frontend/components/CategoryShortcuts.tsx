"use client";

import { useState } from "react";
import { CATEGORIES } from "@/data/mockData";
import FreepikCategoryIcon from "./FreepikCategoryIcon";
import { Play, Pause, Compass, ArrowRight } from "lucide-react";

interface CategoryShortcutsProps {
  onSelectCategory?: (id: string) => void;
  activeId?: string;
}

export default function CategoryShortcuts({
  onSelectCategory,
  activeId = "all",
}: CategoryShortcutsProps) {
  // State untuk mengontrol status perhentian marquee (berhenti saat diklik)
  const [isPaused, setIsPaused] = useState(false);

  const handleCardClick = (categoryId: string) => {
    // 1. Berhenti saat diklik
    setIsPaused(true);
    // 2. Redirect / trigger filter ke kategori buku yang dipilih
    onSelectCategory?.(categoryId);
  };

  const togglePause = () => {
    setIsPaused((prev) => !prev);
  };

  return (
    <section className="max-w-[1240px] mx-auto px-4 py-6">
      {/* Header section with Freepik Badge & Marquee Control Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-[#0052cc]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                Jelajahi Kategori Buku
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-2xs">
                Premium Freepik 3D
              </span>
            </div>
            <p className="text-[11px] text-gray-500 hidden sm:block">
              Pilih genre favoritmu — geser otomatis, klik untuk menghentikan & jelajahi buku
            </p>
          </div>
        </div>

        {/* Marquee Play / Pause Control Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              isPaused
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 shadow-2xs"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            title={isPaused ? "Lanjutkan putaran marquee" : "Jeda putaran marquee"}
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3 fill-amber-700" />
                <span className="text-[11px]">Marquee Dijeda (Klik Putar)</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span className="text-[11px] hidden sm:inline">Marquee Berjalan</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Marquee Track Container with Gradient Edge Fades */}
      <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-b from-gray-50/80 to-slate-50/40 p-2 sm:p-3 border border-gray-100/80 shadow-2xs">
        {/* Left Fading Edge Mask */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-r from-gray-50 via-gray-50/80 to-transparent z-10" />

        {/* Right Fading Edge Mask */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 sm:w-20 bg-gradient-to-l from-gray-50 via-gray-50/80 to-transparent z-10" />

        {/* Scrolling Flex Track: duplicated items for seamless infinite loop */}
        <div
          className={`animate-marquee-scroll flex gap-3.5 sm:gap-5 py-2 px-2 ${
            isPaused ? "marquee-paused" : ""
          }`}
        >
          {/* Loop twice for endless continuous marquee */}
          {[...CATEGORIES, ...CATEGORIES].map((cat, index) => {
            const isActive = activeId === cat.id;
            const uniqueKey = `${cat.id}-${index}`;

            return (
              <button
                key={uniqueKey}
                type="button"
                onClick={() => handleCardClick(cat.id)}
                className={`group shrink-0 flex flex-col items-center p-3 sm:p-3.5 rounded-2xl transition-all duration-300 focus:outline-none cursor-pointer min-w-[110px] sm:min-w-[130px] border select-none ${
                  isActive
                    ? "bg-white border-[#0052cc] shadow-md ring-3 ring-[#0052cc]/15 scale-[1.04]"
                    : "bg-white/90 hover:bg-white border-gray-100 hover:border-blue-200 hover:shadow-md hover:-translate-y-1"
                }`}
                title={`Kategori ${cat.name}`}
              >
                {/* 3D Freepik Icon Backdrop Box */}
                <div
                  className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center p-1.5 transition-all duration-300 group-hover:scale-110 relative ${
                    isActive
                      ? "bg-gradient-to-br from-blue-50 to-indigo-100 shadow-inner"
                      : "bg-gradient-to-br from-slate-50 to-gray-100/90 group-hover:from-blue-50/50 group-hover:to-indigo-50/50"
                  }`}
                >
                  <FreepikCategoryIcon
                    id={cat.id}
                    size={46}
                    className="w-11 h-11 sm:w-12 sm:h-12 drop-shadow-sm transition-transform duration-300 group-hover:scale-105"
                  />
                  {isActive && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-[#0052cc]" />
                    </span>
                  )}
                </div>

                {/* Category Name */}
                <span
                  className={`text-xs font-bold transition-colors text-center max-w-[100px] truncate mt-1 ${
                    isActive
                      ? "text-[#0052cc]"
                      : "text-gray-800 group-hover:text-[#0052cc]"
                  }`}
                >
                  {cat.name}
                </span>

                {/* Category Subtitle / Tag */}
                {cat.tag && (
                  <span className="text-[10px] font-medium text-gray-400 group-hover:text-gray-600 transition-colors max-w-[105px] truncate">
                    {cat.tag}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
