import { describe, expect, it, vi } from "vitest"

const LAN_PAGE = { protocol: "http:", hostname: "192.168.1.10" }

async function loadResolveApiUrl(apiUrl: string | undefined) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_API_URL", apiUrl)
  const { resolveApiUrl } = await import("@/lib/apiUrl")
  return resolveApiUrl
}

describe("resolveApiUrl", () => {
  it("menurunkan host API dari host halaman bila env kosong", async () => {
    const resolveApiUrl = await loadResolveApiUrl(undefined)
    expect(resolveApiUrl(LAN_PAGE)).toBe("http://192.168.1.10:8000/api/v1")
  })

  /** `localhost` di HP/tablet berarti perangkat itu sendiri, bukan mesin backend. */
  it("mengganti host loopback pada nilai env eksplisit", async () => {
    const resolveApiUrl = await loadResolveApiUrl("http://localhost:8000/api/v1")
    expect(resolveApiUrl(LAN_PAGE)).toBe("http://192.168.1.10:8000/api/v1")
  })

  it("mempertahankan host non-loopback pada nilai env eksplisit", async () => {
    const resolveApiUrl = await loadResolveApiUrl("https://api.readr.example/v1")
    expect(resolveApiUrl(LAN_PAGE)).toBe("https://api.readr.example/v1")
  })

  it("memakai localhost saat render server (tanpa window)", async () => {
    const resolveApiUrl = await loadResolveApiUrl(undefined)
    expect(resolveApiUrl(null)).toBe("http://localhost:8000/api/v1")
  })

  it("tidak menukar localhost menjadi port 8000 di halaman HTTPS", async () => {
    const resolveApiUrl = await loadResolveApiUrl("http://localhost:8000/api/v1")
    expect(resolveApiUrl({ protocol: "https:", hostname: "toko.vercel.app" })).toBe(
      "https://toko.vercel.app/api/v1",
    )
  })
})
