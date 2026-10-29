import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Session } from "@supabase/supabase-js"

/**
 * Uji alur reset kata sandi end-to-end di level klien: AuthProvider asli +
 * halaman `/reset-password` asli, dengan Supabase auth, API, dan router yang
 * di-mock. Yang diuji adalah perilaku yang membuat pengguna tidak bisa
 * mengganti sandi sebelumnya: sesi recovery jatuh di halaman mana pun, tautan
 * kedaluwarsa, dan form ganti sandi itu sendiri.
 */

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  replace: vi.fn(),
  initialUrlHash: { value: "" as string },
}))

vi.mock("next/navigation", () => {
  const searchParams = () => new URLSearchParams(globalThis.window.location.search)
  return {
    useRouter: () => ({ replace: mocks.replace, push: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: searchParams,
  }
})

vi.mock("@/lib/supabase", () => ({
  supabaseConfigError: null,
  get initialUrlHash() {
    return mocks.initialUrlHash.value
  },
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      updateUser: mocks.updateUser,
      signOut: mocks.signOut,
    },
  },
}))

vi.mock("@/lib/api", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ role: "user" }),
}))

import { AuthProvider } from "@/components/AuthProvider"
import ResetPasswordPage from "./page"

vi.mock("@/components/auth/LoginCharacters", () => ({
  LoginCharacters: () => null,
}))

const recoverySession = {
  access_token: "access",
  refresh_token: "refresh",
  user: { id: "u1", email: "rendy@example.com" },
} as unknown as Session

function setUrl(search: string, hash = "") {
  globalThis.window.history.replaceState(null, "", `/` + search)
  mocks.initialUrlHash.value = hash
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  mocks.updateUser.mockResolvedValue({ data: {}, error: null })
  mocks.signOut.mockResolvedValue({ error: null })
})

function renderResetPage() {
  return render(
    <AuthProvider>
      <ResetPasswordPage />
    </AuthProvider>,
  )
}

describe("AuthProvider — tautan recovery di halaman mana pun", () => {
  it("mengarahkan beranda ke /reset-password saat URL membawa #type=recovery", async () => {
    setUrl("", "#access_token=access&refresh_token=refresh&type=recovery")
    mocks.getSession.mockResolvedValue({ data: { session: recoverySession } })
    renderResetPage()

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/reset-password"))
  })

  it("mengarahkan tautan reset kedaluwarsa ke /reset-password dengan pesan galat", async () => {
    setUrl("?next=/reset-password&error_code=otp_expired")
    renderResetPage()

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/reset-password"))
  })

  it("tidak mengalihkan kunjungan biasa tanpa tautan recovery", async () => {
    setUrl("?q=buku")
    renderResetPage()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("mengandalkan event PASSWORD_RECOVERY bila hash sudah tidak terbaca", async () => {
    // Hash hilang sebelum komponen sempat memeriksanya, tetapi Supabase tetap
    // memancarkan event setelah menukarnya menjadi sesi.
    setUrl("", "")
    mocks.getSession.mockResolvedValue({ data: { session: recoverySession } })
    renderResetPage()

    const handler = mocks.onAuthStateChange.mock.calls[0]?.[0] as
      | ((event: string, session: Session | null) => void)
      | undefined
    expect(handler).toBeTypeOf("function")
    await act(async () => handler?.("PASSWORD_RECOVERY", recoverySession))

    expect(mocks.replace).toHaveBeenCalledWith("/reset-password")
  })
})

describe("ResetPasswordPage", () => {
  it("menampilkan form saat sesi recovery terbentuk", async () => {
    setUrl("?next=/reset-password")
    mocks.getSession.mockResolvedValue({ data: { session: recoverySession } })
    renderResetPage()

    expect(
      await screen.findByRole("heading", { name: "Kata Sandi Baru" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Kata sandi baru")).toBeInTheDocument()
  })

  it("menyimpan sandi baru lalu kembali ke /login dengan pesan sukses", async () => {
    const user = userEvent.setup()
    setUrl("?next=/reset-password")
    mocks.getSession.mockResolvedValue({ data: { session: recoverySession } })
    renderResetPage()

    await user.type(await screen.findByLabelText("Kata sandi baru"), "sandiBaru123")
    await user.type(screen.getByLabelText(/konfirmasi/i), "sandiBaru123")
    await user.click(screen.getByRole("button", { name: /simpan kata sandi/i }))

    await waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: "sandiBaru123" }),
    )
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled())
    expect(mocks.replace).toHaveBeenCalledWith(
      expect.stringContaining("/login?message="),
    )
  })

  it("menolak konfirmasi yang tidak cocok tanpa memanggil Supabase", async () => {
    const user = userEvent.setup()
    setUrl("?next=/reset-password")
    mocks.getSession.mockResolvedValue({ data: { session: recoverySession } })
    renderResetPage()

    await user.type(await screen.findByLabelText("Kata sandi baru"), "sandiBaru123")
    await user.type(screen.getByLabelText(/konfirmasi/i), "beda123")
    await user.click(screen.getByRole("button", { name: /simpan kata sandi/i }))

    expect(await screen.findByText("Konfirmasi kata sandi tidak cocok.")).toBeInTheDocument()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it("menampilkan tautan kedaluwarsa dari /auth/callback sebagai 'minta tautan baru'", async () => {
    setUrl("?error=Tautan%20sudah%20kedaluwarsa%20atau%20sudah%20dipakai")
    renderResetPage()

    expect(
      await screen.findByRole("heading", { name: "Tautan tidak berlaku" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Minta tautan baru" })).toHaveAttribute(
      "href",
      "/forgot-password",
    )
    expect(screen.queryByLabelText("Kata sandi baru")).not.toBeInTheDocument()
  })

  it("tanpa sesi (tautan dibuka ulang/berbeda perangkat) menolak form", async () => {
    setUrl("")
    renderResetPage()

    await waitFor(() =>
      expect(screen.queryByLabelText("Kata sandi baru")).not.toBeInTheDocument(),
    )
  })
})
