import { ProductCategory } from "@/types"
import { initialProducts } from "@/data/products"
import { Product, Order, Customer, KPICardData, OrderStatus } from "@/types"
import {
  approvePayment,
  createBook,
  createPromo,
  deleteBook,
  deletePromo,
  getAccessToken,
  getAdminPayment,
  getBooks,
  getOrderDetail,
  getOrders,
  getPromos,
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

// In-memory store untuk fallback & data non-buku
let productsStore: Product[] = [...initialProducts]

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
            publisher: "InforBook",
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
            rating: 4.8,
            sold: b.stock * 3,
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
              publisher: "InforBook",
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
              rating: 4.8,
              sold: b.stock * 3,
              createdAt: b.created_at || new Date().toISOString().split("T")[0],
              updatedAt: b.updated_at || new Date().toISOString().split("T")[0],
            }
          })
        }
      } catch {
        // Fallback store
      }
    }
    return [...productsStore]
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
    const normalPrice = data.normalPrice
    const discountPercent = data.discountPercent

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

    const index = productsStore.findIndex((p) => p.id === id)
    if (index !== -1) {
      const existing = productsStore[index]
      const np = normalPrice ?? existing.normalPrice
      const dp = discountPercent ?? existing.discountPercent
      const fp = Math.round(np * (1 - dp / 100))
      const updated: Product = {
        ...existing,
        ...data,
        normalPrice: np,
        discountPercent: dp,
        finalPrice: fp,
        updatedAt: new Date().toISOString().split("T")[0],
      }
      productsStore[index] = updated
      return updated
    }

    const fetched = await productService.getById(id)
    if (!fetched) throw new Error("Produk tidak ditemukan")
    return { ...fetched, ...data }
  },
  delete: async (id: string): Promise<boolean> => {
    const token = await getAccessToken()
    if (!token) throw new Error("Sesi login tidak ditemukan.")

    await deleteBook(id, token)

    const prevLen = productsStore.length
    productsStore = productsStore.filter((p) => p.id !== id)
    return productsStore.length < prevLen
  },
  adjustStock: async (id: string, newStock: number): Promise<Product> => {
    const status = newStock <= 0 ? "Habis" : "Aktif"
    return productService.update(id, { stock: newStock, status })
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

// Analytics / KPI Service
export const analyticsService = {
  getKPIData: async (): Promise<KPICardData[]> => {
    try {
      const pageData = await getBooks(1, "", 1)
      const totalBooks = pageData.total || 0

      const allBooks = await productService.getAll()
      const totalStock = allBooks.reduce((acc, b) => acc + (b.stock || 0), 0)
      const lowStock = allBooks.filter((b) => b.stock <= 5).length
      const activeProducts = allBooks.filter((b) => b.stock > 0).length

      // Calculate total catalog inventory value
      const totalInventoryVal = allBooks.reduce((acc, b) => acc + (b.normalPrice * b.stock), 0)

      // Pesanan nyata dari API; tidak ada lagi angka mock di kartu pesanan.
      const realOrders = await orderService.getAll()
      const revenue = realOrders
        .filter((o) => o.status !== "Batal")
        .reduce((acc, o) => acc + o.totalAmount, 0)
      const newOrders = realOrders.filter((o) => o.status === "Menunggu Pembayaran" || o.status === "Diproses").length

      return [
        {
          title: "Total Pendapatan",
          value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(revenue),
          rawNumeric: revenue,
          trendPercent: 0,
          isPositive: true,
          description: `${realOrders.length} pesanan tercatat`,
        },
        {
          title: "Pesanan Baru",
          value: `+${newOrders}`,
          rawNumeric: newOrders,
          trendPercent: 0,
          isPositive: true,
          description: "Menunggu pembayaran atau diproses",
        },
        {
          title: "Pelanggan Aktif",
          value: `${new Set(realOrders.map((o) => o.customerEmail)).size}`,
          rawNumeric: new Set(realOrders.map((o) => o.customerEmail)).size,
          trendPercent: 0,
          isPositive: true,
          description: "Pemesan unik di pesanan tercatat",
        },
        {
          title: "Total Judul Buku",
          value: totalBooks.toString(),
          rawNumeric: totalBooks,
          trendPercent: 12.5,
          isPositive: true,
          description: "Judul terdaftar di database Supabase",
        },
        {
          title: "Total Stok Fisik",
          value: `${totalStock.toLocaleString("id-ID")} unit`,
          rawNumeric: totalStock,
          trendPercent: 5.2,
          isPositive: true,
          description: "Total seluruh eksemplar toko",
        },
        {
          title: "Nilai Inventori",
          value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalInventoryVal),
          rawNumeric: totalInventoryVal,
          trendPercent: 8.4,
          isPositive: true,
          description: "Estimasi total nilai buku aktif",
        },
        {
          title: "Status Stok Kritis",
          value: `${lowStock} judul`,
          rawNumeric: lowStock,
          trendPercent: 0,
          isPositive: lowStock === 0,
          description: `${activeProducts} judul stok siap kirim`,
        },
      ]
    } catch {
      // Fallback tanpa angka mock: nilai nol lebih jujur daripada data palsu.
      return [
        {
          title: "Total Pendapatan",
          value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(0),
          rawNumeric: 0,
          trendPercent: 0,
          isPositive: true,
          description: "Gagal memuat data pesanan",
        },
        {
          title: "Pesanan Baru",
          value: "+0",
          rawNumeric: 0,
          trendPercent: 0,
          isPositive: true,
          description: "Gagal memuat data pesanan",
        },
        {
          title: "Pelanggan Aktif",
          value: "0",
          rawNumeric: 0,
          trendPercent: 0,
          isPositive: true,
          description: "Gagal memuat data pesanan",
        },
        {
          title: "Rasio Pertumbuhan",
          value: "0%",
          rawNumeric: 0,
          trendPercent: 0,
          isPositive: true,
          description: "Gagal memuat data pesanan",
        },
      ]
    }
  },
  getSalesChartData: async (period: "7d" | "30d" | "90d"): Promise<SalesDataItem[]> => {
    if (period === "7d") {
      return [
        { date: "Sen", buku: 1850000, nonBuku: 650000 },
        { date: "Sel", buku: 2200000, nonBuku: 800000 },
        { date: "Rab", buku: 1950000, nonBuku: 720000 },
        { date: "Kam", buku: 2800000, nonBuku: 910000 },
        { date: "Jum", buku: 3400000, nonBuku: 1250000 },
        { date: "Sab", buku: 4800000, nonBuku: 1600000 },
        { date: "Min", buku: 5200000, nonBuku: 1950000 },
      ]
    }
    if (period === "30d") {
      return Array.from({ length: 30 }).map((_, i) => ({
        date: `Tgl ${i + 1}`,
        buku: Math.floor(1500000 + ((i * 70000) % 2000000)),
        nonBuku: Math.floor(500000 + ((i * 30000) % 900000)),
      }))
    }
    return [
      { date: "Agustus", buku: 68500000, nonBuku: 21400000 },
      { date: "September", buku: 79200000, nonBuku: 24800000 },
      { date: "Oktober", buku: 88900000, nonBuku: 28300000 },
    ]
  },
  getCategorySales: async (): Promise<CategorySalesItem[]> => {
    return [
      { category: "Fiksi", sales: 420 },
      { category: "Pengembangan Diri", sales: 380 },
      { category: "Non-Fiksi", sales: 290 },
      { category: "Komik & Graphic Novel", sales: 340 },
      { category: "Bisnis & Keuangan", sales: 260 },
      { category: "Pendidikan & Referensi", sales: 310 },
      { category: "Alat Tulis & Kantor", sales: 220 },
    ]
  },
}
