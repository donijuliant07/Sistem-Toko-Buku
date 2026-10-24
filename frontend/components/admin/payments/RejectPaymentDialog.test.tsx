import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { RejectPaymentDialog } from "@/components/admin/payments/RejectPaymentDialog"

describe("RejectPaymentDialog", () => {
  it("tombol tolak nonaktif sampai alasan mencapai 10 karakter", async () => {
    const onConfirm = vi.fn()
    render(
      <RejectPaymentDialog
        open
        onOpenChange={vi.fn()}
        orderNumber="INV-001"
        loading={false}
        onConfirm={onConfirm}
      />
    )

    const submit = screen.getByRole("button", { name: /Tolak pembayaran/ })
    expect(submit).toBeDisabled()

    const textarea = screen.getByLabelText(/Alasan penolakan/)
    fireEvent.change(textarea, { target: { value: "salah" } })
    expect(submit).toBeDisabled()

    fireEvent.change(textarea, { target: { value: "Nominal transfer tidak sesuai" } })
    expect(submit).toBeEnabled()

    fireEvent.click(submit)
    expect(onConfirm).toHaveBeenCalledWith("Nominal transfer tidak sesuai")
  })

  it("alasan hanya berisi spasi tetap dianggap kosong", () => {
    render(
      <RejectPaymentDialog
        open
        onOpenChange={vi.fn()}
        orderNumber="INV-001"
        loading={false}
        onConfirm={vi.fn()}
      />
    )
    fireEvent.change(screen.getByLabelText(/Alasan penolakan/), {
      target: { value: "                " },
    })
    expect(screen.getByRole("button", { name: /Tolak pembayaran/ })).toBeDisabled()
  })

  it("tidak bisa ditutup selagi memproses", () => {
    const onOpenChange = vi.fn()
    render(
      <RejectPaymentDialog
        open
        onOpenChange={onOpenChange}
        orderNumber="INV-001"
        loading
        onConfirm={vi.fn()}
      />
    )
    const cancel = screen.getByRole("button", { name: "Batal" })
    fireEvent.click(cancel)
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})