"use client";

import React, { useId, useMemo, useState } from "react";
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
  LoaderCircle,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { SpoilerLevel } from "@/lib/types";
import type { SpoilerAccess } from "@/lib/types";
import ReadrLogo from "@/components/ReadrLogo";

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
  /** Nama tingkat apa adanya dari catatan API. */
  name: string;
  /** Kalimat pendek: apa yang akan kamu temui. */
  summary: string;
  warning: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  /** Warna meter eksposur saat terpilih. */
  meterClass: string;
  meterColor: string;
  /** Warna ikon saat kartu terpilih. */
  iconColor: string;
  /**
   * Palet sistem Apple (systemGreen/Blue/Orange/Red), tidak memakai token
   * merek toko supaya blok Ulasan AI terbaca sebagai modul Apple tersendiri.
   * Versi mentahnya (`#34C759`, `#FF9500`, `#FF3B30`) terlalu terang untuk
   * teks/ikon kecil — yang dipakai di sini varian gelapnya.
   * Semua pasangan teks di sini sudah diukur ≥ 4.5:1.
   */
  chipBg: string;
  chipInk: string;
  toastTone: string;
  toastInk: string;
}[] = [
  {
    level: "no_spoiler",
    name: "Tanpa Spoiler",
    summary: "Sangat aman",
    warning: "Tanpa spoiler",
    icon: ShieldCheck,
    description:
      "Aman dibaca sebelum membeli atau membaca buku. Membahas genre, gaya penulisan, suasana, kelebihan, dan target pembaca tanpa membuka plot cerita.",
    meterClass: "from-[#34C759] to-[#1E7B34]",
    meterColor: "#1E7B34",
    iconColor: "text-[#1B7A34]",
    chipBg: "bg-[#E8F7EC]",
    chipInk: "text-[#1B7A34]",
    toastTone: "border-[#B7E6C4] bg-[#F2FBF4]",
    toastInk: "text-[#1B7A34]",
  },
  {
    level: "low",
    name: "Spoiler Rendah",
    summary: "Aman",
    warning: "Premis awal saja",
    icon: CheckCircle2,
    description:
      "Mengandung informasi premis dan konflik awal cerita. Tidak membocorkan plot twist utama maupun penyelesaian akhir.",
    meterClass: "from-[#0A84FF] to-[#0058B0]",
    meterColor: "#0058B0",
    iconColor: "text-[#0058B0]",
    chipBg: "bg-[#EAF2FF]",
    chipInk: "text-[#0058B0]",
    toastTone: "border-[#B9D4FA] bg-[#F4F8FF]",
    toastInk: "text-[#0058B0]",
  },
  {
    level: "medium",
    name: "Spoiler Medium",
    summary: "Peringatan",
    warning: "Klimaks tengah cerita",
    icon: AlertTriangle,
    description:
      "Mengandung beberapa spoiler penting, dinamika relasi karakter, dan klimaks tengah cerita.",
    meterClass: "from-[#FFB800] to-[#E07800]",
    meterColor: "#B25000",
    iconColor: "text-[#B25000]",
    chipBg: "bg-[#FFF4E0]",
    chipInk: "text-[#B25000]",
    toastTone: "border-[#FBD79A] bg-[#FFFAF0]",
    toastInk: "text-[#B25000]",
  },
  {
    level: "heavy",
    name: "Spoiler Berat",
    summary: "Spoiler utama",
    warning: "Twist & ending dibuka",
    icon: ShieldAlert,
    description:
      "Ulasan lengkap termasuk plot twist, konflik puncak, kematian karakter, hingga analisis bab penutup (ending).",
    meterClass: "from-[#FF453A] to-[#C10015]",
    meterColor: "#C10015",
    iconColor: "text-[#C10015]",
    chipBg: "bg-[#FFEBEC]",
    chipInk: "text-[#C10015]",
    toastTone: "border-[#F9BFC2] bg-[#FFF5F5]",
    toastInk: "text-[#C10015]",
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
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          free
            ? "bg-[#E8F7EC] text-[#1B7A34]"
            : "bg-[#F5F5F7] text-[#6E6E73]"
        }`}
      >
        {free ? <CheckCircle2 className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {free ? "Gratis" : signedIn ? "Memuat…" : "Perlu masuk"}
      </span>
    );
  }
  if (access.method === "free") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F7EC] px-2 py-0.5 text-[10px] font-semibold text-[#1B7A34]">
        <CheckCircle2 className="h-3 w-3" /> Gratis
      </span>
    );
  }
  if (access.method === "purchase_eligibility") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF2FF] px-2 py-0.5 text-[10px] font-semibold text-[#0058B0]">
        <BadgeCheck className="h-3 w-3" /> Sudah dibeli
      </span>
    );
  }
  if (access.unlocked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F7EC] px-2 py-0.5 text-[10px] font-semibold text-[#1B7A34]">
        <CheckCircle2 className="h-3 w-3" /> Sudah terbuka
      </span>
    );
  }
  const enough = typeof points === "number" && points >= access.cost;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        !signedIn || !enough
          ? "bg-[#F5F5F7] text-[#6E6E73]"
          : "bg-[#FFF4E0] text-[#B25000]"
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
  const groupName = useId();
  const [selectedLevel, setSelectedLevel] = useState<SpoilerLevel>("no_spoiler");

  const selected = useMemo(() => {
    if (!access || !signedIn) return null;
    return access[selectedLevel] ?? null;
  }, [access, selectedLevel, signedIn]);

  const option = SPOILER_OPTIONS.find((o) => o.level === selectedLevel) ?? SPOILER_OPTIONS[0];
  const optionIndex = SPOILER_OPTIONS.indexOf(option);

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
      return `Gratis — Anda sudah membeli ${selected.min_units} buku atau lebih.`;
    }
    if (selected.unlocked) return "Gratis — tingkat ini sudah pernah Anda buka untuk buku ini.";
    if (points !== null && points < selected.cost) {
      return `Poin Anda ${points}. Kurang ${selected.cost - points} poin untuk tingkat ini.`;
    }
    return `${selected.cost} poin akan dipotong dari saldo Anda (${points ?? "?"} poin).`;
  })();

  if (!isOpen) return null;

  const showered = isGenerating ? option : null;
  const Icon = showered?.icon ?? BookOpen;
  const toastLabel = showered ? showered.name : "Ditunda";
  const toastWarning = showered ? showered.warning : "Ulasan belum sedang disusun.";

  // Keyframes lokal: proyek tidak memuat tw-animate-css, jadi `animate-in`
  // tidak pernah menghasilkan aturan apa pun.
  const keyframes = (
    <style jsx>{`
      @keyframes spoiler-fade {
        from {
          opacity: 0;
        }
      }
      @keyframes spoiler-pop {
        from {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }
    `}</style>
  );

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-[var(--foreground)]/55 p-4 backdrop-blur-sm motion-safe:animate-[spoiler-fade_180ms_var(--ease-out,ease-out)] sm:p-6"
      onClick={isGenerating ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${groupName}-title`}
      aria-busy={isGenerating}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl ring-1 ring-[#E5E5EA] motion-safe:animate-[spoiler-pop_220ms_var(--ease-out,ease-out)]"
        style={{ fontFamily: "var(--font-jakarta)" }}
        onClick={(event) => event.stopPropagation()}
      >
        {keyframes}

        {/* Header: Readr, judul, konteks buku, dan poin */}
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E5EA] px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#248A3D]">
              <ReadrLogo size="sm" showText={false} />
              Ulasan AI Readr
            </span>
            <h2
              id={`${groupName}-title`}
              className="mt-2 text-[24px] leading-[1.15] font-extrabold tracking-[-0.03em] text-[#1D1D1F]"
            >
              Pilih Tingkat Spoiler
            </h2>
            <p className="mt-1 flex min-w-0 items-baseline gap-1.5 text-xs text-[#6E6E73]">
              <span className="truncate font-semibold text-[#1D1D1F]/80" title={bookTitle}>
                {bookTitle}
              </span>
              {bookAuthor && <span aria-hidden="true">·</span>}
              {bookAuthor && <span className="truncate">{bookAuthor}</span>}
            </p>
            <Link
              href="/poin"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071E3] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Cara mendapat poin
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold tabular-nums whitespace-nowrap text-[#1D1D1F] ring-1 ring-[#E5E5EA]"
              title="Saldo poin"
            >
              <Coins className="h-3.5 w-3.5 text-[#B25000]" aria-hidden="true" />
              {points !== null ? `${points} poin` : <span className="max-sm:hidden">Poin —</span>}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              aria-label="Tutup"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#6E6E73] transition-[background-color,color,transform] duration-150 hover:bg-[#E5E5EA] hover:text-[#1D1D1F] active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Meter eksposur: empat tingkat adalah urutan, jadi skalanya dimeterkan */}
        <div className="px-5 pt-4 sm:px-6">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.01em] text-[#6E6E73]">
            <span>Aman dibaca</span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-[#C10015]" aria-hidden="true" />
              Twist dibuka
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-4 gap-1" aria-hidden="true">
            {SPOILER_OPTIONS.map((o, i) =>
              i <= optionIndex ? (
                <span
                  key={o.level}
                  className={`h-1.5 rounded-full bg-gradient-to-r transition-opacity duration-300 ${o.meterClass}`}
                />
              ) : (
                <span
                  key={o.level}
                  className="h-1.5 rounded-full bg-[#E5E5EA] transition-opacity duration-300"
                />
              ),
            )}
          </div>
        </div>

        {/* Daftar tingkat — radio native agar panah atas/bawah langsung berpindah */}
        <fieldset className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <legend className="sr-only">Tingkat spoiler ulasan</legend>
          <div className="space-y-2">
            {SPOILER_OPTIONS.map((o) => {
              const checked = selectedLevel === o.level;
              const OptionIcon = o.icon;
              const detailId = `${groupName}-${o.level}-detail`;
              return (
                <label
                  key={o.level}
                  className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-[border-color,background-color,box-shadow] duration-150 has-focus-visible:ring-2 has-focus-visible:ring-[var(--ring)] has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-[var(--surface)] ${
                    checked
                      ? "border-[#0071E3] bg-[#F5F9FF] shadow-[0_0_0_1px_#0071E3]"
                      : "border-[#E5E5EA] hover:border-[#C7C7CC] hover:bg-[#FAFAFC]"
                  }`}
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={o.level}
                    checked={checked}
                    onChange={() => setSelectedLevel(o.level)}
                    aria-describedby={detailId}
                    disabled={isGenerating}
                    className="sr-only"
                  />

                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-transform duration-150 group-hover:scale-105 ${o.chipBg} ${o.iconColor}`}
                  >
                    <OptionIcon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className="text-[13px] font-bold tracking-[-0.01em] text-[#1D1D1F]"
                      >
                        {o.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ${o.chipBg} ${o.chipInk}`}
                      >
                        {o.summary}
                      </span>
                      <span className="ml-auto">
                        <AccessCostBadge
                          level={o.level}
                          access={access?.[o.level]}
                          points={points}
                          signedIn={signedIn}
                        />
                      </span>
                    </span>
                    <span
                      id={detailId}
                      className="mt-1 block text-[11.5px] leading-[1.6] text-[#6E6E73]"
                    >
                      {o.description}
                    </span>
                  </span>

                  {/* Indikator terpilih: centang muncul dengan satu gerakan */}
                  <span
                    aria-hidden="true"
                    className={`absolute -right-px -top-px flex h-5 w-5 items-center justify-center rounded-bl-xl rounded-tr-2xl transition-[opacity,transform,background-color] duration-200 ${
                      checked
                        ? "bg-[#0071E3] opacity-100 scale-100"
                        : "bg-transparent opacity-0 scale-75"
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3 text-white" strokeWidth={3} />
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Footer: status (bila sedang menyusun) + aksi */}
        <div className="border-t border-[#E5E5EA] bg-[#F5F5F7] px-5 pb-5 pt-4 sm:px-6">
          {isGenerating ? (
            <div
              className={`mb-3 flex items-center gap-2.5 rounded-xl border bg-[var(--surface)] px-3 py-2 ${option.toastTone}`}
              role="status"
              aria-live="polite"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${option.chipBg} ${option.iconColor}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[11px] font-semibold ${option.toastInk}`}>
                  Menyusun {toastLabel}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-[#6E6E73]">
                  {toastWarning}
                </span>
              </span>
              <LoaderCircle
                className="h-3.5 w-3.5 shrink-0 animate-spin text-[#6E6E73]"
                aria-hidden="true"
              />
            </div>
          ) : (
            confirmNote && (
              <p className="mb-3 text-[11px] leading-relaxed text-[#6E6E73]">
                {confirmNote}
              </p>
            )
          )}

          <div className="flex items-center justify-end gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="rounded-xl px-4 py-2.5 text-center text-xs font-semibold text-[#6E6E73] transition-[background-color,color] duration-150 hover:bg-white hover:text-[#1D1D1F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={() => onConfirm(selectedLevel)}
              disabled={isGenerating}
              className="group/cta relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#0071E3] px-5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#0071E3]/25 transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#0064C8] hover:shadow-md active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles
                  className="h-4 w-4 text-white transition-transform duration-300 group-hover/cta:-rotate-12 group-hover/cta:scale-110"
                  aria-hidden="true"
                />
              )}
              <span>{isGenerating ? "Menyusun ulasan…" : "Buat ulasan"}</span>
              {!isGenerating && (
                <ArrowRight
                  className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-200 group-hover/cta:translate-x-0 group-hover/cta:opacity-100"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
