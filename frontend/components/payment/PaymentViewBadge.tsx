import type { PaymentStatusView } from "@/lib/types";

/**
 * Label & warna status pembayaran versi UI.
 *
 * `under_review` sengaja berlabel "Menunggu Verifikasi", bukan "Lunas": bukti
 * sudah diunggah tetapi uang belum dikonfirmasi admin.
 */
export const PAYMENT_VIEW_META: Record<
  PaymentStatusView,
  { label: string; className: string }
> = {
  pending: { label: "Belum Bayar", className: "bg-amber-50 text-amber-800 border-amber-300/80" },
  under_review: { label: "Menunggu Verifikasi", className: "bg-sky-50 text-sky-700 border-sky-200/60" },
  paid: { label: "Lunas", className: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  rejected: { label: "Ditolak", className: "bg-rose-50 text-rose-700 border-rose-200/60" },
  expired: { label: "Kedaluwarsa", className: "bg-zinc-100 text-zinc-600 border-zinc-200/60" },
  refunded: { label: "Dikembalikan", className: "bg-zinc-100 text-zinc-600 border-zinc-200/60" },
};

export function PaymentViewBadge({ status }: { status: PaymentStatusView }) {
  const meta = PAYMENT_VIEW_META[status] ?? PAYMENT_VIEW_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
      {meta.label}
    </span>
  );
}
