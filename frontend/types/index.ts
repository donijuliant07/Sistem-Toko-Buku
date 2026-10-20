export type ProductCategory =
  | "Fiksi"
  | "Non-Fiksi"
  | "Pendidikan & Referensi"
  | "Bisnis & Keuangan"
  | "Pengembangan Diri"
  | "Anak-Anak & Remaja"
  | "Komik & Graphic Novel"
  | "Agama & Spiritual"
  | "Alat Tulis & Kantor"
  | "Aksesori & Merchandise"

export type ProductType = "Buku" | "Non-Buku"
export type ProductStatus = "Aktif" | "Draft" | "Habis"

export interface Product {
  id: string
  title: string
  author: string
  publisher: string
  isbn: string
  category: ProductCategory
  type: ProductType
  language: "Indonesia" | "Inggris" | "Lainnya"
  pages: number
  weight: number // dalam gram
  normalPrice: number
  discountPercent: number
  finalPrice: number
  stock: number
  sold: number
  status: ProductStatus
  coverUrl: string
  description: string
  createdAt: string
  updatedAt: string
}

export type OrderStatus =
  | "Menunggu Pembayaran"
  | "Dibayar"
  | "Diproses"
  | "Dikirim"
  | "Selesai"
  | "Batal"
  | "Kedaluwarsa"

export type PaymentMethod =
  | "BCA Virtual Account"
  | "Mandiri VA"
  | "GoPay"
  | "OVO"
  | "QRIS"
  | "Kartu Kredit"
  | "Transfer Bank"

export type OrderPaymentStatus = "Belum Dibayar" | "Lunas" | "Gagal" | "Kedaluwarsa" | "Dikembalikan"

export interface OrderItem {
  productId: string
  productTitle: string
  coverUrl: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface OrderTimeline {
  status: OrderStatus
  timestamp: string
  description: string
}

export interface Order {
  id: string
  orderNumber: string
  customerId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  courier: string
  trackingNumber?: string
  paymentMethod: PaymentMethod
  /** Status baris `payments` (dikonfirmasi admin), terpisah dari `status` pesanan. */
  paymentStatus: OrderPaymentStatus
  items: OrderItem[]
  subtotal: number
  shippingFee: number
  discountAmount: number
  totalAmount: number
  status: OrderStatus
  createdAt: string
  timeline: OrderTimeline[]
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  city: string
  totalOrders: number
  totalSpent: number
  joinedAt: string
  avatarUrl?: string
  status: "Aktif" | "Nonaktif"
}

// Tipe Promo tinggal satu sumber: lihat `lib/types.ts` (mengikuti tabel
// `promos` di Supabase, bukan lagi bentuk data mock).
export type { Promo, PromoInput, PromoUpdate, PromoDiscountType, PromoStatus } from "@/lib/types"

export interface KPICardData {
  title: string
  value: string
  rawNumeric: number
  trendPercent: number
  isPositive: boolean
  description: string
}
