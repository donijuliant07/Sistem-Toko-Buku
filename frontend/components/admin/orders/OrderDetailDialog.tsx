"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/StatusBadge"
import { Order, OrderStatus } from "@/types"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import { Printer, Truck, MapPin, CreditCard, Clock, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface OrderDetailDialogProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdate: (orderId: string, status: OrderStatus) => void
}

export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onStatusUpdate,
}: OrderDetailDialogProps) {
  if (!order) return null

  const handlePrint = () => {
    toast.info(`Mencetak invoice resmi ${order.orderNumber}...`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white border border-zinc-200/80 text-zinc-900 shadow-xl">
        <DialogHeader className="border-b border-zinc-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-zinc-900">
                Detail Pesanan #{order.orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Dibuat pada {formatTanggalJam(order.createdAt)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5 text-zinc-500" />
                <span>Cetak Invoice</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2 text-xs">
          {/* Ringkasan Informasi Pelanggan & Pengiriman */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info Pelanggan */}
            <div className="rounded-xl border border-zinc-200/80 p-3.5 bg-zinc-50/70">
              <div className="flex items-center gap-2 font-semibold text-zinc-900 mb-2">
                <MapPin className="h-4 w-4 text-zinc-600" />
                <span>Penerima & Alamat Kirim</span>
              </div>
              <p className="font-bold text-zinc-900">{order.customerName}</p>
              <p className="text-zinc-500 mt-0.5">{order.customerPhone} • {order.customerEmail}</p>
              <p className="mt-1.5 text-zinc-600 leading-relaxed">
                {order.shippingAddress}
              </p>
            </div>

            {/* Info Ekspedisi & Pembayaran */}
            <div className="rounded-xl border border-zinc-200/80 p-3.5 bg-zinc-50/70">
              <div className="flex items-center gap-2 font-semibold text-zinc-900 mb-2">
                <Truck className="h-4 w-4 text-zinc-600" />
                <span>Logistik & Pembayaran</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Kurir:</span>
                  <span className="font-semibold text-zinc-800">{order.courier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">No. Resi:</span>
                  <span className="font-mono text-zinc-900 font-bold">
                    {order.trackingNumber || "Belum ada resi"}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-zinc-200/80">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Metode:
                  </span>
                  <span className="font-semibold text-zinc-800">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">Pembayaran:</span>
                  <PaymentStatusBadge status={order.paymentStatus} />
                </div>
              </div>
            </div>
          </div>

          {/* Daftar Produk yang Dibeli */}
          <div>
            <h4 className="font-semibold text-zinc-900 mb-2">
              Daftar Buku & Item ({order.items.length})
            </h4>
            <div className="rounded-xl border border-zinc-200/80 overflow-hidden divide-y divide-zinc-100 bg-white">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-12 w-9 rounded-lg bg-zinc-100 overflow-hidden shrink-0 border border-zinc-200/80">
                      {item.coverUrl && (
                        <Image src={item.coverUrl} alt={item.productTitle} fill className="object-cover" unoptimized />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 line-clamp-1">
                        {item.productTitle}
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-0.5">
                        {formatRupiah(item.unitPrice)} × {item.quantity} unit
                      </p>
                    </div>
                  </div>
                  <div className="font-bold text-zinc-900 tabular-nums shrink-0">
                    {formatRupiah(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rincian Tagihan */}
          <div className="rounded-xl bg-zinc-50/70 p-3.5 space-y-1.5 border border-zinc-200/80">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal Produk</span>
              <span className="tabular-nums font-medium text-zinc-800">{formatRupiah(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Ongkos Kirim</span>
              <span className="tabular-nums font-medium text-zinc-800">{formatRupiah(order.shippingFee)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Potongan Promo Voucher</span>
                <span className="tabular-nums">-{formatRupiah(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-zinc-900 pt-2 border-t border-zinc-200/80">
              <span>Total Pembayaran</span>
              <span className="text-zinc-900 tabular-nums">{formatRupiah(order.totalAmount)}</span>
            </div>
          </div>

          {/* Timeline Status */}
          <div>
            <h4 className="font-semibold text-zinc-900 mb-2.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              <span>Riwayat & Timeline Pesanan</span>
            </h4>
            <div className="space-y-3.5 border-l-2 border-zinc-900 ml-2 pl-3.5">
              {order.timeline.map((t, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-zinc-900 ring-4 ring-white" />
                  <p className="font-semibold text-zinc-900">{t.description}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{formatTanggalJam(t.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Verifikasi Pembayaran */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <span className="text-zinc-500 mr-auto">
              Pembayaran diverifikasi lewat bukti transfer di halaman verifikasi:
            </span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
              asChild
            >
              <Link href="/admin/pembayaran">
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Buka Verifikasi Pembayaran
              </Link>
            </Button>
          </div>

          {/* Tombol Aksi Cepat Ubah Status */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-zinc-100">
            <span className="text-zinc-500 mr-auto">Ubah status pesanan:</span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
              onClick={() => onStatusUpdate(order.id, "Diproses")}
              disabled={order.status === "Diproses"}
            >
              Set Diproses
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 cursor-pointer"
              onClick={() => onStatusUpdate(order.id, "Dikirim")}
              disabled={order.status === "Dikirim"}
            >
              Set Dikirim
            </Button>
            <Button
              size="sm"
              className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl shadow-xs font-medium cursor-pointer"
              onClick={() => onStatusUpdate(order.id, "Selesai")}
              disabled={order.status === "Selesai" || order.paymentStatus !== "Lunas"}
              title={
                order.paymentStatus === "Lunas"
                  ? undefined
                  : "Konfirmasi pembayaran terlebih dahulu"
              }
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Tandai Selesai
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
