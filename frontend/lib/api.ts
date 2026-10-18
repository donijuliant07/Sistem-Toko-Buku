import type {
  Book,
  BookInput,
  BookPage,
  BookUpdate,
  CartItemAddInput,
  CartMergeInput,
  CartPayload,
  CurrentUser,
  MarketplaceComparison,
  MarketplaceInfo,
  MarketplaceSource,
  MarketplaceSourceInput,
  MarketplaceSourceUpdate,
  Order,
  OrderInput,
  OrderPage,
  OrderStatus,
  Promo,
  PromoInput,
  PromoUpdate,
  SpoilerLevel,
  AIReviewResponse,
} from "./types";
import { supabase } from "./supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & { accessToken?: string };

type ApiEnvelope<T> = { sukses: boolean; pesan: string; data: T };

/**
 * Batas waktu permintaan bila pemanggil tidak menyebut satu sendiri.
 *
 * Tanpa ini, `fetch` menunggu tanpa batas sampai server menjawab — modal yang
 * menunggu backend lambat (scraping marketplace) tidak pernah pindah ke layar
 * error, dan terlihat "freeze". Dipasangkan dengan `AbortSignal.any` supaya
 * signal milik pemanggil (mis. tombol Batal) tetap berlaku.
 */
const DEFAULT_TIMEOUT_MS = 45_000;

/** `Error` dengan nama `AbortError` — dibedakan pemanggil untuk pesan "dibatalkan". */
function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { accessToken, headers, signal, ...requestInit } = init ?? {};
  const signals: AbortSignal[] = [timeoutSignal(DEFAULT_TIMEOUT_MS)];
  if (signal) signals.push(signal);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...requestInit,
      headers: {
        Accept: "application/json",
        ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      signal: AbortSignal.any(signals),
    });
  } catch (cause) {
    // Abort dari pemanggil diteruskan apa adanya; timeout diubah menjadi pesan
    // yang bisa dibaca pengguna, karena `TimeoutError` mentah tidak informatif.
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new Error("Server tidak merespons dalam batas waktu. Coba lagi.");
    }
    throw cause;
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> };
      if (typeof body.detail === "string") detail = body.detail;
      if (Array.isArray(body.detail)) detail = body.detail.map((item) => item.msg).filter(Boolean).join(", ") || detail;
    } catch {
      // Keep status fallback when backend returns an empty response.
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function getBooks(page = 1, query = "", pageSize = 12): Promise<BookPage> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (query.trim()) params.set("q", query.trim());
  return request<BookPage>(`/books?${params.toString()}`);
}

export function getBook(id: string): Promise<Book> {
  return request<Book>(`/books/${encodeURIComponent(id)}`);
}

export type ShippingOption = {
  id: string;
  courier: string;
  service: string;
  fee: number;
};

/** Tarif pengiriman dari server — sumber kebenaran yang sama dipakai `POST /orders`. */
export async function getShippingOptions(): Promise<ShippingOption[]> {
  const res = await request<ApiEnvelope<ShippingOption[]>>("/shipping-options");
  return res.data ?? [];
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  try {
    const res = await request<ApiEnvelope<CurrentUser>>("/auth/me", { accessToken });
    return res.data;
  } catch {
    const res = await request<ApiEnvelope<CurrentUser>>("/me", { accessToken });
    return res.data;
  }
}

export function createBook(data: BookInput, accessToken: string): Promise<Book> {
  return request<Book>("/books", { method: "POST", body: JSON.stringify(data), accessToken });
}

export function updateBook(id: string, data: BookUpdate, accessToken: string): Promise<Book> {
  return request<Book>(`/books/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data), accessToken });
}

export function deleteBook(id: string, accessToken: string): Promise<void> {
  return request<void>(`/books/${encodeURIComponent(id)}`, { method: "DELETE", accessToken });
}

export function getAIReview(
  bookId: string,
  spoilerLevel: SpoilerLevel,
  accessToken?: string
): Promise<AIReviewResponse> {
  return request<AIReviewResponse>(`/books/${encodeURIComponent(bookId)}/ai-review`, {
    method: "POST",
    body: JSON.stringify({ spoiler_level: spoilerLevel }),
    accessToken,
  });
}

export function createOrder(data: OrderInput, accessToken: string): Promise<ApiEnvelope<Order>> {
  return request<ApiEnvelope<Order>>(`/orders`, { method: "POST", body: JSON.stringify(data), accessToken });
}

export function getOrder(id: string, accessToken: string): Promise<ApiEnvelope<Order>> {
  return request<ApiEnvelope<Order>>(`/orders/${encodeURIComponent(id)}`, { accessToken });
}

export function getMyOrders(accessToken: string, page = 1, limit = 10): Promise<OrderPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request<OrderPage>(`/orders?${params.toString()}`, { accessToken });
}

// Alias admin: endpoint yang sama, dengan limit besar untuk tabel admin.
export function getOrders(accessToken: string, page = 1, limit = 100): Promise<OrderPage> {
  return getMyOrders(accessToken, page, limit);
}

export function getOrderDetail(id: string, accessToken: string): Promise<ApiEnvelope<Order>> {
  return getOrder(id, accessToken);
}

export function updateOrderStatus(
  id: string,
  status: OrderStatus,
  accessToken: string,
  trackingNumber?: string
): Promise<ApiEnvelope<Record<string, unknown>>> {
  return request<ApiEnvelope<Record<string, unknown>>>(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, tracking_number: trackingNumber ?? null }),
    accessToken,
  });
}

// --- Keranjang (server; selalu butuh token user) ---
// Harga dan stok tidak pernah dikirim dari sini: server membacanya dari `books`
// pada setiap permintaan, jadi angka yang ditampilkan tidak bisa basi.

export function getCart(accessToken: string): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart`, { accessToken });
}

export function addCartItem(
  data: CartItemAddInput,
  accessToken: string
): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart/items`, {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
}

export function updateCartItem(
  itemId: string,
  quantity: number,
  accessToken: string
): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
    accessToken,
  });
}

export function removeCartItem(
  itemId: string,
  accessToken: string
): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    accessToken,
  });
}

export function clearCartRequest(accessToken: string): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart`, { method: "DELETE", accessToken });
}

/** Gabungkan keranjang tamu (localStorage) setelah login. */
export function mergeCart(
  data: CartMergeInput,
  accessToken: string
): Promise<ApiEnvelope<CartPayload>> {
  return request<ApiEnvelope<CartPayload>>(`/cart/merge`, {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
}

/** Token sesi Supabase; `undefined` bila belum login. Dipakai layanan admin. */
export async function getAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

// --- Promo (khusus staff/admin; backend memverifikasi peran lewat token) ---

export async function getPromos(): Promise<Promo[]> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<Promo[]>>("/promos", { accessToken });
  return res.data ?? [];
}

export async function createPromo(data: PromoInput): Promise<Promo> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<Promo>>("/promos", {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
  return res.data;
}

export async function updatePromo(id: string, data: PromoUpdate): Promise<Promo> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<Promo>>(`/promos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    accessToken,
  });
  return res.data;
}

export async function deletePromo(id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await request<ApiEnvelope<{ id: string }>>(`/promos/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
}

// --- Perbandingan harga marketplace (khusus pelanggan login) ---

/**
 * Harga satu buku di seluruh marketplace yang sumbernya sudah diisi admin.
 *
 * `accessToken` diterima sebagai argumen (bukan diambil sendiri lewat
 * `getAccessToken()`) karena pemanggilnya — `BookDetailModal` — sudah memegang
 * token dari halaman: satu pembacaan sesi Supabase, bukan dua untuk satu modal.
 *
 * `refresh` melewati cache. Backend membatasi lajunya per buku, jadi pemanggil
 * yang kena batas itu menerima error 429 dengan pesan yang layak ditampilkan.
 */
export async function getMarketplacePrices(
  bookId: string,
  accessToken: string,
  options?: { refresh?: boolean; signal?: AbortSignal }
): Promise<ApiEnvelope<MarketplaceComparison>> {
  const params = options?.refresh ? "?refresh=true" : "";
  return request<ApiEnvelope<MarketplaceComparison>>(
    `/books/${encodeURIComponent(bookId)}/marketplace-prices${params}`,
    { accessToken, signal: options?.signal }
  );
}

/** Slug + label marketplace yang didukung, untuk dropdown pengelolaan sumber. */
export async function getMarketplaces(): Promise<MarketplaceInfo[]> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<MarketplaceInfo[]>>("/marketplaces", { accessToken });
  return res.data ?? [];
}

// --- Pengelolaan sumber harga marketplace (khusus admin) ---
//
// Semuanya memakai `getAccessToken()` sendiri, bukan menerimanya sebagai argumen
// seperti `getMarketplacePrices`: dipanggil dari halaman admin yang tidak memegang
// token di state-nya. Token diambil dari sesi Supabase, dan backend yang
// memutuskan boleh atau tidak lewat `require_admin` — bukan frontend.

export async function getMarketplaceSources(bookId: string): Promise<MarketplaceSource[]> {
  const accessToken = await getAccessToken();
  const params = new URLSearchParams({ book_id: bookId });
  const res = await request<ApiEnvelope<MarketplaceSource[]>>(
    `/marketplace-sources?${params.toString()}`,
    { accessToken }
  );
  return res.data ?? [];
}

export async function createMarketplaceSource(
  data: MarketplaceSourceInput
): Promise<MarketplaceSource> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<MarketplaceSource>>("/marketplace-sources", {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
  return res.data;
}

/**
 * Isi sumber marketplace bawaan (satu per marketplace scraper) untuk satu buku.
 *
 * Hanya menambah sumber yang belum ada; konfigurasi admin yang sudah ada tidak
 * ditimpa. Mengembalikan sumber yang **baru** dibuat — daftar kosong berarti
 * semuanya sudah terdaftar.
 */
export async function seedMarketplaceSources(bookId: string): Promise<MarketplaceSource[]> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<MarketplaceSource[]>>(
    `/books/${encodeURIComponent(bookId)}/marketplace-sources/seed`,
    { method: "POST", accessToken }
  );
  return res.data ?? [];
}

export async function updateMarketplaceSource(
  id: string,
  data: MarketplaceSourceUpdate
): Promise<MarketplaceSource> {
  const accessToken = await getAccessToken();
  const res = await request<ApiEnvelope<MarketplaceSource>>(
    `/marketplace-sources/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(data), accessToken }
  );
  return res.data;
}

export async function deleteMarketplaceSource(id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await request<ApiEnvelope<{ id: string }>>(
    `/marketplace-sources/${encodeURIComponent(id)}`,
    { method: "DELETE", accessToken }
  );
}
