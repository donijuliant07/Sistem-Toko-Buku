"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  X,
  ShieldAlert,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Coins,
  Lock,
  BadgeCheck,
  Loader2,
} from "lucide-react";
import { SpoilerLevel } from "@/lib/types";
import type { SpoilerAccess } from "@/lib/types";

interface SpoilerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (level: SpoilerLevel) => void;
  bookTitle: string;
  bookAuthor: string;
  isGenerating?: boolean;
  /**
   * Syarat akses per tingkat dari `GET /rewards/spoiler-access`.
   * `null` = belum dimuat (tamu / sedang memuat) — modal tetap menampilkan
   * tingkat gratis, dan tingkat berbayar tanpa label syarat.
   */
  access?: Partial<Record<SpoilerLevel, SpoilerAccess>> | null;
  /** Saldo poin pengguna; `null` bila belum dimuat. */
  points?: number | null;
  /** `false` saat pengguna belum masuk — tingkat berbayar wajib login. */
  signedIn?: boolean;
}

const SPOILER_OPTIONS: {
  level: SpoilerLevel;
  title: string;
  badge: string;
  badgeColor: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    level: "no_spoiler",
    title: "No Spoiler",
    badge: "Sangat Aman",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: ShieldCheck,
    description: "Aman dibaca sebelum membeli atau membaca buku. Membahas genre, gaya penulisan, suasana, kelebihan, dan target pembaca tanpa membuka plot cerita.",
  },
  {
    level: "low",
    title: "Spoiler Rendah",
    badge: "Aman",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    icon: CheckCircle2,
    description: "Mengandung informasi premis dan konflik awal cerita. Tidak membocorkan plot twist utama maupun penyelesaian akhir.",
  },
  {
    level: "medium",
    title: "Spoiler Medium",
    badge: "Peringatan",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    icon: AlertTriangle,
    description: "Mengandung beberapa spoiler penting, dinamika relasi karakter, dan klimaks tengah cerita.",
  },
  {
    level: "heavy",
    title: "Spoiler Berat",
    badge: "Spoiler Utama",
    badgeColor: "bg-red-100 text-red-800 border-red-200",
    icon: ShieldAlert,
    description: "Ulasan lengkap termasuk plot twist, konflik puncak, kematian karakter, hingga analisis bab penutup (ending).",
  },
];

/**
 * Label syarat satu tingkat: apa yang akan terjadi bila dipilih.
 *
 * `locked` berarti klik tetap boleh (modal akan diarahkan ke login/poin), jadi
 * labelnya menjelaskan syaratnya, bukan menyembunyikan pilihan.
 */
function AccessCostBadge({
  level,
  access,
  points,
  signedIn,
}: {
  level: SpoilerLevel;
  access?: SpoilerAccess;
  points?: number | null;
  signedIn: boolean;
}) {
  // Data akses belum ada: jangan pernah mengaku "Gratis" untuk level berbayar —
  // itu yang membuat semuanya tampak gratis saat pengguna belum masuk atau
  // permintaan `/rewards/spoiler-access` gagal.
  if (!access) {
    const free = level === "no_spoiler" || level === "low";
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
          free ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {free ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {free ? "Gratis" : signedIn ? "Memuat…" : "Perlu masuk"}
      </span>
    );
  }
  if (access.method === "free") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Gratis
      </span>
    );
  }
  if (access.method === "purchase_eligibility") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
        <BadgeCheck className="h-3 w-3" /> Sudah dibeli
      </span>
    );
  }
  if (access.unlocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Sudah terbuka
      </span>
    );
  }
  const enough = typeof points === "number" && points >= access.cost;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
        !signedIn || !enough ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"
      }`}
    >
      {signedIn && enough ? <Coins className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      {access.cost} poin
    </span>
  );
}

export default function SpoilerSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookAuthor,
  isGenerating = false,
  access = null,
  points = null,
  signedIn = false,
}: SpoilerSelectorModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<SpoilerLevel>("no_spoiler");

  const selected = useMemo(() => {
    if (!access || !signedIn) return null;
    return access[selectedLevel] ?? null;
  }, [access, selectedLevel, signedIn]);

  if (!isOpen) return null;

  // Petunjuk di bawah tombol: apa yang akan terjadi bila dikonfirmasi.
  const confirmNote = (() => {
    const isFree = selectedLevel === "no_spoiler" || selectedLevel === "low";
    if (!signedIn && !isFree) return "Masuk dulu untuk membuka tingkat ini.";
    if (!selected) {
      if (isFree) return null;
      return "Syarat tingkat ini belum termuat. Muat ulang halaman lalu coba lagi.";
    }
    if (selected.method === "free") return null;
    if (selected.method === "purchase_eligibility") {
      return `Gratis — Anda sudah membeli ${selected.min_units} eksemplar atau lebih.`;
    }
    if (selected.unlocked) return "Gratis — tingkat ini sudah pernah Anda buka untuk buku ini.";
    if (points !== null && points < selected.cost) {
      return `Poin Anda ${points}. Kurang ${selected.cost - points} poin untuk tingkat ini.`;
    }
    return `${selected.cost} poin akan dipotong dari saldo Anda (${points ?? "?"} poin).`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Pilih Tingkat Spoiler
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 truncate">
              {bookTitle} — {bookAuthor}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Saldo (hanya bila sudah masuk) */}
        {signedIn && (
          <div className="px-5 pt-3 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-slate-600">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              Saldo poin: {points ?? "…"}
            </span>
            <Link href="/poin" className="font-semibold text-[#0052cc] hover:underline">
              Cara mendapat poin
            </Link>
          </div>
        )}

        {/* Options */}
        <div className="p-5 space-y-2.5 overflow-y-auto">
          {SPOILER_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selectedLevel === option.level;
            return (
              <button
                key={option.level}
                type="button"
                onClick={() => setSelectedLevel(option.level)}
                disabled={isGenerating}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer disabled:opacity-60 ${
                  active
                    ? "border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon className={`w-4 h-4 ${active ? "text-emerald-700" : "text-slate-500"}`} />
                  <span className="text-xs font-extrabold text-slate-900">{option.title}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${option.badgeColor}`}>
                    {option.badge}
                  </span>
                  <span className="ml-auto">
                    <AccessCostBadge
                      level={option.level}
                      access={access?.[option.level]}
                      points={points}
                      signedIn={signedIn}
                    />
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="p-5 bg-slate-50 border-t border-slate-100">
          {confirmNote && (
            <p className="mb-3 text-[11px] text-slate-500">{confirmNote}</p>
          )}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={() => onConfirm(selectedLevel)}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-700/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>Generate Review</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
