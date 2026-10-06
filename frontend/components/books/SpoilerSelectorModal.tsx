"use client";

import React, { useState } from "react";
import { Sparkles, X, ShieldAlert, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";
import { SpoilerLevel } from "@/lib/types";

interface SpoilerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (level: SpoilerLevel) => void;
  bookTitle: string;
  bookAuthor: string;
  isGenerating?: boolean;
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

export default function SpoilerSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  bookTitle,
  bookAuthor,
  isGenerating = false,
}: SpoilerSelectorModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<SpoilerLevel>("no_spoiler");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-800 to-teal-900 text-white relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-amber-300 text-xs font-extrabold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>✨ AI Book Review</span>
          </div>
          <h2 id="modal-title" className="text-xl font-extrabold tracking-tight">
            Pilih Tingkat Spoiler
          </h2>
          <p className="text-xs text-emerald-100/90 mt-1 line-clamp-1">
            Buku: <span className="font-bold text-white">{bookTitle}</span> oleh {bookAuthor}
          </p>
        </div>

        {/* Content Options */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {SPOILER_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedLevel === opt.level;

            return (
              <label
                key={opt.level}
                className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/20"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="spoiler_level"
                  value={opt.level}
                  checked={isSelected}
                  onChange={() => setSelectedLevel(opt.level)}
                  disabled={isGenerating}
                  className="mt-1 accent-emerald-600 w-4 h-4 cursor-pointer"
                />

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Icon className="w-4 h-4 text-slate-600" />
                      {opt.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${opt.badgeColor}`}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Footer Action */}
        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
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
            <Sparkles className="w-4 h-4" />
            <span>Generate Review</span>
          </button>
        </div>
      </div>
    </div>
  );
}
