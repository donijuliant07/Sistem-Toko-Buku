"use client"

import * as React from "react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { OrderStatusBadge } from "@/components/admin/StatusBadge"
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Detail Pesanan #{order.orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Dibuat pada {formatTanggalJam(order.createdAt)}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <OrderStatusBadge status={order.status} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Invoice</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2 text-xs">
          {/* Ringkasan Informasi Pelanggan & Pengiriman */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info Pelanggan */}
            <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span>Penerima & Alamat Kirim</span>
              </div>
              <p className="font-bold text-slate-900 dark:text-slate-100">{order.customerName}</p>
              <p className="text-slate-500">{order.customerPhone} • {order.customerEmail}</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
                {order.shippingAddress}
              </p>
            </div>

            {/* Info Ekspedisi & Pembayaran */}
            <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-2">
                <Truck className="h-4 w-4 text-amber-500" />
                <span>Logistik & Pembayaran</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kurir:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{order.courier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">No. Resi:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {order.trackingNumber || "Belum ada resi"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Metode:
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{order.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daftar Produk yang Dibeli */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Daftar Buku & Item ({order.items.length})
            </h4>
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-12 w-9 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0">
                      {item.coverUrl && (
                        <Image src={item.coverUrl} alt={item.productTitle} fill className="object-cover" unoptimized />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {item.productTitle}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        {formatRupiah(item.unitPrice)} × {item.quantity} eks
                      </p>
                    </div>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatRupiah(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rincian Tagihan */}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 space-y-1.5 border border-slate-200/60 dark:border-slate-800">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal Produk</span>
              <span>{formatRupiah(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Ongkos Kirim</span>
              <span>{formatRupiah(order.shippingFee)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Potongan Promo Voucher</span>
                <span>-{formatRupiah(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span>Total Pembayaran</span>
              <span className="text-blue-600 dark:text-blue-400">{formatRupiah(order.totalAmount)}</span>
            </div>
          </div>

          {/* Timeline Status */}
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Riwayat & Timeline Pesanan</span>
            </h4>
            <div className="space-y-3 border-l-2 border-blue-500 ml-2 pl-3">
              {order.timeline.map((t, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[19px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{t.description}</p>
                  <p className="text-[10px] text-slate-400">{formatTanggalJam(t.timestamp)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tombol Aksi Cepat Ubah Status */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 mr-auto">Ubah status pesanan:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusUpdate(order.id, "Diproses")}
              disabled={order.status === "Diproses"}
            >
              Set Diproses
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusUpdate(order.id, "Dikirim")}
              disabled={order.status === "Dikirim"}
            >
              Set Dikirim
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onStatusUpdate(order.id, "Selesai")}
              disabled={order.status === "Selesai"}
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
