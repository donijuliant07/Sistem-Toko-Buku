"use client";

import { useRef, useState } from "react";
import { AlertCircle, ImageUp, Loader2, UploadCloud, X } from "lucide-react";
import { uploadPaymentProof } from "@/lib/api";
import type { OrderPayment } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Unggah bukti transfer dengan drag-and-drop atau pemilih berkas.
 *
 * Pemeriksaan di sini hanya untuk umpan balik cepat; backend memeriksa ulang
 * ukuran **dan isi** berkas (signature), jadi MIME palsu tetap ditolak.
 */
export function ProofUpload({
  orderId,
  accessToken,
  canSubmit,
  onUploaded,
}: {
  orderId: string;
  accessToken: string;
  canSubmit: boolean;
  onUploaded: (payment: OrderPayment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const pick = (next: File | null | undefined) => {
    setError("");
    if (!next) return;
    if (!ALLOWED_TYPES.includes(next.type)) {
      setError("Format harus JPG, PNG, atau WebP.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("Ukuran berkas maksimal 5MB.");
      return;
    }
    setFile(next);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(next);
    });
  };

  const reset = () => {
    setFile(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await uploadPaymentProof(orderId, file, accessToken);
      reset();
      onUploaded(res.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Bukti gagal diunggah.");
    } finally {
      setUploading(false);
    }
  };

  if (!canSubmit) {
    return (
      <p className="text-xs text-gray-500">
        Bukti tidak dapat dikirim pada status pembayaran ini.
      </p>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pick(event.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-[#0052cc] bg-blue-50/60" : "border-gray-200 hover:border-gray-300"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- pratinjau blob lokal, bukan aset statis
          <img
            src={preview}
            alt="Pratinjau bukti pembayaran"
            className="mx-auto max-h-56 rounded-xl border border-gray-200 object-contain"
          />
        ) : (
          <>
            <UploadCloud className="w-7 h-7 text-gray-400 mx-auto" />
            <p className="mt-2 text-xs font-bold text-gray-700">
              Tarik berkas ke sini, atau klik untuk memilih
            </p>
            <p className="mt-1 text-[11px] text-gray-400">JPG, PNG, atau WebP · maksimal 5MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0])}
        />
      </div>

      {file && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-gray-800">{file.name}</p>
            <p className="text-[11px] text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={uploading}
            className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Hapus berkas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-rose-600">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!file || uploading}
        className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0052cc] hover:bg-[#0041a8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold transition-colors cursor-pointer"
      >
        {uploading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ImageUp className="w-3.5 h-3.5" />
        )}
        {uploading ? "Mengunggah…" : "Kirim bukti pembayaran"}
      </button>
      <p className="mt-2 text-[11px] text-gray-400">
        Mengirim bukti hanya mengubah status menjadi “Menunggu Verifikasi”. Pembayaran dinyatakan
        lunas setelah admin memeriksanya.
      </p>
    </div>
  );
}
