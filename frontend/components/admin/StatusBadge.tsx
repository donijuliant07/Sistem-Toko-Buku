import React from "react"
import { OrderStatus, ProductStatus, PromoStatus } from "@/types"

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "Menunggu Pembayaran":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--warning-soft)] text-[var(--warning)] border border-[#B45309]/20">
          Menunggu Pembayaran
        </span>
      )
    case "Diproses":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--info-soft)] text-[var(--info)] border border-[#2A7F86]/20">
          Diproses
        </span>
      )
    case "Dikirim":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--shipped-soft)] text-[var(--shipped)] border border-[#5B5FA8]/20">
          Dikirim
        </span>
      )
    case "Selesai":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--success-soft)] text-[var(--success)] border border-[#2E7D4F]/20">
          Selesai
        </span>
      )
    case "Batal":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--danger-soft)] text-[var(--danger)] border border-[#C0392B]/20">
          Batal
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
          {status}
        </span>
      )
  }
}

export function ProductStatusBadge({ status, stock }: { status: ProductStatus; stock?: number }) {
  if (stock !== undefined && stock <= 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--danger)] text-white">
        Habis
      </span>
    )
  }
  if (stock !== undefined && stock <= 5) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--warning-soft)] text-[var(--warning)] border border-[#B45309]/20">
        Kritis ({stock})
      </span>
    )
  }

  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--success-soft)] text-[var(--success)]">
          Aktif
        </span>
      )
    case "Draft":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
          Draft
        </span>
      )
    case "Habis":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--danger-soft)] text-[var(--danger)]">
          Habis
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--muted-foreground)] border border-[var(--border)]">
          {status}
        </span>
      )
  }
}

export function PromoStatusBadge({ status }: { status: PromoStatus }) {
  switch (status) {
    case "Aktif":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--success-soft)] text-[var(--success)]">
          Aktif
        </span>
      )
    case "Jadwal":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
          Jadwal
        </span>
      )
    case "Kadaluarsa":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-[var(--muted-foreground)]">
          Kadaluarsa
        </span>
      )
  }
}

