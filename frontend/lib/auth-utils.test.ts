import { describe, expect, it } from "vitest"

import { formatAuthError } from "@/lib/auth-utils"

describe("formatAuthError — alur lupa kata sandi", () => {
  it("menerjemahkan tautan reset yang kedaluwarsa", () => {
    expect(formatAuthError(new Error("Email link is invalid or has expired"))).toBe(
      "Tautan reset sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.",
    )
    expect(formatAuthError(new Error("otp_expired"))).toBe(
      "Tautan reset sudah kedaluwarsa atau sudah dipakai. Minta tautan baru.",
    )
  })

  it("menolak kata sandi sama dengan yang lama", () => {
    expect(
      formatAuthError(new Error("New password should be different from the old password.")),
    ).toBe("Kata sandi baru harus berbeda dari kata sandi lama.")
  })

  it("menandai kata sandi lemah", () => {
    expect(formatAuthError(new Error("Weak password"))).toBe(
      "Kata sandi terlalu lemah. Gunakan kombinasi yang lebih kuat.",
    )
  })

  it("mengenali batas kirim email", () => {
    expect(formatAuthError(new Error("email rate limit exceeded"))).toBe(
      "Terlalu banyak percobaan. Silakan tunggu beberapa saat lagi.",
    )
  })

  it("meneruskan pesan yang tidak dikenal apa adanya", () => {
    expect(formatAuthError(new Error("Kaboom"))).toBe("Kaboom")
  })
})
