"use client";

import React, { useId } from "react";
import Link from "next/link";

interface ReadrLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  showTagline?: boolean;
  variant?: "default" | "white" | "dark";
  className?: string;
  href?: string;
}

/**
 * Tanda Readr: satu huruf R yang dibentuk dari lipatan halaman buku, dengan
 * percikan emas sebagai tanda "ulasan". Pakai token warna brand supaya ikut
 * tema terang/gelap dan tetap satu keluarga dengan sisa aplikasi.
 */
export default function ReadrLogo({
  size = "md",
  showText = true,
  showTagline = false,
  variant = "default",
  className = "",
  href,
}: ReadrLogoProps) {
  const gradientId = useId();

  const iconSizeClasses = {
    sm: "w-8 h-8 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-11 h-11 rounded-2xl",
  }[size];

  const svgSizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-7 h-7",
  }[size];

  const wordmarkSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  // Satu kata, satu warna: biru Readr — sama dengan tautan & CTA utama toko,
  // jadi wordmark tidak lagi terbelah dua warna seperti versi sebelumnya.
  const wordmarkColorClasses = {
    default: "text-[#0052cc]",
    white: "text-white",
    dark: "text-[var(--foreground)]",
  }[variant];

  const content = (
    <div className={`flex items-center gap-2.5 shrink-0 select-none group ${className}`}>
      <div
        className={`${iconSizeClasses} bg-linear-to-br from-[#1d4ed8] to-[#0052cc] flex items-center justify-center shadow-sm ring-1 ring-black/5 transition-transform duration-200 motion-safe:group-hover:-rotate-3 motion-safe:group-hover:scale-105 shrink-0`}
      >
        <svg
          className={svgSizeClasses}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="8" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          {/* R dibentuk dari satu goresan: batang, kepala bulat, dan kaki halaman */}
          <path
            d="M9 26V6h9.5a6.5 6.5 0 0 1 0 13H12"
            stroke={`url(#${gradientId})`}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17.5 19 25 26"
            stroke={`url(#${gradientId})`}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          {/* Percikan emas */}
          <path
            d="M25.5 5.5v5M23 8h5"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={`font-bold tracking-[-0.03em] ${wordmarkSizeClasses} ${wordmarkColorClasses}`}
          >
            Readr
          </span>

          {showTagline && (
            <span className="mt-1 text-[10px] font-medium tracking-wide text-[var(--muted-foreground)]">
              Toko Buku Online
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
      >
        {content}
      </Link>
    );
  }

  return content;
}
