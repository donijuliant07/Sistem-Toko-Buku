import React from "react"
import { Badge } from "@/components/ui/badge"
import { OrderStatus, ProductStatus, PromoStatus } from "@/types"

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "Menunggu Pembayaran":
      return (
        <Badge variant="warning" className="font-medium">
          Menunggu Pembayaran
        </Badge>
      )
    case "Diproses":
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
          Diproses
        </Badge>
      )
    case "Dikirim":
      return (
        <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700 font-medium">
          Dikirim
        </Badge>
      )
    case "Selesai":
      return (
        <Badge variant="success" className="font-medium">
          Selesai
        </Badge>
      )
    case "Batal":
      return (
        <Badge variant="destructive" className="font-medium">
          Batal
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function ProductStatusBadge({ status, stock }: { status: ProductStatus; stock?: number }) {
  if (stock !== undefined && stock <= 0) {
    return <Badge variant="destructive">Habis</Badge>
  }
  if (stock !== undefined && stock <= 5) {
    return (
      <Badge variant="warning" className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200">
        Kritis ({stock})
      </Badge>
    )
  }

  switch (status) {
    case "Aktif":
      return <Badge variant="success">Aktif</Badge>
    case "Draft":
      return <Badge variant="secondary">Draft</Badge>
    case "Habis":
      return <Badge variant="destructive">Habis</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function PromoStatusBadge({ status }: { status: PromoStatus }) {
  switch (status) {
    case "Aktif":
      return <Badge variant="success">Aktif</Badge>
    case "Jadwal":
      return <Badge variant="secondary">Jadwal</Badge>
    case "Kadaluarsa":
      return <Badge variant="outline" className="text-slate-400">Kadaluarsa</Badge>
  }
}
