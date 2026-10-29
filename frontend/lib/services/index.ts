import { ProductCategory } from "@/types"
import { Product, Order, Customer, KPICardData, OrderStatus } from "@/types"
import {
  adjustStock as adjustStockRequest,
  approvePayment,
  createBook,
  createPromo,
  deleteBook,
  deletePromo,
  getAccessToken,
  getAdminPayment,
  getBooks,
  getCategorySales as getCategorySalesRequest,
  getDashboardSummary,
  getOrderDetail,
  getOrders,
  getPromos,
  getSalesTimeseries,
  listAdminPayments,
  rejectPayment,
  updateBook,
  updateOrderStatus,
  updatePromo,
} from "@/lib/api"
import type {
  Book,
  BookUpdate,
  Order as ApiOrder,
  OrderStatus as ApiOrderStatus,
  OrderPayment,
  PaymentDetail,
  PaymentPage,
  PaymentStatus as ApiPaymentStatus,
  PaymentStatusView,
  Promo,
  PromoInput,
  PromoUpdate,
  StockAdjustmentResult,
} from "@/lib/types"
import { createClient } from "@/lib/supabase"

const supabase = createClient()

/** Bentuk baris `books` dari fallback REST Supabase (tanpa generics). */
type SupabaseBookRow = {
  id: string
  title: string
  author: string
  isbn: string
  price: string | number
  stock: number
  weight_gram?: number | null
  description?: string | null
  cover_url?: string | null
  created_at?: string | null
  updated_at?: string | null
}

// Status API (huruf kecil) -> label admin yang sudah dipakai UI. Nilai API
// mengikuti CHECK constraint database live (`orders_status_check`), jadi
// "processing"/"cancelled", bukan "diproses"/"dibatalkan".
const API_TO_ADMIN_STATUS: Record<string, OrderStatus> = {
  pending: "Menunggu Pembayaran",
  paid: "Dibayar",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  cancelled: "Batal",
  expired: "Kedaluwarsa",
}

const ADMIN_TO_API_STATUS: Record<OrderStatus, ApiOrderStatus> = {
  "Menunggu Pembayaran": "pending",
  Dibayar: "paid",
  Diproses: "processing",
  Dikirim: "shipped",
  Selesai: "completed",
  Batal: "cancelled",
  Kedaluwarsa: "expired",
}

// `payments.status` -> label admin. Backend hanya memberi poin pembelian dan
// membuka ulasan AI untuk pesanan `completed`, jadi label "Lunas" di sini
// berarti admin sudah mengonfirmasi uang masuk.
const API_TO_ADMIN_PAYMENT: Record<ApiPaymentStatus, Order["paymentStatus"]> = {
  pending: "Belum Dibayar",
  success: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
  refunded: "Dikembalikan",
}

function toAdminOrder(order: ApiOrder): Order {
  return {
    id: order.id,
    orderNumber: order.order_number,
    customerId: order.user_id ?? "",
    customerName: order.customer_name ?? "-",
    customerEmail: order.customer_email ?? "",
    customerPhone: order.customer_phone ?? "",
    shippingAddress: order.shipping_address,
    courier: [order.courier, order.courier_service].filter(Boolean).join(" - "),
    trackingNumber: order.tracking_number ?? undefined,
    paymentMethod: (order.payment_method ?? "-") as Order["paymentMethod"],
    paymentStatus: API_TO_ADMIN_PAYMENT[order.payment_status] ?? "Belum Dibayar",
    items: order.items.map((item) => ({
      productId: item.book_id,
      productTitle: item.title ?? "-",
      coverUrl: item.cover_url ?? "",
      unitPrice: item.unit_price,
      quantity: item.quantity,
      subtotal: item.total_price,
    })),
    subtotal: order.subtotal,
    shippingFee: order.shipping_fee,
    discountAmount: order.discount_amount,
    totalAmount: order.total_amount,
    status: API_TO_ADMIN_STATUS[order.status] ?? "Menunggu Pembayaran",
    createdAt: order.created_at,
    // Riwayat status tidak disimpan di skema live; timeline diisi satu entri.
    timeline: [
      { status: API_TO_ADMIN_STATUS[order.status] ?? "Menunggu Pembayaran", timestamp: order.created_at, description: "Status pesanan saat ini" },
    ],
  }
}

export interface SalesDataItem {
  date: string
  buku: number
  nonBuku: number
}

export interface CategorySalesItem {
  category: ProductCategory
  sales: number
}

// Product Service - Connected to Backend API & Supabase
export const productService = {
  getAll: async (): Promise<Product[]> => {
    try {
      const pageData = await getBooks(1, "", 100)
      if (pageData && pageData.items && pageData.items.length > 0) {
        return pageData.items.map((b: Book) => {
          const normalPrice = typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000
          return {
            id: b.id,
            title: b.title,
            author: b.author,
            publisher: "Readr",
            isbn: b.isbn,
            category: "Fiksi" as ProductCategory,
            type: "Buku",
            language: "Indonesia",
            pages: 250,
            weight: 300,
            normalPrice,
            discountPercent: 0,
            finalPrice: normalPrice,
            stock: b.stock,
            status: b.stock > 0 ? "Aktif" : "Habis",
            description: b.description || "Deskripsi buku.",
            coverUrl: b.cover_url || "",
            // `books` tidak menyimpan rating maupun jumlah terjual; jangan
            // mengarang angkanya.
            rating: 0,
            sold: 0,
            createdAt: b.created_at || new Date().toISOString().split("T")[0],
            updatedAt: b.updated_at || new Date().toISOString().split("T")[0],
          }
        })
      }
    } catch {
      // Fallback direct Supabase
      try {
        const { data } = await supabase.from("books").select("*").order("created_at", { ascending: false })
        if (data && data.length > 0) {
          return (data as SupabaseBookRow[]).map((b) => {
            const normalPrice = typeof b.price === "number" ? b.price : parseFloat(b.price) || 85000
            return {
              id: b.id,
              title: b.title,
              author: b.author,
              publisher: "Readr",
              isbn: b.isbn,
              category: "Fiksi" as ProductCategory,
              type: "Buku",
              language: "Indonesia",
              pages: 250,
              weight: b.weight_gram || 300,
              normalPrice,
              discountPercent: 0,
              finalPrice: normalPrice,
              stock: b.stock,
              status: b.stock > 0 ? "Aktif" : "Habis",
              description: b.description || "Deskripsi buku.",
              coverUrl: b.cover_url || "",
              rating: 0,
              sold: 0,
              createdAt: b.created_at || new Date().toISOString().split("T")[0],
              updatedAt: b.updated_at || new Date().toISOString().split("T")[0],
            }
          })
        }
      } catch {
        // Fallback Supabase juga gagal; biarkan pemanggil melihat daftar kosong
        // daripada menampilkan produk contoh yang tidak ada di database.
      }
    }
    return []
  },
  getById: async (id: string): Promise<Product | undefined> => {
    const all = await productService.getAll()
    return all.find((p) => p.id === id)
  },
  create: async (data: Omit<Product, "id" | "createdAt" | "updatedAt" | "sold" | "finalPrice">): Promise<Product> => {
    const finalPrice = Math.round(data.normalPrice * (1 - (data.discountPercent || 0) / 100))

    // Tulis lewat backend: `books` tidak lagi bisa di-INSERT dari browser
    // (policy `books_allow_insert` sudah dihapus), dan backend memverifikasi
    // bahwa pemanggil benar-benar admin.
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")

    const created = await createBook(
      {
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        description: data.description,
        price: data.normalPrice,
        stock: data.stock,
        cover_url: data.coverUrl,
      },
      token
    )

    return {
      ...data,
      id: created.id,
      sold: 0,
      finalPrice,
      createdAt: created.created_at || new Date().toISOString().split("T")[0],
      updatedAt: created.updated_at || new Date().toISOString().split("T")[0],
    }
  },
  update: async (id: string, data: Partial<Product>): Promise<Product> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")

    const updatePayload: BookUpdate = {}
    if (data.title !== undefined) updatePayload.title = data.title
    if (data.author !== undefined) updatePayload.author = data.author
    if (data.isbn !== undefined) updatePayload.isbn = data.isbn
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.normalPrice !== undefined) updatePayload.price = data.normalPrice
    if (data.stock !== undefined) updatePayload.stock = data.stock
    if (data.coverUrl !== undefined) updatePayload.cover_url = data.coverUrl

    if (Object.keys(updatePayload).length > 0) {
      await updateBook(id, updatePayload, token)
    }

    const fetched = await productService.getById(id)
    if (!fetched) throw new Error("Produk tidak ditemukan")
    return { ...fetched, ...data }
  },
  delete: async (id: string): Promise<boolean> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")

    await deleteBook(id, token)
    return true
  },
  adjustStock: async (
    id: string,
    delta: number,
    reason: string
  ): Promise<StockAdjustmentResult> => {
    // Lewat `POST /inventory/adjust`, bukan PATCH `books`: backend menghitung
    // stok akhir dari stok tersimpan dan menolak hasil negatif.
    return adjustStockRequest({
      product_id: id,
      quantity: delta,
      type: delta >= 0 ? "Restok" : "Penjualan",
      reason,
    })
  },
  getLowStock: async (threshold = 10): Promise<Product[]> => {
    const all = await productService.getAll()
    return all.filter((p) => p.stock <= threshold && p.status === "Aktif")
  },
}

// Order Service - Connected to Backend API
export const orderService = {
  getAll: async (): Promise<Order[]> => {
    const token = await getAccessToken()
    if (!token) return []
    const res = await getOrders(token, 1, 100)
    return res.data.map(toAdminOrder)
  },
  getById: async (id: string): Promise<Order | undefined> => {
    const token = await getAccessToken()
    if (!token) return undefined
    const res = await getOrderDetail(id, token)
    return toAdminOrder(res.data)
  },
  updateStatus: async (id: string, status: OrderStatus, note?: string): Promise<Order> => {
    // Skema live tidak punya kolom catatan pada `orders`.
    void note
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")
    await updateOrderStatus(id, ADMIN_TO_API_STATUS[status], token)
    const refreshed = await orderService.getById(id)
    if (!refreshed) throw new Error("Pesanan tidak ditemukan")
    return refreshed
  },
}

/**
 * Verifikasi pembayaran manual. Keputusan approve/reject hanya lewat endpoint
 * admin di backend; di sini tidak ada cara menulis status pembayaran langsung.
 */
export const paymentService = {
  getAll: async (params: {
    page?: number
    limit?: number
    status?: PaymentStatusView
    search?: string
  }): Promise<PaymentPage> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")
    return listAdminPayments(params, token)
  },
  getById: async (paymentId: string): Promise<PaymentDetail> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")
    const res = await getAdminPayment(paymentId, token)
    return res.data
  },
  approve: async (paymentId: string): Promise<OrderPayment> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")
    const res = await approvePayment(paymentId, token)
    return res.data
  },
  reject: async (paymentId: string, reason: string): Promise<OrderPayment> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")
    const res = await rejectPayment(paymentId, reason, token)
    return res.data
  },
}

// Pelanggan tidak punya tabelnya sendiri di skema live; ringkasan pemesan
// diturunkan dari pesanan yang masuk.
export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    const orders = await orderService.getAll()
    const byEmail = new Map<string, Customer>()
    for (const order of orders) {
      const key = order.customerEmail || order.customerId
      const existing = byEmail.get(key)
      if (existing) {
        existing.totalOrders += 1
        existing.totalSpent += order.totalAmount
        continue
      }
      byEmail.set(key, {
        id: order.customerId,
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
        city: "-",
        totalOrders: 1,
        totalSpent: order.totalAmount,
        joinedAt: order.createdAt,
        status: "Aktif",
      })
    }
    return [...byEmail.values()]
  },
  getById: async (id: string): Promise<Customer | undefined> => {
    return (await customerService.getAll()).find((c) => c.id === id)
  },
}

// Promo Service — membaca tabel `promos` di Supabase lewat backend.
// Status promo dihitung server (`is_active` + rentang tanggal), jadi tidak ada
// kolom status yang bisa basi seperti versi mock sebelumnya.
export const promoService = {
  getAll: async (): Promise<Promo[]> => {
    return getPromos()
  },
  create: async (data: PromoInput): Promise<Promo> => {
    return createPromo(data)
  },
  update: async (id: string, data: PromoUpdate): Promise<Promo> => {
    return updatePromo(id, data)
  },
  toggleActive: async (id: string, isActive: boolean): Promise<Promo> => {
    return updatePromo(id, { is_active: isActive })
  },
  delete: async (id: string): Promise<void> => {
    return deletePromo(id)
  },
}

// Analytics service — seluruh angka berasal dari endpoint `/dashboard/*`.
// Ketujuh kartu KPI sebelumnya dirakit di sini dengan beberapa angka hardcoded
// (tren 12.5%, 5.2%, 8.4%) dan mengabaikan `GET /dashboard/summary` yang sudah
// menghitung omset, pesanan, buku terjual, pelanggan aktif, dan stok kritis.
export const analyticsService = {
  /** Kartu KPI dashboard, dipetakan dari `DashboardKpi` ke bentuk kartu yang sudah ada. */
  getKPIData: async (): Promise<KPICardData[]> => {
    try {
      const summary = await getDashboardSummary()
      const currency = (amount: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)

      return [
        {
          title: "Total Pendapatan",
          value: currency(summary.total_omset),
          rawNumeric: summary.total_omset,
          trendPercent: 0,
          isPositive: true,
          description: `${summary.total_orders} pesanan tercatat`,
        },
        {
          title: "Total Pesanan",
          value: summary.total_orders.toLocaleString("id-ID"),
          rawNumeric: summary.total_orders,
          trendPercent: 0,
          isPositive: true,
          description: "Pesanan tidak dibatalkan",
        },
        {
          title: "Pelanggan Aktif",
          value: summary.active_customers.toLocaleString("id-ID"),
          rawNumeric: summary.active_customers,
          trendPercent: 0,
          isPositive: true,
          description: "Akun pelanggan terdaftar",
        },
        {
          title: "Buku Terjual",
          value: `${summary.total_books_sold.toLocaleString("id-ID")} unit`,
          rawNumeric: summary.total_books_sold,
          trendPercent: 0,
          isPositive: true,
          description: "Akumulasi item pada pesanan aktif",
        },
        {
          title: "Status Stok Kritis",
          value: `${summary.low_stock_count} judul`,
          rawNumeric: summary.low_stock_count,
          trendPercent: 0,
          isPositive: summary.low_stock_count === 0,
          description: "Judul dengan stok ≤ 5",
        },
      ]
    } catch {
      // Gagal memuat bukan alasan menampilkan angka palsu; pemanggil menampilkan
      // pesan error dari `loadAllData`.
      return []
    }
  },
  getSalesChartData: async (period: "7d" | "30d" | "90d"): Promise<SalesDataItem[]> => {
    // Data nyata dari `GET /dashboard/sales-chart`. Nama kolom API dipetakan ke
    // bentuk yang sudah dipakai grafik supaya tampilan tidak berubah.
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
    const series = await getSalesTimeseries(days)
    return series.map((row) => ({
      date: row.date_label,
      buku: row.buku_amount,
      nonBuku: row.non_buku_amount,
    }))
  },
  getCategorySales: async (): Promise<CategorySalesItem[]> => {
    const rows = await getCategorySalesRequest()
    return rows.map((row) => ({
      category: row.category_name as ProductCategory,
      sales: row.sales_count,
    }))
  },
}
