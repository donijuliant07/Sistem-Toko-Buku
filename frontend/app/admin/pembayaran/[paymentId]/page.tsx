"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  Package,
  User,
  XCircle,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { RejectPaymentDialog } from "@/components/admin/payments/RejectPaymentDialog"
import { PaymentViewBadge } from "@/components/payment/PaymentViewBadge"
import { ProofPreview } from "@/components/payment/ProofPreview"
import { paymentService } from "@/lib/services"
import { formatRupiah, formatTanggalJam } from "@/lib/utils"
import { toast } from "sonner"
import type { PaymentDetail } from "@/lib/types"

const PROOF_STATUS_LABELS: Record<string, string> = {
  pending: "Menunggu verifikasi",
  approved: "Disetujui",
  rejected: "Ditolak",
  superseded: "Diganti bukti baru",
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[11px] text-zinc-500">{label}</span>
      <span className="min-w-0 break-words text-xs font-medium text-zinc-900 text-right">{value ?? "—"}</span>
    </div>
  )
}

export default function AdminPaymentDetailPage() {
  const params = useParams()
  const paymentId = params?.paymentId as string

  const [detail, setDetail] = React.useState<PaymentDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState("")

  const [approveOpen, setApproveOpen] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [deciding, setDeciding] = React.useState(false)

  const load = React.useCallback(() => {
    if (!paymentId) return () => {}
    let active = true
    setLoading(true)
    paymentService
      .getById(paymentId)
      .then((data) => {
        if (!active) return
        setDetail(data)
        setError("")
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Pembayaran gagal dimuat.")
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [paymentId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- skeleton saat id berubah
  React.useEffect(load, [load])

  const handleApprove = async () => {
    if (!detail) return
    setDeciding(true)
    try {
      await paymentService.approve(detail.payment.id)
      toast.success("Pembayaran disetujui dan ditandai lunas.")
      load()
    } catch (e) {
      // Pesan backend (409/503) ditampilkan apa adanya: keputusan mungkin
      // sudah diambil admin lain, atau migrasi belum dijalankan.
      toast.error(e instanceof Error ? e.message : "Gagal menyetujui pembayaran.")
    } finally {
      setDeciding(false)
    }
  }

  const handleReject = async (reason: string) => {
    if (!detail) return
    setDeciding(true)
    try {
      await paymentService.reject(detail.payment.id, reason)
      toast.success("Bukti pembayaran ditolak. Pelanggan dapat mengunggah ulang.")
      setRejectOpen(false)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menolak pembayaran.")
    } finally {
      setDeciding(false)
    }
  }

  if (loading && !detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Detail Pembayaran" />
        <Card className="border-zinc-200/80">
          <CardContent className="p-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <PageHeader title="Detail Pembayaran" />
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-8 text-center">
            <XCircle className="mx-auto h-7 w-7 text-rose-500" />
            <p className="mt-2 text-sm font-semibold text-rose-800">
              {error || "Pembayaran tidak ditemukan."}
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/admin/pembayaran">Kembali ke daftar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { payment, order, buyer } = detail
  const canDecide = payment.status === "under_review"
  const history = [...payment.history].reverse()

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2 text-xs text-zinc-500" asChild>
          <Link href="/admin/pembayaran">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Daftar verifikasi
          </Link>
        </Button>
        <PageHeader
          title={order.order_number ?? "Detail Pembayaran"}
          description={`Dibuat ${formatTanggalJam(order.created_at)} · Pesanan berstatus ${order.status}`}
          action={<PaymentViewBadge status={payment.status} />}
        />
      </div>

      {!canDecide && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          {payment.status === "paid"
            ? "Pembayaran ini sudah disetujui; tidak ada keputusan yang menunggu."
            : payment.status === "rejected"
              ? "Bukti terakhir sudah ditolak. Menunggu pelanggan mengunggah ulang bukti."
              : "Tidak ada bukti yang menunggu verifikasi untuk pembayaran ini."}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Ringkasan pesanan — total dari server, bukan dari klien. */}
        <Card className="border-zinc-200/80 shadow-xs lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Package className="h-4 w-4 text-zinc-400" />
              Ringkasan Pembelian
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="divide-y divide-zinc-100">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-900">{item.title ?? "Buku"}</p>
                    <p className="text-[11px] text-zinc-500">
                      {item.quantity} × {formatRupiah(item.unit_price)}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">
                    {formatRupiah(item.total_price)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2">
              <InfoRow label="Subtotal" value={formatRupiah(order.subtotal)} />
              <InfoRow label="Ongkos kirim" value={formatRupiah(order.shipping_fee)} />
              {order.discount_amount > 0 && (
                <InfoRow label="Diskon" value={`-${formatRupiah(order.discount_amount)}`} />
              )}
              <InfoRow
                label="Total pesanan"
                value={<span className="font-bold">{formatRupiah(order.total_amount)}</span>}
              />
              <InfoRow
                label="Nominal yang harus dibayar"
                value={
                  <span
                    className={
                      Math.abs(payment.amount - order.total_amount) > 0.005
                        ? "font-bold text-rose-600"
                        : "font-bold text-zinc-900"
                    }
                  >
                    {formatRupiah(payment.amount)}
                  </span>
                }
              />
              <InfoRow label="Alamat kirim" value={order.shipping_address} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <User className="h-4 w-4 text-zinc-400" />
              Pembeli
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-2">
            <InfoRow label="Nama" value={buyer.name ?? order.customer_name} />
            <InfoRow label="Email" value={buyer.email ?? order.customer_email} />
            <InfoRow label="Telepon" value={buyer.phone ?? order.customer_phone} />
            <div className="mt-3 border-t border-zinc-100 pt-3">
              <InfoRow
                label="Metode"
                value={
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-zinc-400" />
                    {payment.payment_method ?? "—"}
                  </span>
                }
              />
              <InfoRow
                label="Diverifikasi"
                value={payment.verified_at ? formatTanggalJam(payment.verified_at) : "Belum"}
              />
              {payment.rejection_reason && (
                <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  Alasan tolak terakhir: {payment.rejection_reason}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-zinc-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-zinc-900">Bukti Pembayaran Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {payment.current_proof ? (
              <>
                <ProofPreview proof={payment.current_proof} />
                <div className="mt-3 space-y-1">
                  <InfoRow label="Status bukti" value={PROOF_STATUS_LABELS[payment.current_proof.status] ?? payment.current_proof.status} />
                  <InfoRow label="Nama berkas" value={payment.current_proof.original_filename ?? "—"} />
                  <InfoRow label="Ukuran" value={`${Math.max(1, Math.round(payment.current_proof.file_size / 1024))} KB`} />
                  <InfoRow label="Diunggah" value={formatTanggalJam(payment.current_proof.uploaded_at)} />
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-zinc-500">Belum ada bukti yang diunggah.</p>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                className="flex-1"
                disabled={!canDecide || deciding}
                onClick={() => setApproveOpen(true)}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Setujui pembayaran
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={!canDecide || deciding}
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Tolak bukti
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <History className="h-4 w-4 text-zinc-400" />
              Riwayat Bukti
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {history.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">Belum ada riwayat.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((proof) => (
                  <li key={proof.id} className="rounded-xl border border-zinc-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-zinc-800">
                        {PROOF_STATUS_LABELS[proof.status] ?? proof.status}
                      </p>
                      <p className="text-[11px] text-zinc-500">{formatTanggalJam(proof.uploaded_at)}</p>
                    </div>
                    <div className="mt-2 max-w-[220px]">
                      <ProofPreview proof={proof} />
                    </div>
                    {proof.review_note && (
                      <p className="mt-2 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[11px] text-zinc-600">
                        Catatan: {proof.review_note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Setujui pembayaran ini?"
        description={`${order.order_number ?? "Pesanan"} sebesar ${formatRupiah(payment.amount)} akan ditandai lunas. Pastikan nominal dan penerima transfer sudah cocok — keputusan ini tercatat di audit log.`}
        confirmText="Ya, setujui"
        cancelText="Batal"
        variant="default"
        loading={deciding}
        onConfirm={handleApprove}
      />

      <RejectPaymentDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        orderNumber={order.order_number}
        loading={deciding}
        onConfirm={handleReject}
      />
    </div>
  )
}
