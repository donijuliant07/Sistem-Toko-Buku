"use client";

import React from "react";
import { ThinkingState, type ThinkingStep } from "@/components/ui/thinking-state";
import {
  MARKETS_QUICK_PICK,
  marketplaceLabel,
  marketplaceSources,
} from "@/components/books/marketplace-sources";

const defaultBookSteps: ThinkingStep[] = [
  {
    kind: "search",
    label: "Sumber harga ditemukan",
    activeLabel: `Menelusuri harga di ${MARKETS_QUICK_PICK.slice(0, 3).map((slug) => marketplaceLabel(slug)).join(", ")}`,
    sources: marketplaceSources(MARKETS_QUICK_PICK.slice(0, 3)),
    moreSources: marketplaceSources(MARKETS_QUICK_PICK.slice(3)),
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
