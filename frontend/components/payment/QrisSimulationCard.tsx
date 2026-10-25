"use client";

import { AlertTriangle, Copy, Check } from "lucide-react";
import { useState } from "react";

/**
 * Instruksi pembayaran simulasi.
 *
 * Gambar di `public/images/qris-simulasi.svg` **bukan QRIS aktif** dan label
 * peringatan dicetak di beberapa tempat — di kartu, di dalam gambar, dan pada
 * teks di bawahnya — supaya tidak ada yang mengira uang benar-benar terkirim.
 */
export function QrisSimulationCard({ amount }: { amount: number }) {
  const [copied, setCopied] = useState(false);
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(String(amount));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard bisa diblokir browser; nominal tetap terlihat di layar.
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-[11px] font-semibold text-amber-800 leading-relaxed">
          Simulasi pembayaran — bukan QRIS aktif. Gambar di bawah tidak dapat dipindai dan tidak
          memindahkan uang. Gunakan alur ini hanya untuk menguji unggah bukti.
        </p>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis; next/image tidak menambah nilai untuk satu aset ini */}
        <img
          src="/images/qris-simulasi.svg"
          alt="QRIS simulasi, bukan kode pembayaran aktif"
          width={180}
          height={180}
          className="w-[180px] h-[180px] rounded-xl border border-gray-200"
        />
        <div className="text-center sm:text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total tagihan</p>
          <p className="text-2xl font-extrabold text-gray-900">{formatted}</p>
          <p className="mt-1 text-xs text-gray-500">
            Transfer sesuai nominal ini, lalu unggah bukti transfernya.
          </p>
          <button
            type="button"
            onClick={copyAmount}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? "Nominal disalin" : "Salin nominal"}
          </button>
        </div>
      </div>
    </section>
  );
}
