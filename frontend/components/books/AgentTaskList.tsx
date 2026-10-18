"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Loader2,
  LucideIcon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  XCircle,
} from "lucide-react";

export type TaskStatus = "pending" | "running" | "completed" | "error";

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  category: "CATALOG" | "SEARCH" | "EXTRACT" | "VERIFY" | "ANALYSIS";
  status: TaskStatus;
  duration?: string;
}

interface AgentTaskListProps {
  bookTitle: string;
  isComparing: boolean;
  onAllCompleted?: () => void;
  collapsibleWhenDone?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  CATALOG: "bg-purple-50 text-purple-700 border-purple-200",
  SEARCH: "bg-blue-50 text-blue-700 border-blue-200",
  EXTRACT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  VERIFY: "bg-orange-50 text-orange-700 border-orange-200",
  ANALYSIS: "bg-sky-50 text-sky-700 border-sky-200",
};

export default function AgentTaskList({
  bookTitle,
  isComparing,
  onAllCompleted,
  collapsibleWhenDone = true,
}: AgentTaskListProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: "catalog",
      title: "Verifikasi Metadata & Harga Toko",
      description: `Membaca patokan harga dasar untuk "${bookTitle}"`,
      category: "CATALOG",
      status: "pending",
    },
    {
      id: "search",
      title: "Menghubungkan ke SERP API & Google Shopping",
      description: "Mengirim kueri pencarian multi-marketplace region Indonesia (gl=id)",
      category: "SEARCH",
      status: "pending",
    },
    {
      id: "extract",
      title: "Memindai Penawaran Tokopedia & Shopee",
      description: "Mengekstrak harga seller terpercaya & filter produk non-buku",
      category: "EXTRACT",
      status: "pending",
    },
    {
      id: "verify",
      title: "Mengecek Stok di Blibli, Bukalapak & Lazada",
      description: "Validasi ketersediaan stok riil dan tautan merchant langsung",
      category: "VERIFY",
      status: "pending",
    },
    {
      id: "analysis",
      title: "Kalkulasi Selisih Harga & Riwayat Tren",
      description: "Menghitung selisih hemat (savings) dan mengurutkan harga termurah",
      category: "ANALYSIS",
      status: "pending",
    },
  ]);

  const [isCollapsed, setIsCollapsed] = useState(false);

  // Micro-interaction simulation during fetch
  useEffect(() => {
    if (!isComparing) {
      // Tandai semua selesai jika isComparing selesai
      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          status: "completed",
          duration: t.duration || "0.4s",
        }))
      );
      return;
    }

    // Reset ke pending
    setIsCollapsed(false);
    setTasks([
      {
        id: "catalog",
        title: "Verifikasi Metadata & Harga Toko",
        description: `Membaca patokan harga dasar untuk "${bookTitle}"`,
        category: "CATALOG",
        status: "running",
      },
      {
        id: "search",
        title: "Menghubungkan ke SERP API & Google Shopping",
        description: "Mengirim kueri pencarian multi-marketplace region Indonesia (gl=id)",
        category: "SEARCH",
        status: "pending",
      },
      {
        id: "extract",
        title: "Memindai Penawaran Tokopedia & Shopee",
        description: "Mengekstrak harga seller terpercaya & filter produk non-buku",
        category: "EXTRACT",
        status: "pending",
      },
      {
        id: "verify",
        title: "Mengecek Stok di Blibli, Bukalapak & Lazada",
        description: "Validasi ketersediaan stok riil dan tautan merchant langsung",
        category: "VERIFY",
        status: "pending",
      },
      {
        id: "analysis",
        title: "Kalkulasi Selisih Harga & Riwayat Tren",
        description: "Menghitung selisih hemat (savings) dan mengurutkan harga termurah",
        category: "ANALYSIS",
        status: "pending",
      },
    ]);

    const t1 = setTimeout(() => {
      setTasks((prev) =>
        prev.map((t, idx) => {
          if (idx === 0) return { ...t, status: "completed", duration: "0.2s" };
          if (idx === 1) return { ...t, status: "running" };
          return t;
        })
      );
    }, 450);

    const t2 = setTimeout(() => {
      setTasks((prev) =>
        prev.map((t, idx) => {
          if (idx <= 1) return { ...t, status: "completed", duration: t.duration || "0.5s" };
          if (idx === 2) return { ...t, status: "running" };
          return t;
        })
      );
    }, 950);

    const t3 = setTimeout(() => {
      setTasks((prev) =>
        prev.map((t, idx) => {
          if (idx <= 2) return { ...t, status: "completed", duration: t.duration || "0.4s" };
          if (idx === 3) return { ...t, status: "running" };
          return t;
        })
      );
    }, 1500);

    const t4 = setTimeout(() => {
      setTasks((prev) =>
        prev.map((t, idx) => {
          if (idx <= 3) return { ...t, status: "completed", duration: t.duration || "0.3s" };
          if (idx === 4) return { ...t, status: "running" };
          return t;
        })
      );
    }, 2100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isComparing, bookTitle]);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);
  const isAllDone = completedCount === tasks.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs transition-all">
      {/* Header Task List (@kobra/task-list inspired) */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-gradient-to-r from-gray-50/90 via-white to-gray-50/50 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#0052cc]">
            {isComparing && !isAllDone ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-lg bg-blue-400 opacity-30" />
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </>
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-900 tracking-tight">
                Marketplace Price Agent
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.2 text-[9px] font-black text-[#0052cc] border border-blue-200">
                SERP API Engine
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              {isAllDone
                ? "Semua 5 tahapan perbandingan selesai"
                : `Memproses langkah ${completedCount + 1} dari ${tasks.length}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge persentase */}
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
              isAllDone
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-blue-50 text-[#0052cc] border border-blue-200"
            }`}
          >
            {progressPercent}%
          </span>

          {/* Toggle Collapse bila sudah selesai */}
          {collapsibleWhenDone && isAllDone && (
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title={isCollapsed ? "Buka detail langkah" : "Sembunyikan langkah"}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar animatif */}
      <div className="h-1 w-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out ${
            isAllDone ? "bg-emerald-500" : "bg-[#0052cc]"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Task List Items */}
      {!isCollapsed && (
        <ul className="divide-y divide-gray-100/80 p-2">
          {tasks.map((task) => {
            const isCompleted = task.status === "completed";
            const isRunning = task.status === "running";
            const isPending = task.status === "pending";
            const isError = task.status === "error";

            return (
              <li
                key={task.id}
                className={`flex items-start justify-between gap-3 rounded-xl p-2.5 transition-all ${
                  isRunning
                    ? "bg-blue-50/70 border border-blue-200/80 shadow-2xs"
                    : isCompleted
                    ? "bg-white hover:bg-gray-50/60"
                    : "bg-white opacity-45"
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 shrink-0">
                    {isCompleted ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    ) : isRunning ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#0052cc] border-t-transparent animate-spin" />
                    ) : isError ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white">
                        <XCircle className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300">
                        <Circle className="h-1.5 w-1.5 fill-gray-300 text-transparent" />
                      </div>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-xs font-bold leading-tight ${
                          isRunning
                            ? "text-[#0052cc]"
                            : isCompleted
                            ? "text-gray-800"
                            : "text-gray-500"
                        }`}
                      >
                        {task.title}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-black border uppercase tracking-wider ${
                          CATEGORY_COLORS[task.category] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {task.category}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 line-clamp-1 text-[11px] ${
                        isRunning ? "text-blue-900/70 font-medium" : "text-gray-400"
                      }`}
                    >
                      {task.description}
                    </p>
                  </div>
                </div>

                {/* Right Badge / Duration */}
                <div className="shrink-0 text-right">
                  {isCompleted && task.duration && (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-400">
                      <Clock className="h-2.5 w-2.5" />
                      {task.duration}
                    </span>
                  )}
                  {isRunning && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-[#0052cc]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#0052cc] animate-pulse" />
                      Memproses
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] font-medium text-gray-300">
                      Menunggu
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
