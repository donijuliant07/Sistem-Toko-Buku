"use client";

import { useState } from "react";
import { ImageOff, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAYMENT_VIEW_META } from "@/components/payment/PaymentViewBadge";
import type { PaymentProof } from "@/lib/types";

/**
 * Pratinjau bukti dengan zoom.
 *
 * URL adalah signed URL berumur pendek dari backend; `null` berarti backend
 * gagal membuatnya (mis. bucket belum dibuat) — ditampilkan sebagai keadaan
 * yang jujur, bukan gambar rusak.
 */
export function ProofPreview({ proof }: { proof: PaymentProof }) {
  const [open, setOpen] = useState(false);

  if (!proof.url) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-center">
        <div>
          <ImageOff className="mx-auto h-5 w-5 text-gray-400" />
          <p className="mt-1.5 px-3 text-[11px] text-gray-500">
            Pratinjau tidak tersedia. Penyimpanan bukti belum siap — hubungi admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-gray-200"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed URL dinamis, bukan aset statis */}
        <img
          src={proof.url}
          alt={`Bukti pembayaran ${proof.original_filename ?? ""}`.trim()}
          className="h-40 w-full bg-gray-50 object-contain"
        />
        <span className="absolute right-2 top-2 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Maximize2 className="mr-1 inline h-3 w-3" />
          Perbesar
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {proof.original_filename ?? "Bukti pembayaran"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {PAYMENT_VIEW_META[proof.status === "approved" ? "paid" : proof.status === "rejected" ? "rejected" : "under_review"].label}
              {" · "}
              {new Date(proof.uploaded_at).toLocaleString("id-ID")}
            </DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed URL dinamis */}
          <img
            src={proof.url}
            alt="Bukti pembayaran diperbesar"
            className="max-h-[70vh] w-full rounded-xl bg-gray-50 object-contain"
          />
          {proof.review_note && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Catatan admin: {proof.review_note}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
