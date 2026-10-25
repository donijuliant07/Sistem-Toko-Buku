import { describe, expect, it, vi, beforeEach } from "vitest"

const adjustStockApi = vi.fn()
const getBooksApi = vi.fn()

vi.mock("@/lib/api", () => ({
  adjustStock: (...args: unknown[]) => adjustStockApi(...args),
  approvePayment: vi.fn(),
  createBook: vi.fn(),
  createPromo: vi.fn(),
  deleteBook: vi.fn(),
  deletePromo: vi.fn(),
  getAccessToken: vi.fn(async () => "token"),
  getAdminPayment: vi.fn(),
  getBooks: (...args: unknown[]) => getBooksApi(...args),
  getCategorySales: vi.fn(async () => []),
  getDashboardSummary: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrders: vi.fn(),
  getPromos: vi.fn(),
  getSalesTimeseries: vi.fn(async () => []),
  listAdminPayments: vi.fn(),
  rejectPayment: vi.fn(),
  updateBook: vi.fn(),
  updateOrderStatus: vi.fn(),
  updatePromo: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ order: async () => ({ data: [] }) }) }) }),
}))

import { productService } from "@/lib/services"

describe("productService.adjustStock", () => {
  beforeEach(() => {
    adjustStockApi.mockReset()
    getBooksApi.mockReset()
  })

  it("mengirim delta positif sebagai Restok ke POST /inventory/adjust", async () => {
    adjustStockApi.mockResolvedValue({ product_id: "b1", title: "Buku", stock_before: 3, stock_after: 23, sukses: true })

    const result = await productService.adjustStock("b1", 20, "Restok cepat dari dashboard")

    expect(adjustStockApi).toHaveBeenCalledWith({
      product_id: "b1",
      quantity: 20,
      type: "Restok",
      reason: "Restok cepat dari dashboard",
    })
    expect(result.stock_after).toBe(23)
  })

  it("mengirim delta negatif sebagai Penjualan", async () => {
    adjustStockApi.mockResolvedValue({ product_id: "b1", title: "Buku", stock_before: 10, stock_after: 8, sukses: true })

    await productService.adjustStock("b1", -2, "Koreksi stok")

    expect(adjustStockApi).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: -2, type: "Penjualan" })
    )
  })

  it("meneruskan error backend tanpa menelan pesannya", async () => {
    adjustStockApi.mockRejectedValue(new Error("STOK_TIDAK_CUKUP: stok tidak boleh negatif"))

    await expect(productService.adjustStock("b1", -99, "Koreksi")).rejects.toThrow("STOK_TIDAK_CUKUP")
  })
})

describe("productService.getAll", () => {
  beforeEach(() => {
    getBooksApi.mockReset()
  })

  it("tidak mengarang jumlah terjual dari stok", async () => {
    getBooksApi.mockResolvedValue({
      items: [{ id: "b1", title: "Buku", author: "Penulis", isbn: "1", price: "85000", stock: 7 }],
      total: 1,
      page: 1,
      page_size: 100,
    })

    const [product] = await productService.getAll()

    expect(product.normalPrice).toBe(85000)
    expect(product.sold).toBe(0)
  })

  it("mengembalikan daftar kosong, bukan produk contoh, saat server gagal", async () => {
    getBooksApi.mockRejectedValue(new Error("network"))

    await expect(productService.getAll()).resolves.toEqual([])
  })
})
