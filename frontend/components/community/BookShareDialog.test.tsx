import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const getBooks = vi.fn()
vi.mock("@/lib/api", () => ({
  getBooks: (...args: unknown[]) => getBooks(...args),
}))

import { BookShareDialog } from "@/components/community/BookShareDialog"

const BOOK = {
  id: "b1",
  title: "Bumi Manusia",
  author: "Pramoedya",
  isbn: "978",
  description: null,
  price: 95000,
  stock: 3,
  cover_url: null,
  created_at: "",
  updated_at: "",
}

describe("BookShareDialog", () => {
  beforeEach(() => {
    getBooks.mockReset()
    getBooks.mockResolvedValue({ items: [BOOK], total: 1, page: 1, page_size: 12 })
  })

  it("menutup dialog hanya setelah buku benar-benar terkirim", async () => {
    const onOpenChange = vi.fn()
    const onPick = vi.fn().mockResolvedValue(true)
    render(<BookShareDialog open onOpenChange={onOpenChange} onPick={onPick} />)

    fireEvent.click(await screen.findByText("Bumi Manusia"))

    await waitFor(() => expect(onPick).toHaveBeenCalledWith("b1"))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("tetap terbuka saat pengiriman gagal, tanpa toast sukses", async () => {
    const onOpenChange = vi.fn()
    const onPick = vi.fn().mockResolvedValue(false)
    render(<BookShareDialog open onOpenChange={onOpenChange} onPick={onPick} />)

    fireEvent.click(await screen.findByText("Bumi Manusia"))

    await waitFor(() => expect(onPick).toHaveBeenCalledWith("b1"))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByText("Bumi Manusia")).toBeInTheDocument()
  })
})
