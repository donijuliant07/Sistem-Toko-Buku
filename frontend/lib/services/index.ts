import { ProductCategory } from "@/types"
import { initialProducts } from "@/data/products"
import { initialOrders } from "@/data/orders"
import { initialCustomers } from "@/data/customers"
import { initialPromos } from "@/data/promos"
import { Product, Order, Customer, Promo, KPICardData } from "@/types"

// In-memory store untuk simulasi CRUD selama runtime frontend
let productsStore: Product[] = [...initialProducts]
const ordersStore: Order[] = [...initialOrders]
const customersStore: Customer[] = [...initialCustomers]
let promosStore: Promo[] = [...initialPromos]

export interface SalesDataItem {
  date: string
  buku: number
  nonBuku: number
}

export interface CategorySalesItem {
  category: ProductCategory
  sales: number
}

// Product Service
export const productService = {
  getAll: async (): Promise<Product[]> => {
    return [...productsStore]
  },
  getById: async (id: string): Promise<Product | undefined> => {
    return productsStore.find((p) => p.id === id)
  },
  create: async (data: Omit<Product, "id" | "createdAt" | "updatedAt" | "sold" | "finalPrice">): Promise<Product> => {
    const finalPrice = Math.round(data.normalPrice * (1 - (data.discountPercent || 0) / 100))
    const newProduct: Product = {
      ...data,
      id: `prod-${Date.now()}`,
      sold: 0,
      finalPrice,
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
    }
    productsStore = [newProduct, ...productsStore]
    return newProduct
  },
  update: async (id: string, data: Partial<Product>): Promise<Product> => {
    const index = productsStore.findIndex((p) => p.id === id)
    if (index === -1) throw new Error("Produk tidak ditemukan")
    const existing = productsStore[index]
    const normalPrice = data.normalPrice ?? existing.normalPrice
    const discountPercent = data.discountPercent ?? existing.discountPercent
    const finalPrice = Math.round(normalPrice * (1 - discountPercent / 100))

    const updated: Product = {
      ...existing,
      ...data,
      normalPrice,
      discountPercent,
      finalPrice,
      updatedAt: new Date().toISOString().split("T")[0],
    }
    productsStore[index] = updated
    return updated
  },
  delete: async (id: string): Promise<boolean> => {
    const prevLen = productsStore.length
    productsStore = productsStore.filter((p) => p.id !== id)
    return productsStore.length < prevLen
  },
  adjustStock: async (id: string, newStock: number): Promise<Product> => {
    const status = newStock <= 0 ? "Habis" : "Aktif"
    return productService.update(id, { stock: newStock, status })
  },
  getLowStock: async (threshold = 10): Promise<Product[]> => {
    return productsStore.filter((p) => p.stock <= threshold && p.status === "Aktif")
  },
}

// Order Service
export const orderService = {
  getAll: async (): Promise<Order[]> => {
    return [...ordersStore]
  },
  getById: async (id: string): Promise<Order | undefined> => {
    return ordersStore.find((o) => o.id === id || o.orderNumber === id)
  },
  updateStatus: async (id: string, status: Order["status"], note?: string): Promise<Order> => {
    const index = ordersStore.findIndex((o) => o.id === id)
    if (index === -1) throw new Error("Pesanan tidak ditemukan")
    const existing = ordersStore[index]
    const timelineEntry = {
      status,
      timestamp: new Date().toISOString(),
      description: note || `Status diubah menjadi ${status}`,
    }
    const updated: Order = {
      ...existing,
      status,
      timeline: [timelineEntry, ...existing.timeline],
    }
    ordersStore[index] = updated
    return updated
  },
}

// Customer Service
export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    return [...customersStore]
  },
  getById: async (id: string): Promise<Customer | undefined> => {
    return customersStore.find((c) => c.id === id)
  },
}

// Promo Service
export const promoService = {
  getAll: async (): Promise<Promo[]> => {
    return [...promosStore]
  },
  toggleActive: async (id: string): Promise<Promo> => {
    const index = promosStore.findIndex((p) => p.id === id)
    if (index === -1) throw new Error("Promo tidak ditemukan")
    const existing = promosStore[index]
    const updated: Promo = {
      ...existing,
      isActive: !existing.isActive,
      status: !existing.isActive ? "Aktif" : "Kadaluarsa",
    }
    promosStore[index] = updated
    return updated
  },
  create: async (data: Omit<Promo, "id" | "usedCount">): Promise<Promo> => {
    const newPromo: Promo = {
      ...data,
      id: `prm-${Date.now()}`,
      usedCount: 0,
    }
    promosStore = [newPromo, ...promosStore]
    return newPromo
  },
}

// Analytics / KPI Service
export const analyticsService = {
  getKPIData: async (): Promise<KPICardData[]> => {
    const totalRevenue = ordersStore
      .filter((o) => o.status === "Selesai" || o.status === "Dikirim")
      .reduce((acc, o) => acc + o.totalAmount, 0)
    const newOrders = ordersStore.filter((o) => o.status === "Diproses" || o.status === "Menunggu Pembayaran").length
    const activeCustomers = customersStore.filter((c) => c.status === "Aktif").length

    return [
      {
        title: "Total Pendapatan",
        value: new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(totalRevenue),
        rawNumeric: totalRevenue,
        trendPercent: 12.5,
        isPositive: true,
        description: "+12,5% dari bulan lalu",
      },
      {
        title: "Pesanan Baru",
        value: `+${newOrders}`,
        rawNumeric: newOrders,
        trendPercent: 8.2,
        isPositive: true,
        description: "+8,2% minggu ini",
      },
      {
        title: "Pelanggan Aktif",
        value: activeCustomers.toString(),
        rawNumeric: activeCustomers,
        trendPercent: 4.3,
        isPositive: true,
        description: "+18 akun baru terdaftar",
      },
      {
        title: "Rasio Pertumbuhan",
        value: "+18,4%",
        rawNumeric: 18.4,
        trendPercent: 2.1,
        isPositive: true,
        description: "+2,1% di atas target Q4",
      },
    ]
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
