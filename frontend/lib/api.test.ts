import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const PAGE = { items: [], total: 0, page: 1, page_size: 12 }

async function loadApi() {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.readr.example/api/v1")
  return import("@/lib/api")
}

describe("request", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  /** Instance Render yang baru bangun menolak koneksi sesaat; satu retry cukup. */
  it("mencoba ulang kegagalan jaringan sebelum menyerah", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify(PAGE), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const { getBooks } = await loadApi()
    const pending = getBooks()
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(pending).resolves.toEqual(PAGE)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("melempar NetworkError setelah retry habis", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    vi.stubGlobal("fetch", fetchMock)

    const { getBooks, NetworkError } = await loadApi()
    const pending = getBooks()
    const assertion = expect(pending).rejects.toBeInstanceOf(NetworkError)
    await vi.advanceTimersByTimeAsync(40_000)

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it("tidak mencoba ulang error HTTP", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"detail":"Nope"}', { status: 500 }))
    vi.stubGlobal("fetch", fetchMock)

    const { getBooks } = await loadApi()
    await expect(getBooks()).rejects.toThrow("Nope")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  /** POST yang putus setelah terkirim bisa membuat grup/pesanan ganda. */
  it("tidak mencoba ulang permintaan POST", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    vi.stubGlobal("fetch", fetchMock)

    const { joinCommunityGroup, NetworkError } = await loadApi()
    const pending = joinCommunityGroup("group-1", "token")
    const assertion = expect(pending).rejects.toBeInstanceOf(NetworkError)
    await vi.advanceTimersByTimeAsync(10_000)

    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})