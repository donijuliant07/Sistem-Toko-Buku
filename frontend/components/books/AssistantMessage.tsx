"use client";

import React from "react";
import { ThinkingState, type ThinkingStep } from "@/components/ui/thinking-state";

const defaultBookSteps: ThinkingStep[] = [
  {
    kind: "search",
    label: "Sumber harga ditemukan",
    activeLabel: "Menelusuri harga di marketplace",
    sources: [
      {
        label: "Tokopedia",
        href: "https://www.tokopedia.com",
        tooltip: "tokopedia.com",
        icon: (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs bg-[#42b549] text-[9px] font-black text-white">
            T
          </span>
        ),
      },
      {
        label: "Shopee",
        href: "https://shopee.co.id",
        tooltip: "shopee.co.id",
        icon: (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs bg-[#ee4d2d] text-[9px] font-black text-white">
            S
          </span>
        ),
      },
      {
        label: "Blibli",
        href: "https://www.blibli.com",
        tooltip: "blibli.com",
        icon: (
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-xs bg-[#0095da] text-[9px] font-black text-white">
            B
          </span>
        ),
      },
    ],
    moreSources: [
      {
        label: "Gramedia",
        href: "https://www.gramedia.com",
        tooltip: "gramedia.com",
      },
      {
        label: "Periplus",
        href: "https://www.periplus.com",
        tooltip: "periplus.com",
      },
      {
        label: "Lazada",
        href: "https://www.lazada.co.id",
        tooltip: "lazada.co.id",
      },
      {
        label: "Google Books",
        href: "https://books.google.co.id",
        tooltip: "books.google.co.id",
      },
    ],
  },
  {
    kind: "step",
    label: "Mengekstrak harga & verifikasi ketersediaan stok seller",
    activeLabel: "Mengekstrak harga & ketersediaan stok seller...",
  },
  {
    kind: "step",
    label: "Menghitung perbandingan harga toko & penawaran terbaik",
    activeLabel: "Menghitung selisih harga terbaik...",
  },
];

interface AssistantMessageProps {
  steps?: ThinkingStep[];
  bookTitle?: string;
  isDone?: boolean;
  onDone?: (seconds: number) => void;
  className?: string;
}

export function AssistantMessage({
  steps = defaultBookSteps,
  isDone,
  onDone = (seconds) => console.log(`Selesai dalam ${seconds} detik`),
  className = "",
}: AssistantMessageProps) {
  return (
    <ThinkingState
      steps={steps}
      thinkingLabel="Menganalisis harga buku"
      workedLabel="Diproses dalam"
      doneLabel="Selesai membandingkan harga"
      isDone={isDone}
      onDone={onDone}
      className={className}
    />
  );
}

export default AssistantMessage;
