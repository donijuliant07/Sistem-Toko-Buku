import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

const uploadPaymentProof = vi.fn()
vi.mock("@/lib/api", () => ({
  uploadPaymentProof: (...args: unknown[]) => uploadPaymentProof(...args),
}))

import { ProofUpload } from "@/components/payment/ProofUpload"

const JPEG = new File([new Uint8Array([0xff, 0xd8, 0xff])], "bukti.jpg", { type: "image/jpeg" })

function fileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("input file tidak ditemukan")
  return input
}

describe("ProofUpload", () => {
  beforeEach(() => {
    uploadPaymentProof.mockReset()
    // jsdom tidak punya URL.createObjectURL
    URL.createObjectURL = vi.fn(() => "blob:preview")
    URL.revokeObjectURL = vi.fn()
  })

  it("menampilkan catatan bahwa unggah bukan berarti lunas", () => {
    render(<ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={vi.fn()} />)
    expect(screen.getByText(/Menunggu Verifikasi/)).toBeInTheDocument()
  })

  it("menolak berkas yang bukan gambar tanpa memanggil API", () => {
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={vi.fn()} />
    )
    fireEvent.change(fileInput(container), {
      target: { files: [new File(["x"], "dokumen.pdf", { type: "application/pdf" })] },
    })
    expect(screen.getByText("Format harus JPG, PNG, atau WebP.")).toBeInTheDocument()
  })

  it("menolak berkas di atas 5MB", () => {
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={vi.fn()} />
    )
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "besar.jpg", { type: "image/jpeg" })
    fireEvent.change(fileInput(container), { target: { files: [big] } })
    expect(screen.getByText("Ukuran berkas maksimal 5MB.")).toBeInTheDocument()
  })

  it("menampilkan pratinjau setelah berkas valid dipilih", () => {
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={vi.fn()} />
    )
    fireEvent.change(fileInput(container), { target: { files: [JPEG] } })
    expect(screen.getByAltText("Pratinjau bukti pembayaran")).toHaveAttribute("src", "blob:preview")
    expect(screen.getByText("bukti.jpg")).toBeInTheDocument()
  })

  it("mengirim satu permintaan lalu meneruskan respons ke onUploaded", async () => {
    const onUploaded = vi.fn()
    uploadPaymentProof.mockResolvedValue({ data: { id: "p1", status: "under_review" } })
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="tok" canSubmit onUploaded={onUploaded} />
    )

    fireEvent.change(fileInput(container), { target: { files: [JPEG] } })
    fireEvent.click(screen.getByRole("button", { name: /Kirim bukti pembayaran/ }))

    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(uploadPaymentProof).toHaveBeenCalledTimes(1)
    expect(uploadPaymentProof).toHaveBeenCalledWith("o1", JPEG, "tok")
    expect(onUploaded).toHaveBeenCalledWith({ id: "p1", status: "under_review" })
  })

  it("menampilkan pesan error dari server dan tidak memanggil onUploaded", async () => {
    const onUploaded = vi.fn()
    uploadPaymentProof.mockRejectedValue(new Error("Pembayaran sedang diverifikasi."))
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={onUploaded} />
    )

    fireEvent.change(fileInput(container), { target: { files: [JPEG] } })
    fireEvent.click(screen.getByRole("button", { name: /Kirim bukti pembayaran/ }))

    expect(await screen.findByText("Pembayaran sedang diverifikasi.")).toBeInTheDocument()
    expect(onUploaded).not.toHaveBeenCalled()
  })

  it("tombol kirim nonaktif sebelum ada berkas", () => {
    render(<ProofUpload orderId="o1" accessToken="t" canSubmit onUploaded={vi.fn()} />)
    expect(screen.getByRole("button", { name: /Kirim bukti pembayaran/ })).toBeDisabled()
  })

  it("tidak menampilkan form saat status tidak mengizinkan unggah", () => {
    const { container } = render(
      <ProofUpload orderId="o1" accessToken="t" canSubmit={false} onUploaded={vi.fn()} />
    )
    expect(screen.getByText(/tidak dapat dikirim/)).toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
})