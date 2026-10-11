import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

/**
 * Halaman "Akses Ditolak" bersama.
 *
 * Dipakai area admin (untuk pelanggan yang membuka `/admin/*`) maupun area
 * pelanggan (untuk admin yang membuka `/checkout`). Ini hanya lapisan UX —
 * penolakan yang mengikat tetap dilakukan backend dan RLS.
 */
export default function AccessDenied({
  message = "Halaman ini khusus untuk administrator toko. Silakan login dengan akun yang memiliki hak akses.",
  backHref = "/",
  backLabel = "Ke Beranda",
}: {
  message?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Akses Ditolak</h1>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
        <Link
          href={backHref}
          className="px-4 py-2 text-sm text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
      </div>
    </div>
  );
}
