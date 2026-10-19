export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  description: string | null;
  price: string | number;
  stock: number;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BookPage = {
  items: Book[];
  total: number;
  page: number;
  page_size: number;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  role: string;
};

export type BookInput = {
  title: string;
  author: string;
  isbn: string;
  description?: string | null;
  price: number;
  stock: number;
  cover_url?: string | null;
};

export type BookUpdate = Partial<BookInput>;

// Nilai mengikuti CHECK constraint database live, bukan pilihan bebas:
//   orders_status_check   -> pending, paid, processing, shipped, completed, cancelled, expired
//   payments_status_check -> pending, success, failed, expired, refunded
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled"
  | "expired";

export type PaymentStatus = "pending" | "success" | "failed" | "expired" | "refunded";

export type OrderItemInput = {
  book_id: string;
  quantity: number;
};

export type OrderItem = {
  id: string;
  order_id: string;
  book_id: string;
  title: string | null;
  author: string | null;
  cover_url: string | null;
  unit_price: number;
  quantity: number;
  total_price: number;
};

export type Order = {
  id: string;
  order_number: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string;
  courier: string | null;
  courier_service: string | null;
  tracking_number: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  promo_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
};

export type OrderInput = {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  /** Backend menentukan kurir, layanan, dan tarif dari id ini. */
  shipping_option_id: string;
  payment_method: string;
  notes?: string | null;
  items: OrderItemInput[];
};

export type OrderPageMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

export type OrderPage = {
  sukses: boolean;
  pesan: string;
  data: Order[];
  meta: OrderPageMeta;
};

// --- Keranjang (server) ---
// `unit_price` dan `stock` selalu berasal dari tabel `books` di server, bukan
// dari client: POST/PATCH hanya mengirim `book_id` + `quantity`.
export type CartItem = {
  id: string;
  book_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  unit_price: number;
  stock: number;
  quantity: number;
  subtotal: number;
  /** `false` bila stok tidak lagi mencukupi atau bukunya sudah hilang. */
  available: boolean;
};

export type CartPayload = {
  cart_id: string;
  items: CartItem[];
  total_items: number;
  total_price: number;
};

export type CartItemAddInput = {
  book_id: string;
  quantity: number;
};

export type CartMergeInput = {
  items: CartItemAddInput[];
};

/** Jenis diskon; nilainya harus cocok dengan CHECK `ck_promos_discount_type` di DB. */
export type PromoDiscountType = "Persentase" | "Potongan Tetap" | "Gratis Ongkir";

/** Dihitung server dari `is_active` + rentang tanggal, bukan kolom tersimpan. */
export type PromoStatus = "Aktif" | "Jadwal" | "Kadaluarsa" | "Nonaktif";

export type Promo = {
  id: string;
  code: string;
  name: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount?: number | null;
  quota: number;
  used_count: number;
  is_active: boolean;
  status: PromoStatus;
  /** ISO date (YYYY-MM-DD); DB memakai DATE, bukan timestamp. */
  start_date: string;
  end_date: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PromoInput = {
  code: string;
  name: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  min_purchase: number;
  max_discount?: number | null;
  quota: number;
  is_active: boolean;
  start_date: string;
  end_date: string;
};

export type PromoUpdate = Partial<Omit<PromoInput, "code">>;

export type SpoilerLevel = "no_spoiler" | "low" | "medium" | "heavy";
export type AIReviewRequest = {
  spoiler_level: SpoilerLevel;
};

export type AIReviewResponse = {
  book_id: string;
  title: string;
  author: string;
  spoiler_level: SpoilerLevel;
  overview: string;
  writing_style: string;
  characters: string;
  strengths: string[];
  weaknesses: string[];
  who_should_read: string;
  verdict: string;
  plot_analysis?: string | null;
  character_development?: string | null;
  ending_analysis?: string | null;
  cached?: boolean;
};

// --- Perbandingan harga marketplace ---
/** Cocok dengan CHECK `ck_marketplace_*_slug` di database. */
export type MarketplaceSlug =
  | "tokopedia"
  | "shopee"
  | "lazada"
  | "blibli"
  | "gramedia"
  | "periplus"
  | "google_books"
  | "open_library"
  | "demo_store_a"
  | "demo_store_b"
  | "demo_store_c";

/**
 * `admin_url` = link produk dari admin, `search` = hasil pencarian otomatis,
 * `mock` = **data contoh, bukan harga nyata**.
 *
 * `mock` ada di sini supaya keaslian sebuah kutipan bisa dibaca dari datanya
 * sendiri. Alternatifnya — mencocokkan `marketplace` dengan daftar slug demo di
 * frontend — berarti daftar itu harus ditulis dua kali dan bisa berbeda diam-diam.
 */
export type PriceSource = "admin_url" | "search" | "manual" | "mock";

export type ValidationStatus = "valid" | "review" | "rejected";
export type ProductMatchStatus = "match" | "likely_match" | "uncertain" | "mismatch";
export type PriceAssessment =
  | "fair"
  | "potential_outlier"
  | "extreme_low"
  | "extreme_high"
  | "insufficient_data";
export type AIValidationStatus = "completed" | "fallback" | "unavailable" | "disabled" | "error";

export type DetectedProductAttributes = {
  is_bundle: boolean;
  is_ebook: boolean;
  is_preorder: boolean;
  is_used: boolean;
  is_non_book: boolean;
  condition_note?: string | null;
  detected_isbn?: string | null;
};

export type PriceStatistics = {
  sample_size: number;
  median_price: string | number | null;
  min_price: string | number | null;
  max_price: string | number | null;
  price_spread: string | number | null;
  is_reliable: boolean;
};

export type MarketplaceQuote = {
  marketplace: MarketplaceSlug;
  label: string;
  /** Backend mengirim `Decimal`, jadi JSON-nya berupa string — jangan diasumsikan number. */
  price: string | number;
  currency: string;
  product_url: string | null;
  product_title: string | null;
  seller_name: string | null;
  in_stock: boolean | null;
  match_score: number | null;
  source: PriceSource;
  fetched_at: string;
  validation_status?: ValidationStatus;
  match_status?: ProductMatchStatus;
  price_assessment?: PriceAssessment;
  confidence?: number;
  reasons?: string[];
  is_outlier?: boolean;
  deviation_percent?: number | null;
  attributes?: DetectedProductAttributes;
};

export type ValidatedMarketplaceQuote = MarketplaceQuote;

export type MarketplaceHistoryPoint = {
  price: string | number;
  fetched_at: string;
};

export type MarketplaceComparison = {
  book_id: string;
  book_title: string;
  /** Harga toko sendiri, dibaca backend dari tabel `books`. */
  store_price: string | number;
  /** Selalu terurut harga menaik; `quotes[0]` yang termurah. */
  quotes: MarketplaceQuote[];
  valid_offers?: ValidatedMarketplaceQuote[];
  review_offers?: ValidatedMarketplaceQuote[];
  rejected_offers?: ValidatedMarketplaceQuote[];
  price_statistics?: PriceStatistics | null;
  ai_validation_status?: AIValidationStatus;
  validation_summary?: string[];
  lowest_price: string | number | null;
  highest_price: string | number | null;
  /** Positif = ada marketplace yang lebih murah dari toko ini. */
  savings: string | number | null;
  history: Record<string, MarketplaceHistoryPoint[]>;
  fetched_at: string;
  from_cache: boolean;
  /** Marketplace yang gagal diambil; perbandingan tetap sah tanpa mereka. */
  warnings: string[];
};

export type MarketplaceInfo = {
  slug: MarketplaceSlug;
  label: string;
};

/** Satu sumber harga seperti yang dilihat admin di halaman pengelolaan. */
export type MarketplaceSource = {
  id: string;
  book_id: string;
  marketplace: MarketplaceSlug;
  label: string;
  /**
   * Link produk yang diisi admin. `null` berarti harga dicari otomatis lewat
   * `search_keyword` — bukan berarti sumbernya rusak; backend menolak sumber yang
   * tidak punya keduanya (`ck_marketplace_sources_target`).
   */
  product_url: string | null;
  search_keyword: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MarketplaceSourceInput = {
  book_id: string;
  marketplace: MarketplaceSlug;
  /** Minimal salah satu dari `product_url` / `search_keyword` harus diisi. */
  product_url?: string | null;
  search_keyword?: string | null;
  is_active?: boolean;
};

/** Patch parsial; hanya field yang dikirim yang diubah. Minimal satu field. */
export type MarketplaceSourceUpdate = {
  product_url?: string | null;
  search_keyword?: string | null;
  is_active?: boolean;
};

// --- AI Book Advisor Types ---
export type ReadingLevel = "beginner" | "intermediate" | "advanced";
export type PreferredStyle = "practical" | "theoretical" | "narrative" | "illustrative";
export type PreferredLength = "short" | "medium" | "long";
export type ConversationState = "collecting_preferences" | "ready_to_recommend" | "showing_recommendations";

export interface BookPreferences {
  interests: string[];
  genres: string[];
  reading_level: ReadingLevel | null;
  reading_goals: string[];
  preferred_style: PreferredStyle | null;
  preferred_language: string | null;
  min_budget: number | string | null;
  max_budget: number | string | null;
  preferred_length: PreferredLength | null;
  favorite_authors: string[];
  liked_books: string[];
  disliked_books: string[];
  format_preferences: string[];
  availability_preferences: "in_stock_only" | null;
}

export interface CandidateBook {
  id: string;
  title: string;
  author: string;
  price: string | number;
  stock: number;
  description?: string | null;
  cover_url?: string | null;
  category?: string | null;
}

export interface Recommendation {
  book: CandidateBook;
  reason: string;
  score: number;
}

export interface AdvisorChatRequest {
  message: string;
  session_id?: string | null;
}

export interface AdvisorChatResponse {
  session_id: string;
  assistant_message: string;
  conversation_state: ConversationState;
  preferences: BookPreferences;
  missing_preferences: string[];
  recommendations: Recommendation[];
  follow_up_question: string | null;
}

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AdvisorSessionRead {
  session_id: string;
  conversation_state: ConversationState;
  preferences: BookPreferences;
  messages: AdvisorMessage[];
}

export interface AdvisorFeedbackRequest {
  session_id: string;
  book_id: string;
  feedback: "liked" | "not_relevant";
  reason?: string | null;
}

