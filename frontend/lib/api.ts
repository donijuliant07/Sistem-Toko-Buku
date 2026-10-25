import type {
  PaymentDetail,
  PaymentPage,
  Book,
  BookInput,
  BookPage,
  BookUpdate,
  CartItemAddInput,
  CartMergeInput,
  CartPayload,
  ChatMessage,
  CurrentUser,
  MarketplaceComparison,
  MarketplaceInfo,
  MarketplaceSource,
  MarketplaceSourceInput,
  MarketplaceSourceUpdate,
  Order,
  OrderInput,
  OrderPage,
  OrderPayment,
  OrderStatus,
  PaymentProof,
  PaymentStatusView,
  Promo,
  PromoInput,
  PromoUpdate,
  SpoilerLevel,
  AIReviewResponse,
  AdvisorChatResponse,
  AdvisorFeedbackRequest,
  AdvisorPricing,
  AdvisorSessionRead,
  CommunityListParams,
  GroupCreateInput,
  GroupDetail,
  GroupMember,
  GroupPage,
  GroupUpdateInput,
  MemberRole,
  MessageCreateInput,
  MessagePage,
  UserSearchResult,
  AIReviewGeneration,
  AIReviewOutcome,
  AIReviewSummary,
  PointTransactionPage,
  RewardActivityPage,
  RewardsMe,
  SpoilerAccess,
} from "./types";
import { supabase } from "./supabase";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Host API untuk pesan error: banyak runtime Windows me-resolve `localhost`
 * ke IPv6 (`::1`), sedangkan uvicorn sering hanya listen di `0.0.0.0` (IPv4). */
function apiHostLabel(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

type RequestOptions = RequestInit & { accessToken?: string; timeoutMs?: number };

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
  // Beberapa runtime Windows (< Chrome 103, WebView lama) tidak punya
  // `AbortSignal.timeout`/`any`; tanpa guard ini kegagalan jaringan lain
  // tertutup `TypeError: ... is not a function` dan pesan diagnosis CORS
  // di bawah tidak pernah tampil.
  return typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(ms)
    : new AbortController().signal;
}

/** Gabungkan beberapa signal; fallback ke signal pemanggil bila `any` tak ada. */
function mergeSignals(signals: AbortSignal[]): AbortSignal {
  const [first, ...rest] = signals;
  if (rest.length === 0 || typeof AbortSignal.any !== "function") return first;
  return AbortSignal.any(signals);
}

/**
 * Error HTTP dari backend.
 *
 * `code` diambil dari prefix `KODE: pesan` pada `detail` (format `RewardsError`),
 * mis. `INSUFFICIENT_POINTS` atau `DAILY_CAP_REACHED`. `null` bila detail biasa.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(detail: string, status: number) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    const match = /^([A-Z][A-Z0-9_]+):\s/.exec(detail);
    this.code = match ? match[1] : null;
  }
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const { accessToken, headers, signal, timeoutMs, ...requestInit } = init ?? {};
  const signals: AbortSignal[] = [timeoutSignal(timeoutMs ?? DEFAULT_TIMEOUT_MS)];
  if (signal) signals.push(signal);

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...requestInit,
      headers: {
        Accept: "application/json",
        // FormData memasang boundary sendiri; menimpanya dengan JSON merusak unggahan.
        ...(requestInit.body && !(requestInit.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      signal: mergeSignals(signals),
    });
  } catch (cause) {
    // Abort dari pemanggil diteruskan apa adanya; timeout diubah menjadi pesan
    // yang bisa dibaca pengguna, karena `TimeoutError` mentah tidak informatif.
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw new Error("Server tidak merespons dalam batas waktu. Coba lagi.");
    }
    // Abort dari pemanggil (navigasi/unmount) diteruskan apa adanya.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    // `TypeError: Failed to fetch` / "NetworkError when attempting to fetch
    // resource" tidak menjelaskan apa pun. Browser menangkap kegagalan jaringan
    // dan CORS sebagai error yang sama, jadi pesannya menyebut kedua sebab dan
    // origin halaman supaya mudah dicocokkan dengan FRONTEND_ORIGINS backend.
    const origin = typeof window === "undefined" ? "(server)" : window.location.origin;
    throw new Error(
      `Tidak dapat terhubung ke server API (${apiUrl}). ` +
        `Pastikan backend berjalan di http://${apiHostLabel(apiUrl)} dan menerima origin ${origin} ` +
        `(atur lewat FRONTEND_ORIGINS di backend/.env). Untuk memastikan mana yang gagal, buka ` +
        `http://${apiHostLabel(apiUrl)}/health di tab baru: bila terbuka, masalahnya CORS; ` +
        `bila tidak, backend tidak terjangkau dari browser ini.`,
    );
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
    // Reward memakai format detail "KODE: pesan"; kodenya dipakai UI untuk
    // memilih tindakan (mis. buka halaman poin), pesannya tetap apa adanya.
    throw new ApiError(detail, response.status);
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

/**
 * Ulasan AI + metadata penagihan.
 *
 * - Tanpa token → alias lama (`/books/{id}/ai-review`): hanya level gratis
 *   yang berhasil; `medium`/`heavy` dijawab 401 oleh backend.
 * - Dengan token → `/ai/...`: syarat pembelian/poin berlaku, hasil disimpan
 *   (buka ulang tidak menagih lagi) dan `points_spent` memungkinkan UI
 *   memberi tahu pengguna kapan poin benar-benar terpotong.
 */
export function getAIReview(
  bookId: string,
  spoilerLevel: SpoilerLevel,
  accessToken?: string
): Promise<AIReviewOutcome> {
  if (!accessToken) {
    return request<AIReviewResponse>(`/books/${encodeURIComponent(bookId)}/ai-review`, {
      method: "POST",
      body: JSON.stringify({ spoiler_level: spoilerLevel }),
    }).then((review) => ({ review, access_method: "free", points_spent: 0 }));
  }
  return request<ApiEnvelope<AIReviewGeneration>>(
    `/ai/books/${encodeURIComponent(bookId)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ spoiler_level: spoilerLevel }),
      accessToken,
    }
  ).then((res) => {
    if (!res.data.result) {
      throw new Error(
        res.data.failure_reason
          ? `Ulasan AI gagal dibuat. ${res.data.failure_reason}`
          : "Ulasan AI gagal dibuat. Poin yang terpotong sudah dikembalikan."
      );
    }
    return {
      review: res.data.result,
      access_method: res.data.access_method,
      points_spent: res.data.points_spent,
    };
  });
}

// --- Book Rewards (pelanggan) ---

export function getMyRewards(accessToken: string, bookId?: string): Promise<RewardsMe> {
  const suffix = bookId ? `?book_id=${encodeURIComponent(bookId)}` : "";
  return request<ApiEnvelope<RewardsMe>>(`/rewards/me${suffix}`, { accessToken }).then((r) => r.data);
}

/** Syarat tiap tingkat spoiler untuk satu buku (dipakai modal pemilih spoiler). */
export function getSpoilerAccess(
  bookId: string,
  accessToken: string
): Promise<Record<SpoilerLevel, SpoilerAccess>> {
  return request<ApiEnvelope<Record<SpoilerLevel, SpoilerAccess>>>(
    `/rewards/spoiler-access?book_id=${encodeURIComponent(bookId)}`,
    { accessToken }
  ).then((r) => r.data);
}

export function getMyPointTransactions(
  accessToken: string,
  page = 1,
  limit = 20
): Promise<PointTransactionPage> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return request<ApiEnvelope<PointTransactionPage>>(`/rewards/transactions?${params}`, {
    accessToken,
  }).then((r) => r.data);
}

// --- Book Rewards (admin) ---

export type RewardRule = {
  key: string;
  value: number;
  default: number;
  max_value: number;
};

export function getRewardRules(accessToken: string): Promise<RewardRule[]> {
  return request<ApiEnvelope<{ rules: RewardRule[] }>>("/admin/rewards/rules", {
    accessToken,
  }).then((r) => r.data.rules);
}

export function updateRewardRules(
  values: Record<string, number>,
  accessToken: string
): Promise<RewardRule[]> {
  return request<ApiEnvelope<{ rules: RewardRule[] }>>("/admin/rewards/rules", {
    method: "PATCH",
    body: JSON.stringify({ values }),
    accessToken,
  }).then((r) => r.data.rules);
}

export function adjustUserPoints(
  payload: { user_id: string; delta: number; reason: string; reference?: string },
  accessToken: string
): Promise<{ transaction_id: string; points_delta: number; balance_after: number }> {
  return request<ApiEnvelope<{ transaction_id: string; points_delta: number; balance_after: number }>>(
    "/admin/rewards/adjustments",
    { method: "POST", body: JSON.stringify(payload), accessToken }
  ).then((r) => r.data);
}

export function getRewardActivities(
  accessToken: string,
  params: { status?: string; page?: number; limit?: number } = {}
): Promise<RewardActivityPage> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 20));
  return request<ApiEnvelope<RewardActivityPage>>(
    `/admin/rewards/activities?${query}`,
    { accessToken }
  ).then((r) => r.data);
}

export function runRewardBackfill(accessToken: string): Promise<Record<string, number>> {
  return request<ApiEnvelope<Record<string, number>>>("/admin/rewards/backfill", {
    method: "POST",
    accessToken,
  }).then((r) => r.data);
}

export function getRewardReconcile(
  accessToken: string
): Promise<{ users_checked: number; mismatched: unknown[] }> {
  return request<ApiEnvelope<{ users_checked: number; mismatched: unknown[] }>>(
    "/admin/rewards/reconcile",
    { accessToken }
  ).then((r) => r.data);
}

/**
 * Membuat ulasan AI lewat jalur berbayar.
 *
 * `idempotency_key` wajib dan harus stabil untuk satu percobaan: mengirim ulang
 * key yang sama (mis. pengguna menekan tombol dua kali karena jaringan lambat)
 * mengembalikan hasil yang sama tanpa memotong poin lagi.
 */
export function generateAIReview(
  bookId: string,
  spoilerLevel: SpoilerLevel,
  idempotencyKey: string,
  accessToken: string
): Promise<AIReviewGeneration> {
  return request<ApiEnvelope<AIReviewGeneration>>(
    `/ai/books/${encodeURIComponent(bookId)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ spoiler_level: spoilerLevel, idempotency_key: idempotencyKey }),
      accessToken,
    }
  ).then((r) => r.data);
}

export function getAIReviewGeneration(
  generationId: string,
  accessToken: string
): Promise<AIReviewGeneration> {
  return request<ApiEnvelope<AIReviewGeneration>>(
    `/ai/reviews/${encodeURIComponent(generationId)}`,
    { accessToken }
  ).then((r) => r.data);
}

export function listAIReviewGenerations(
  accessToken: string,
  page = 1,
  limit = 20
): Promise<AIReviewSummary[]> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) }).toString();
  return request<ApiEnvelope<AIReviewSummary[]>>(`/ai/reviews?${query}`, { accessToken }).then(
    (r) => r.data
  );
}

export function recoverStaleAIReviews(accessToken: string): Promise<{ recovered: number }> {
  return request<ApiEnvelope<{ recovered: number }>>("/admin/rewards/ai/recover", {
    method: "POST",
    accessToken,
  }).then((r) => r.data);
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

/**
 * Ubah status pesanan. `status` harus nilai API (`completed`, `cancelled`, …)
 * mengikuti CHECK `orders_status_check` — bukan label admin ("Selesai").
 * Pemetaan label → nilai API dilakukan `orderService.updateStatus`.
 */
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

// --- Pembayaran manual (bukti transfer) ---
// Unggahan bukti hanya membuat pembayaran `under_review`; status `paid` muncul
// setelah admin menyetujui. Tidak ada nilai status yang dikirim dari sini.

export function getOrderPayment(
  orderId: string,
  accessToken: string
): Promise<ApiEnvelope<OrderPayment>> {
  return request<ApiEnvelope<OrderPayment>>(
    `/orders/${encodeURIComponent(orderId)}/payment`,
    { accessToken }
  );
}

export function getOrderPaymentProofs(
  orderId: string,
  accessToken: string
): Promise<ApiEnvelope<PaymentProof[]>> {
  return request<ApiEnvelope<PaymentProof[]>>(
    `/orders/${encodeURIComponent(orderId)}/payment/proofs`,
    { accessToken }
  );
}

/** Kirim/ganti bukti. Batas 5MB & format diperiksa lagi di server. */
export function uploadPaymentProof(
  orderId: string,
  file: File,
  accessToken: string
): Promise<ApiEnvelope<OrderPayment>> {
  const body = new FormData();
  body.append("file", file);
  return request<ApiEnvelope<OrderPayment>>(
    `/orders/${encodeURIComponent(orderId)}/payment/proof`,
    // Unggahan 5MB bisa lebih lambat dari batas default.
    { method: "POST", body, accessToken, timeoutMs: 90_000 }
  );
}

export function listAdminPayments(
  params: { page?: number; limit?: number; status?: PaymentStatusView; search?: string },
  accessToken: string
): Promise<PaymentPage> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.search?.trim()) query.set("search", params.search.trim());
  const suffix = query.toString();
  return request<PaymentPage>(`/admin/payments${suffix ? `?${suffix}` : ""}`, {
    accessToken,
  });
}

export function getAdminPayment(
  paymentId: string,
  accessToken: string
): Promise<ApiEnvelope<PaymentDetail>> {
  return request<ApiEnvelope<PaymentDetail>>(
    `/admin/payments/${encodeURIComponent(paymentId)}`,
    { accessToken }
  );
}

export function approvePayment(
  paymentId: string,
  accessToken: string
): Promise<ApiEnvelope<OrderPayment>> {
  return request<ApiEnvelope<OrderPayment>>(
    `/admin/payments/${encodeURIComponent(paymentId)}/approve`,
    { method: "POST", accessToken }
  );
}

export function rejectPayment(
  paymentId: string,
  reason: string,
  accessToken: string
): Promise<ApiEnvelope<OrderPayment>> {
  return request<ApiEnvelope<OrderPayment>>(
    `/admin/payments/${encodeURIComponent(paymentId)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }), accessToken }
  );
}

// --- Keranjang (server; selalu butuh token user) ---// Harga dan stok tidak pernah dikirim dari sini: server membacanya dari `books`
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

// --- AI Book Advisor ---
/**
 * Kirim satu pesan ke AI Book Advisor.
 *
 * `messageId` dibuat **sekali per pesan** oleh pemanggil dan dikirim ulang apa
 * adanya saat retry — backend memakainya sebagai kunci idempotensi tagihan,
 * sehingga tidak ada potongan poin ganda. Tanpa ID, backend membuatnya sendiri.
 */
export async function sendAdvisorChat(
  message: string,
  sessionId?: string | null,
  token?: string,
  messageId?: string | null
): Promise<AdvisorChatResponse> {
  const accessToken = token || (await getAccessToken());
  const res = await request<ApiEnvelope<AdvisorChatResponse>>("/book-advisor/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      session_id: sessionId || null,
      message_id: messageId || null,
    }),
    accessToken,
  });
  return res.data;
}

/** Biaya per pesan dan saldo pengguna — sumber kebenaran, bukan hitungan klien. */
export async function getAdvisorPricing(token?: string): Promise<AdvisorPricing> {
  const accessToken = token || (await getAccessToken());
  const res = await request<ApiEnvelope<AdvisorPricing>>("/book-advisor/pricing", {
    accessToken,
  });
  return res.data;
}

export async function getAdvisorSessionMessages(
  sessionId: string,
  token?: string
): Promise<AdvisorSessionRead> {
  const accessToken = token || (await getAccessToken());
  const res = await request<ApiEnvelope<AdvisorSessionRead>>(
    `/book-advisor/sessions/${encodeURIComponent(sessionId)}/messages`,
    { accessToken }
  );
  return res.data;
}

export async function sendAdvisorFeedback(
  feedback: AdvisorFeedbackRequest,
  token?: string
): Promise<void> {
  const accessToken = token || (await getAccessToken());
  await request<ApiEnvelope<unknown>>("/book-advisor/feedback", {
    method: "POST",
    body: JSON.stringify(feedback),
    accessToken,
  });
}

/** Endpoint komunitas membalas `ApiEnvelope<T>`; payload ada di `.data`. */
async function communityRequest<T>(path: string, init?: RequestOptions): Promise<T> {
  const res = await request<ApiEnvelope<T>>(path, init);
  // 204 (hapus) tidak punya body, jadi tidak ada envelope untuk dibuka.
  if (res === undefined) return undefined as T;
  return res.data as T;
}

// --- Book Community (selalu butuh token; izin diverifikasi backend) ---

function communityPath(groupId: string, suffix = ""): string {
  return `/community/groups/${encodeURIComponent(groupId)}${suffix}`;
}

export function listCommunityGroups(
  params: CommunityListParams,
  accessToken: string
): Promise<GroupPage> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.category) query.set("category", params.category);
  if (params.mine) query.set("mine", "true");
  if (params.page) query.set("page", String(params.page));
  if (params.page_size) query.set("page_size", String(params.page_size));
  const suffix = query.toString();
  return communityRequest<GroupPage>(`/community/groups${suffix ? `?${suffix}` : ""}`, { accessToken });
}

export function getCommunityGroup(groupId: string, accessToken: string): Promise<GroupDetail> {
  return communityRequest<GroupDetail>(communityPath(groupId), { accessToken });
}

export function createCommunityGroup(
  data: GroupCreateInput,
  accessToken: string
): Promise<GroupDetail> {
  return communityRequest<GroupDetail>(`/community/groups`, {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
}

export function updateCommunityGroup(
  groupId: string,
  data: GroupUpdateInput,
  accessToken: string
): Promise<GroupDetail> {
  return communityRequest<GroupDetail>(communityPath(groupId), {
    method: "PATCH",
    body: JSON.stringify(data),
    accessToken,
  });
}

export function deleteCommunityGroup(groupId: string, accessToken: string): Promise<void> {
  return communityRequest<void>(communityPath(groupId), { method: "DELETE", accessToken });
}

export function joinCommunityGroup(groupId: string, accessToken: string): Promise<GroupDetail> {
  return communityRequest<GroupDetail>(communityPath(groupId, "/join"), { method: "POST", accessToken });
}

export function leaveCommunityGroup(groupId: string, accessToken: string): Promise<void> {
  return communityRequest<void>(communityPath(groupId, "/leave"), { method: "POST", accessToken });
}

export function listGroupMembers(groupId: string, accessToken: string): Promise<GroupMember[]> {
  return communityRequest<GroupMember[]>(communityPath(groupId, "/members"), { accessToken });
}

export function searchMemberCandidates(
  groupId: string,
  q: string,
  accessToken: string
): Promise<UserSearchResult[]> {
  const params = new URLSearchParams({ q });
  return communityRequest<UserSearchResult[]>(
    communityPath(groupId, `/member-candidates?${params.toString()}`),
    { accessToken }
  );
}

export function addGroupMember(
  groupId: string,
  userId: string,
  accessToken: string
): Promise<GroupMember> {
  return communityRequest<GroupMember>(communityPath(groupId, "/members"), {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
    accessToken,
  });
}

export function removeGroupMember(
  groupId: string,
  userId: string,
  accessToken: string
): Promise<void> {
  return communityRequest<void>(communityPath(groupId, `/members/${encodeURIComponent(userId)}`), {
    method: "DELETE",
    accessToken,
  });
}

export function updateGroupMemberRole(
  groupId: string,
  userId: string,
  role: MemberRole,
  accessToken: string
): Promise<GroupMember> {
  return communityRequest<GroupMember>(communityPath(groupId, `/members/${encodeURIComponent(userId)}`), {
    method: "PATCH",
    body: JSON.stringify({ role }),
    accessToken,
  });
}

export function transferGroupOwnership(
  groupId: string,
  userId: string,
  accessToken: string
): Promise<GroupDetail> {
  return communityRequest<GroupDetail>(communityPath(groupId, "/transfer-owner"), {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
    accessToken,
  });
}

export function listGroupMessages(
  groupId: string,
  params: { cursor?: string | null; limit?: number },
  accessToken: string
): Promise<MessagePage> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString();
  return communityRequest<MessagePage>(communityPath(groupId, `/messages${suffix ? `?${suffix}` : ""}`), {
    accessToken,
  });
}

export function sendGroupMessage(
  groupId: string,
  data: MessageCreateInput,
  accessToken: string
): Promise<ChatMessage> {
  return communityRequest<ChatMessage>(communityPath(groupId, "/messages"), {
    method: "POST",
    body: JSON.stringify(data),
    accessToken,
  });
}

export function deleteGroupMessage(
  groupId: string,
  messageId: string,
  accessToken: string
): Promise<void> {
  return communityRequest<void>(
    communityPath(groupId, `/messages/${encodeURIComponent(messageId)}`),
    { method: "DELETE", accessToken }
  );
}
