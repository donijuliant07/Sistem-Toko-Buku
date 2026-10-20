import React from "react"
import { OrderPaymentStatus, OrderStatus, ProductStatus } from "@/types"
import type { PromoStatus } from "@/lib/types"

/** Status baris `payments`, terpisah dari status pesanan. */
export function PaymentStatusBadge({ status }: { status: OrderPaymentStatus }) {
  const styles: Record<OrderPaymentStatus, string> = {
    "Belum Dibayar": "bg-amber-50 text-amber-800 border-amber-300/80",
    Lunas: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    Gagal: "bg-rose-50 text-rose-700 border-rose-200/60",
    Kedaluwarsa: "bg-zinc-100 text-zinc-600 border-zinc-200/60",
    Dikembalikan: "bg-sky-50 text-sky-700 border-sky-200/60",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] ?? styles["Belum Dibayar"]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
      {status}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "Menunggu Pembayaran":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/80 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
          Menunggu Pembayaran
        </span>
      )
    case "Dibayar":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          Dibayar
        </span>
      )
    case "Diproses":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          Diproses
        </span>
      )
    case "Dikirim":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          Dikirim
        </span>
      )
    case "Selesai":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Selesai
        </span>
      )
    case "Batal":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          Batal
        </span>
      )
    case "Kedaluwarsa":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          Kedaluwarsa
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          {status}
        </span>
      )
  }
}

export function ProductStatusBadge({ status, stock }: { status: ProductStatus; stock?: number }) {
  if (stock !== undefined && stock <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        Habis
      </span>
    )
  }
  if (stock !== undefined && stock <= 5) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        Kritis ({stock})
      </span>
    )
  }

  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Aktif
        </span>
      )
    case "Draft":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          Draft
        </span>
      )
    case "Habis":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          Habis
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          {status}
        </span>
      )
  }
}

export function PromoStatusBadge({ status }: { status: PromoStatus }) {
  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Aktif
        </span>
      )
    case "Jadwal":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
          Jadwal
        </span>
      )
    case "Kadaluarsa":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          Kadaluarsa
        </span>
      )
    case "Nonaktif":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-500 border border-zinc-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
          Nonaktif
        </span>
      )
  }
}

