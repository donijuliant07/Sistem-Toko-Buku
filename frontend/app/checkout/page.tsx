"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingCS from "@/components/FloatingCS";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/components/AuthProvider";
import { createOrder, getShippingOptions, type ShippingOption } from "@/lib/api";
import { formatRupiah } from "@/components/ProductCard";
import type { OrderInput } from "@/lib/types";
import RequireRole from "@/components/RequireRole";

// Rate selection is optional; the server rejects an empty choice rather than
// falling back to a default, so the placeholder keeps the user from submitting
// a shipping option they never picked.
const NO_SHIPPING = "";

// No payment gateway is integrated, so only methods that can be settled
// out-of-band are offered. Nothing here marks a payment as received.
const PAYMENT_METHODS = ["Transfer Bank", "COD (Bayar di Tempat)"];

// product_id is a UUID FK on order_items; ids from mock/local cart data are not.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function CheckoutContent() {
  const router = useRouter();
  const { items, totalPrice, clearCart, hasUnavailableItems } = useCart();
  const { session, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [shippingId, setShippingId] = useState<string>(NO_SHIPPING);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [notes, setNotes] = useState("");

  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingError, setShippingError] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  // Checkout requires an account: the order is created against the signed-in user.
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace("/login?redirect=/checkout");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (session?.user?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi field email dari sesi yang baru tersedia setelah auth selesai
      setEmail((current) => current || session.user.email || "");
    }
  }, [session]);

  // Tarif diambil dari server supaya angka yang ditampilkan sama dengan yang
  // dihitung backend; tidak ada duplikasi tarif di frontend.
  useEffect(() => {
    let cancelled = false;
    getShippingOptions()
      .then((options) => {
        if (cancelled) return;
        setShippingOptions(options);
        setShippingId((current) => current || options[0]?.id || NO_SHIPPING);
      })
      .catch(() => {
        if (!cancelled) setShippingError("Gagal memuat tarif pengiriman. Muat ulang halaman.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shipping = shippingOptions.find((option) => option.id === shippingId);
  const grandTotal = totalPrice + (shipping?.fee ?? 0);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Nama penerima minimal 2 karakter.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Format email tidak valid.";
    if (phone.trim().length < 9) next.phone = "Nomor telepon minimal 9 digit.";
    if (address.trim().length < 5) next.address = "Alamat pengiriman minimal 5 karakter.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setServerError("");
    if (items.length === 0) {
      setServerError("Keranjang kosong. Tambahkan buku sebelum melanjutkan.");
      return;
    }
    // Stok dicek server; ini hanya supaya user tidak mengisi form untuk pesanan
    // yang sudah pasti ditolak.
    if (hasUnavailableItems) {
      setServerError("Ada buku yang stoknya tidak mencukupi. Sesuaikan jumlah di keranjang dulu.");
      return;
    }
    if (!validate()) return;
    if (!session?.access_token) {
      router.replace("/login?redirect=/checkout");
      return;
    }
    if (!shipping) {
      setServerError(shippingError || "Pilih layanan pengiriman terlebih dahulu.");
      return;
    }

    setPending(true);
    try {
      // `book_id` adalah FK ke tabel `books`; id non-UUID (data mock) tidak bisa
      // dipesan, jadi baris seperti itu ditolak sebelum dikirim.
      const invalid = items.find((item) => !UUID_RE.test(item.book_id ?? item.id));
      if (invalid) {
        setServerError(`"${invalid.title}" tidak tersedia untuk dipesan. Hapus dari keranjang lalu coba lagi.`);
        setPending(false);
        return;
      }

      const payload: OrderInput = {
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone.trim(),
        shipping_address: address.trim(),
        shipping_option_id: shipping.id,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          book_id: item.book_id ?? item.id,
          quantity: item.quantity,
        })),
      };

      const result = await createOrder(payload, session.access_token);
      // Keranjang server ikut dikosongkan; kegagalan di sini tidak membatalkan
      // pesanan yang sudah tersimpan.
      try {
        await clearCart();
      } catch {
        // abaikan: pesanan sudah dibuat
      }
      // Checkout berakhir di instruksi pembayaran: di sana user melihat total
      // dari server dan mengunggah bukti transfer.
      router.replace(`/orders/${result.data.id}/payment`);
    } catch (cause) {
      setServerError(cause instanceof Error ? cause.message : "Pesanan gagal dibuat. Silakan coba lagi.");
      setPending(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#0052cc] border-t-transparent rounded-full" />
        </main>
        <Footer />
      </div>
    );
  }

  if (session && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar />
        <Header query="" onSearchSubmit={() => {}} />
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-16">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <span className="text-4xl">🛒</span>
            <h1 className="mt-3 text-lg font-extrabold text-gray-900">Keranjang masih kosong</h1>
            <p className="mt-1 text-sm text-gray-500">
              Tambahkan buku ke keranjang sebelum melanjutkan ke pembayaran.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex px-5 py-2.5 bg-[#0052cc] hover:bg-[#0041a8] text-white rounded-xl text-xs font-extrabold transition-colors"
            >
              Jelajahi Katalog
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar />
      <Header query="" onSearchSubmit={() => {}} />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900">Checkout</h1>
        <p className="mt-1 text-sm text-gray-500">Lengkapi data pengiriman dan metode pembayaran.</p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left: delivery + payment */}
          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-extrabold text-gray-900">Data Pengiriman</h2>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nama Penerima" error={errors.name}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass(errors.name)}
                    placeholder="Nama lengkap"
                  />
                </Field>
                <Field label="Email" error={errors.email}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass(errors.email)}
                    placeholder="nama@email.com"
                  />
                </Field>
                <Field label="No. Telepon" error={errors.phone}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass(errors.phone)}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
                <Field label="Kurir" error={errors.shipping}>
                  <select
                    value={shippingId}
                    onChange={(e) => setShippingId(e.target.value)}
                    disabled={shippingOptions.length === 0}
                    className={inputClass(errors.shipping)}
                  >
                    {shippingOptions.length === 0 && (
                      <option value={NO_SHIPPING}>
                        {shippingError || "Memuat tarif pengiriman…"}
                      </option>
                    )}
                    {shippingOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.courier} {option.service} — {formatRupiah(option.fee)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Alamat Lengkap" error={errors.address}>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className={inputClass(errors.address)}
                      placeholder="Jalan, nomor rumah, kelurahan, kecamatan, kota, kode pos"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Catatan (opsional)">
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className={inputClass()}
                      placeholder="Patokan alamat, instruksi khusus, dll."
                    />
                  </Field>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Ongkos kirim di atas adalah tarif tetap per layanan, bukan hasil perhitungan otomatis.
              </p>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="text-sm font-extrabold text-gray-900">Metode Pembayaran</h2>
              <div className="mt-4 space-y-2">
                {PAYMENT_METHODS.map((method) => (
                  <label
                    key={method}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      paymentMethod === method ? "border-[#0052cc] bg-blue-50/50" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={() => setPaymentMethod(method)}
                      className="accent-[#0052cc]"
                    />
                    <span className="text-xs font-bold text-gray-800">{method}</span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-400">
                Pembayaran belum terhubung ke payment gateway. Status pembayaran dikonfirmasi manual oleh admin.
              </p>
            </section>
          </div>

          {/* Right: summary */}
          <aside className="bg-white rounded-2xl border border-gray-100 p-5 lg:sticky lg:top-24">
            <h2 className="text-sm font-extrabold text-gray-900">Ringkasan Pesanan</h2>

            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="w-10 h-14 bg-gray-50 rounded-md border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden">
                    {item.cover_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.cover_url} alt={item.title} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-gray-400">📖</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{item.title}</p>
                    <p className="text-[11px] text-gray-400">
                      {item.quantity} × {formatRupiah(item.unit_price)}
                    </p>
                    {!item.available && (
                      <p className="text-[10px] font-semibold text-red-600">
                        Stok tidak mencukupi (tersedia {item.stock})
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-extrabold text-gray-900">
                    {formatRupiah(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
              <Row label="Subtotal" value={formatRupiah(totalPrice)} />
              <Row label="Ongkos Kirim" value={shipping ? formatRupiah(shipping.fee) : "—"} />
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-extrabold text-base text-[#0052cc]">{formatRupiah(grandTotal)}</span>
              </div>
            </div>

            {serverError && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[11px] font-medium">{serverError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-4 w-full py-3 bg-[#0052cc] hover:bg-[#0041a8] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses…</span>
                </>
              ) : (
                <span>Konfirmasi Pesanan</span>
              )}
            </button>

            <Link
              href="/"
              className="mt-3 block text-center text-[11px] font-semibold text-gray-500 hover:text-gray-700"
            >
              Lanjut belanja
            </Link>
          </aside>
        </form>
      </main>

      <Footer />
      <FloatingCS />
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full px-3 py-2.5 text-xs rounded-xl border bg-white outline-none transition-colors ${
    error ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-[#0052cc]"
  }`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[11px] font-bold text-gray-600">{label}</span>
      {children}
      {error && <span className="block mt-1 text-[11px] font-medium text-red-500">{error}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  );
}

// Admin mengelola pesanan lewat dashboard admin, bukan alur pelanggan.
export default function CheckoutPage() {
  return (
    <RequireRole role="user">
      <CheckoutContent />
    </RequireRole>
  );
}
