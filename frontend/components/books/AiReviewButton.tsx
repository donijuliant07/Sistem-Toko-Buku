"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiReviewButtonProps {
  onClick: () => void;
  busy?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Tombol AI dengan cincin conic berputar (shadcnspace Button 33, "Generate AI").
 *
 * Cincinnya sebuah kotak conic-gradient yang diputar; penutup `inset-[2px]`
 * menyisakan garis tipis di tepi. Kotak itu sengaja `w-[300%] aspect-square`,
 * bukan `size-40` seperti contoh aslinya: contoh itu mengasumsikan pill sempit,
 * sedangkan tombol di sini selebar ~260px, sehingga kotak 160px tidak menutupi
 * kedua ujung dan cincinnya hilang di kiri-kanan.
 *
 * `overflow-hidden` pada tombol memotong kotak itu jadi pill.
 */
export default function AiReviewButton({
  onClick,
  busy = false,
  size = "md",
  className,
}: AiReviewButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "group/ai relative inline-flex w-full items-center justify-center overflow-hidden rounded-full border border-[#E5E5EA] bg-[var(--surface)] font-medium tracking-[-0.01em] text-[#1D1D1F] shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:border-[#D1D1D6] hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071E3] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer",
        size === "md" ? "h-10 px-5 text-xs" : "h-8 px-4 text-[11px]",
        className,
      )}
      // Plus Jakarta Sans dipasang lewat style: `body` memakai font-family di luar
      // @layer base, jadi utility font Tailwind kalah olehnya.
      style={{ fontFamily: "var(--font-jakarta)" }}
    >
      <span aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden rounded-full">
        <span
          className="absolute top-1/2 left-1/2 aspect-square w-[300%] -translate-x-1/2 -translate-y-1/2 animate-spin bg-[conic-gradient(from_0deg,transparent_0%,transparent_8%,#ff2d55_12%,#ff8c00_20%,#ffe600_27%,#00d26a_34%,#00b8ff_41%,#7a5cff_47%,#ff2d55_52%,transparent_56%,transparent_62%,#ff8c00_68%,#ffe600_75%,#00d26a_82%,#00b8ff_89%,#7a5cff_95%,transparent_99%,transparent_100%)] motion-reduce:animate-none"
          style={{ animationDuration: "2.5s" }}
        />
        <span className="absolute inset-[2px] rounded-full bg-[var(--surface)]" />
      </span>

      <span className="relative z-10 inline-flex items-center gap-1.5 tracking-tight">
        {busy ? (
          <Loader2
            className="size-3.5 animate-spin text-[#0071E3] motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          // #BAFF29 di atas pill putih hanya 1.21:1 — ikonnya hilang. Jadi
          // lime-nya dipakai sebagai kotak mungil, ikonnya gelap di atasnya.
          <span
            aria-hidden="true"
            className="flex size-[18px] items-center justify-center rounded-[5px] bg-[#BAFF29] transition-transform duration-300 group-hover/ai:scale-110 group-hover/ai:-rotate-6 motion-reduce:transition-none"
          >
            <Sparkles className="size-3 text-[#1D1D1F]" fill="currentColor" />
          </span>
        )}
        <span>{busy ? "Menyusun ulasan…" : "AI Review"}</span>
      </span>
    </button>
  );
}