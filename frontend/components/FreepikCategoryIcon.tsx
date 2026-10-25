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
}

export default function FreepikCategoryIcon({
  id,
  className = "w-12 h-12",
}: FreepikCategoryIconProps) {
  // Khusus kategori Komik & Manga
  if (id === "komik") {
    return (
      <div className={`relative overflow-hidden rounded-lg ${className}`}>
        <Image
          src="/images/naruto-icon.jpg" // Ubah path ini sesuai nama file gambarmu di folder public/images/
          alt="Komik & Manga"
          fill
          className="object-cover"
        />
      </div>
    );
  }

  // Untuk kategori lainnya, tetap menggunakan placeholder kosong
  return (
    <div
      className={`rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 flex items-center justify-center transition-colors group-hover:border-blue-400 ${className}`}
      title="Area Gambar Kategori"
    />
  );
}