"use client";

import React from "react";
import {
  Sparkles,
  BookOpen,
  Feather,
  Users,
  CheckCircle,
  XCircle,
  HelpCircle,
  Award,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { AIReviewResponse } from "@/lib/types";

interface AIReviewResultProps {
  review: AIReviewResponse;
  onReset: () => void;
}

export default function AIReviewResult({ review, onReset }: AIReviewResultProps) {
  const isHeavy = review.spoiler_level === "heavy";
  const isMedium = review.spoiler_level === "medium";

  const spoilerBadgeConfig = {
    no_spoiler: {
      label: "NO SPOILER",
      color: "bg-emerald-100 text-emerald-800 border-emerald-300",
      dot: "bg-emerald-500",
    },
    low: {
      label: "SPOILER RENDAH",
      color: "bg-blue-100 text-blue-800 border-blue-300",
      dot: "bg-blue-500",
    },
    medium: {
      label: "SPOILER MEDIUM",
      color: "bg-amber-100 text-amber-800 border-amber-300",
      dot: "bg-amber-500",
    },
    heavy: {
      label: "SPOILER BERAT",
      color: "bg-red-100 text-red-800 border-red-300",
      dot: "bg-red-500",
    },
  }[review.spoiler_level];

  return (
    <div className="mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-emerald-100 shadow-xl shadow-emerald-950/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Decorative Gradient Bar */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-400" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Book Review</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase border ${spoilerBadgeConfig.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${spoilerBadgeConfig.dot}`} />
              {spoilerBadgeConfig.label}
            </span>

            {review.cached && (
              <span className="text-[10px] font-medium text-slate-400">
                (Tersimpan di Cache)
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Analisis & Ulasan untuk &ldquo;{review.title}&rdquo;
          </h2>
          <p className="text-xs text-slate-500">
            Dihasilkan secara cerdas berdasarkan konteks resmi buku oleh {review.author}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ganti Spoiler Level</span>
        </button>
      </div>

      {/* Spoiler Warning Notice */}
      {(isMedium || isHeavy) && (
        <div
          className={`my-6 p-4 rounded-2xl border flex items-start gap-3 ${
            isHeavy
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider">
              {isHeavy ? "⚠️ Peringatan: Spoiler Berat" : "⚠️ Peringatan: Spoiler Medium"}
            </h4>
            <p className="text-xs leading-relaxed">
              {isHeavy
                ? "Review ini membahas alur cerita secara mendalam, termasuk plot twist, klimaks, dan analisis akhir (ending) buku."
                : "Review ini mengandung beberapa pembahasan cerita krusial di babak pertengahan."}
            </p>
          </div>
        </div>
      )}

      {/* Structured Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Overview */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h3>Overview</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {review.overview}
          </p>
        </div>

        {/* Writing Style */}
        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Feather className="w-4 h-4 text-teal-600" />
            <h3>Gaya Penulisan (Writing Style)</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {review.writing_style}
          </p>
        </div>

        {/* Characters */}
        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-2">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Users className="w-4 h-4 text-blue-600" />
            <h3>Karakter & Tokoh</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {review.characters}
          </p>
        </div>

        {/* Plot Analysis (for medium/heavy) */}
        {review.plot_analysis && (
          <div className="md:col-span-2 p-5 rounded-2xl bg-amber-50/40 border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <h3>Analisis Plot Cerita</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {review.plot_analysis}
            </p>
          </div>
        )}

        {/* Ending Analysis (for heavy) */}
        {review.ending_analysis && (
          <div className="md:col-span-2 p-5 rounded-2xl bg-red-50/40 border border-red-100 space-y-2">
            <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
              <Award className="w-4 h-4 text-red-600" />
              <h3>Analisis Bab Akhir (Ending Analysis)</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              {review.ending_analysis}
            </p>
          </div>
        )}

        {/* Strengths */}
        <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-100 space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <h3>Kelebihan (Strengths)</h3>
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
            {review.strengths.map((s, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Weaknesses */}
        <div className="p-5 rounded-2xl bg-rose-50/40 border border-rose-100 space-y-3">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
            <XCircle className="w-4 h-4 text-rose-500" />
            <h3>Kekurangan / Hal yang Perlu Diperhatikan</h3>
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
            {review.weaknesses.map((w, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-rose-400 font-bold mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Who Should Read This */}
        <div className="md:col-span-2 p-5 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-2">
          <div className="flex items-center gap-2 text-sky-900 font-bold text-sm">
            <HelpCircle className="w-4 h-4 text-sky-600" />
            <h3>Siapa yang Cocok Membaca Buku Ini?</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            {review.who_should_read}
          </p>
        </div>

        {/* Final Verdict */}
        <div className="md:col-span-2 p-6 rounded-2xl bg-gradient-to-r from-emerald-800 to-teal-900 text-white space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm uppercase tracking-wider">
            <Award className="w-4 h-4" />
            <h3>Kesimpulan & Rekomendasi (Verdict)</h3>
          </div>
          <p className="text-xs sm:text-sm text-emerald-50 leading-relaxed font-medium">
            {review.verdict}
          </p>
        </div>
      </div>
    </div>
  );
}
