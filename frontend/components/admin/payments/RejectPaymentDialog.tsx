"use client"

import * as React from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const MIN_REASON = 10
const MAX_REASON = 500

/**
 * Alasan penolakan wajib diisi (10–500 karakter), sama dengan batas yang
 * ditegakkan backend dan constraint `ck_payments_rejection_reason_len`.
 */
export function RejectPaymentDialog({
  open,
  onOpenChange,
  orderNumber,
  loading,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderNumber: string | null
  loading: boolean
  onConfirm: (reason: string) => Promise<void> | void
}) {
  const [reason, setReason] = React.useState("")
  const trimmed = reason.trim()
  const tooShort = trimmed.length < MIN_REASON
  const tooLong = trimmed.length > MAX_REASON

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return
        // Form dikosongkan saat ditutup supaya alasan lama tidak terbawa.
        if (!next) setReason("")
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-base">Tolak bukti pembayaran</DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-500">
                Pesanan {orderNumber ?? ""} akan ditandai ditolak. Pelanggan dapat mengunggah ulang
                bukti setelah melihat alasan di bawah.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <label htmlFor="rejection-reason" className="text-xs font-semibold text-zinc-800">
            Alasan penolakan <span className="text-red-600">*</span>
          </label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={loading}
            rows={4}
            maxLength={MAX_REASON + 50}
            placeholder="Contoh: nominal transfer tidak sesuai dengan total tagihan."
            className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-400 disabled:opacity-60"
          />
          <p
            className={`mt-1 text-[11px] ${tooLong ? "text-red-600" : "text-zinc-500"}`}
          >
            {trimmed.length}/{MAX_REASON} karakter
            {tooShort ? ` · minimal ${MIN_REASON} karakter` : ""}
            {tooLong ? " · terlalu panjang" : ""}
          </p>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setReason("")
              onOpenChange(false)
            }}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={loading || tooShort || tooLong}
            onClick={() => onConfirm(trimmed)}
          >
            {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {loading ? "Memproses..." : "Tolak pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
