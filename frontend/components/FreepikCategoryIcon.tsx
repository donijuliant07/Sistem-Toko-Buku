"use client";

import React from "react";
import Image from "next/image";

export type CategoryIconId =
  | "all"
  | "fiksi"
  | "self-dev"
  | "bisnis"
  | "edukasi"
  | "komik"
  | "english"
  | "teknologi"
  | "anak"
  | "religi"
  | "biografi"
  | string;

interface FreepikCategoryIconProps {
  id: CategoryIconId;
  className?: string;
  size?: number;
  /** Lebar render ikon untuk `srcset`. Harus sama dengan ukuran di className,
   *  karena className-lah yang menentukan ukuran kotak ikon. */
  sizes?: string;
}

export default function FreepikCategoryIcon({
  id,
  className = "w-12 h-12",
  sizes = "48px",
}: FreepikCategoryIconProps) {
  // Daftar mapping ID kategori ke nama file gambar masing-masing
  const iconMap: Record<string, string> = {
    "komik": "/images/naruto-icon.jpg",
    "komik-manga": "/images/naruto-icon.jpg",
    "manga": "/images/naruto-icon.jpg",
    
    "edukasi": "/images/edukasi-icon.jpg",
    "education": "/images/edukasi-icon.jpg",
    
    "anak": "/images/anak-icon.jpg",
    "buku-anak": "/images/anak-icon.jpg",
    
    "religi": "/images/religi-icon.jpg",
    "religion": "/images/religi-icon.jpg",
    
    "biografi": "/images/biografi-icon.jpg",
    "biography": "/images/biografi-icon.jpg",
    
    "fiksi": "/images/fiksi-icon.jpg",
    "fiction": "/images/fiksi-icon.jpg",
    "fiksi-sastra": "/images/fiksi-icon.jpg",
    "sastra": "/images/fiksi-icon.jpg",
    
    "self-dev": "/images/self-icon.jpg", // Sesuai nama file di screenshot
    "self-development": "/images/self-icon.jpg",
    
    "bisnis": "/images/bisnis-icon.jpg",
    "business": "/images/bisnis-icon.jpg",
    
    "all": "/images/semua-icon.jpg",
    "semua": "/images/semua-icon.jpg",
  };

  const imageSrc = iconMap[id];

  // Jika ID kategori ditemukan di dalam iconMap, tampilkan gambarnya
  if (imageSrc) {
    return (
      <div className={`relative overflow-hidden rounded-lg ${className}`}>
        <Image
          src={imageSrc}
          alt={`Kategori ${id}`}
          fill
          sizes={sizes}
          className="object-cover"
        />
      </div>
    );
  }

  // Jika tidak ditemukan (misal: kategori 'teknologi' atau 'english'), tampilkan placeholder kosong
  return (
    <div
      className={`rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 flex items-center justify-center transition-colors group-hover:border-blue-400 ${className}`}
      title="Area Gambar Kategori"
    />
  );
}