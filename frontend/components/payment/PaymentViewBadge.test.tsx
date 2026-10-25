import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PaymentViewBadge, PAYMENT_VIEW_META } from "@/components/payment/PaymentViewBadge"
import type { PaymentStatusView } from "@/lib/types"

const ALL: PaymentStatusView[] = ["pending", "under_review", "paid", "rejected", "expired", "refunded"]

describe("PaymentViewBadge", () => {
  it.each(ALL)("merender label untuk %s", (status) => {
    render(<PaymentViewBadge status={status} />)
    expect(screen.getByText(PAYMENT_VIEW_META[status].label)).toBeInTheDocument()
  })

  it("menyebut under_review sebagai menunggu verifikasi, bukan lunas", () => {
    expect(PAYMENT_VIEW_META.under_review.label).toBe("Menunggu Verifikasi")
    render(<PaymentViewBadge status="under_review" />)
    expect(screen.queryByText("Lunas")).not.toBeInTheDocument()
  })
})