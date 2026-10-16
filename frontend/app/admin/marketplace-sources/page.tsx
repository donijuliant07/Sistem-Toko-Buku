"use client"

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { PageHeader } from "@/components/admin/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createMarketplaceSource,
  deleteMarketplaceSource,
  getBooks,
  getMarketplaceSources,
  getMarketplaces,
  updateMarketplaceSource,
} from "@/lib/api"
import type { Book, MarketplaceInfo, MarketplaceSource, MarketplaceSlug } from "@/lib/types"
import { toast } from "sonner"

/**
 * Pengelolaan link produk marketplace per buku.
 *
 * Alur yang dipakai admin sengaja dua langkah — **pilih buku dulu, baru atur
 * sumbernya** — karena sumber harga selalu milik satu buku (`book_id` NOT NULL di
 * DB). Menampilkan semuanya sekaligus akan menghasilkan tabel raksasa berisi
 * ratusan buku yang 99%-nya belum punya sumber.
 */
export default function AdminMarketplaceSourcesPage() {
  const [query, setQuery] = React.useState("")
  const [books, setBooks] = React.useState<Book[]>([])
  const [searching, setSearching] = React.useState(true)
  const [selected, setSelected] = React.useState<Book | null>(null)

  const [sources, setSources] = React.useState<MarketplaceSource[]>([])
  //: Buku yang sumber-sumber di atas benar-benar miliknya. Dipakai untuk menurunkan
  //: keadaan "sedang memuat" alih-alih menyimpannya sebagai state — `setState`
  //: sinkron di dalam effect memicu render berantai, dan itu memang tidak perlu di
  //: sini: "sedang memuat" sama persis dengan "yang ada bukan milik buku terpilih".
  const [sourcesFor, setSourcesFor] = React.useState<string | null>(null)
  //: Naikkan untuk memuat ulang sumber buku terpilih tanpa mengubah daftar
  //: dependensinya — cara termurah memicu ulang effect di atas setelah menulis.
  const [reloadToken, setReloadToken] = React.useState(0)
  const [marketplaces, setMarketplaces] = React.useState<MarketplaceInfo[]>([])

  // Form dialog. `editing` null = mode tambah.
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MarketplaceSource | null>(null)
  const [slug, setSlug] = React.useState<MarketplaceSlug | "">("")
  const [productUrl, setProductUrl] = React.useState("")
  const [keyword, setKeyword] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  // Daftar marketplace yang didukung. Backend sudah menyaring adapter demo keluar
  // dari endpoint ini, jadi "Demo Store A" tidak akan pernah muncul di dropdown.
  React.useEffect(() => {
    let active = true
    getMarketplaces()
      .then((list) => {
        if (active) setMarketplaces(list)
      })
      .catch(() => {
        if (active) toast.error("Gagal memuat daftar marketplace")
      })
    return () => {
      active = false
    }
  }, [])

  // Pencarian buku, dengan jeda 350 ms supaya tidak menembak API tiap ketikan.
  React.useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setSearching(true)
      getBooks(1, query, 20)
        .then((page) => {
          if (!active) return
          const items = page.items ?? []
          setBooks(items)
          // Buku pertama dipilih otomatis supaya halamannya tidak tampak kosong saat
          // dibuka — tapi hanya bila admin belum memilih apa pun, dan hanya lewat
          // callback ini (bukan badan effect) supaya tidak memicu render berantai.
          setSelected((current) => current ?? items[0] ?? null)
        })
        .catch(() => {
          if (active) toast.error("Gagal memuat daftar buku")
        })
        .finally(() => {
          if (active) setSearching(false)
        })
    }, 350)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  // Sumber dimuat ulang saat buku terpilih berganti, dan saat `reloadToken` naik
  // (dipanggil setelah menambah/mengubah/menghapus). Satu jalur muat saja.
  //
  // `setState`-nya berada di dalam `.then`/`.catch`, bukan di badan effect: React
  // menyebut setState sinkron di badan effect sebagai pemicu render berantai.
  // Karena itu tidak ada state "sedang memuat" yang diset di sini — keadaan itu
  // diturunkan dari `sourcesFor` (lihat `loadingSources`).
  React.useEffect(() => {
    if (!selected) return
    let active = true
    const bookId = selected.id

    getMarketplaceSources(bookId)
      .then((list) => {
        if (!active) return
        setSources(list)
        setSourcesFor(bookId)
      })
      .catch(() => {
        if (!active) return
        toast.error("Gagal memuat sumber marketplace buku ini")
        setSources([])
        setSourcesFor(bookId)
      })

    return () => {
      active = false
    }
  }, [selected, reloadToken])

  const reload = () => setReloadToken((token) => token + 1)

  // Turunan, bukan state: yang tersimpan bukan milik buku terpilih = masih memuat.
  const loadingSources = selected !== null && sourcesFor !== selected.id

  /** Marketplace yang belum dipakai buku ini — sumber ganda ditolak backend (409). */
  const availableMarketplaces = React.useMemo(
    () => marketplaces.filter((mp) => !sources.some((source) => source.marketplace === mp.slug)),
    [marketplaces, sources]
  )

  const openCreate = () => {
    setEditing(null)
    setSlug(availableMarketplaces[0]?.slug ?? "")
    setProductUrl("")
    setKeyword(selected?.title ?? "")
    setIsActive(true)
    setDialogOpen(true)
  }

  const openEdit = (source: MarketplaceSource) => {
    setEditing(source)
    setSlug(source.marketplace)
    setProductUrl(source.product_url ?? "")
    setKeyword(source.search_keyword ?? "")
    setIsActive(source.is_active)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return

    const url = productUrl.trim()
    const key = keyword.trim()
    // Sama dengan `ck_marketplace_sources_target` di DB: sumber tanpa keduanya
    // tidak punya cara menemukan halamannya. Ditolak di sini supaya pesannya rapi,
    // bukan error constraint dari database.
    if (!url && !key) {
      toast.error("Isi minimal salah satu: link produk atau kata kunci pencarian.")
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await updateMarketplaceSource(editing.id, {
          product_url: url || null,
          search_keyword: key || null,
          is_active: isActive,
        })
        toast.success(`Sumber ${editing.label} diperbarui.`)
      } else {
        if (!slug) {
          toast.error("Pilih marketplace terlebih dahulu.")
          return
        }
        await createMarketplaceSource({
          book_id: selected.id,
          marketplace: slug,
          product_url: url || null,
          search_keyword: key || null,
          is_active: isActive,
        })
        toast.success("Sumber marketplace ditambahkan.")
      }
      setDialogOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan sumber marketplace")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (source: MarketplaceSource, next: boolean) => {
    // Optimistis: saklar harus terasa langsung merespons. Dikembalikan bila gagal.
    setSources((prev) =>
      prev.map((item) => (item.id === source.id ? { ...item, is_active: next } : item))
    )
    try {
      await updateMarketplaceSource(source.id, { is_active: next })
    } catch {
      setSources((prev) =>
        prev.map((item) => (item.id === source.id ? { ...item, is_active: !next } : item))
      )
      toast.error(`Gagal mengubah status ${source.label}`)
    }
  }

  const handleDelete = async (source: MarketplaceSource) => {
    setDeletingId(source.id)
    try {
      await deleteMarketplaceSource(source.id)
      toast.success(`Sumber ${source.label} dihapus.`)
      reload()
    } catch {
      toast.error(`Gagal menghapus sumber ${source.label}`)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Link Harga Marketplace"
        description="Tentukan di mana harga tiap buku dicari. Link produk lebih diutamakan; kata kunci pencarian dipakai sebagai cadangan."
        action={
          <Button
            onClick={openCreate}
            disabled={!selected}
            className="gap-1.5 cursor-pointer rounded-xl bg-zinc-900 text-xs text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Sumber</span>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Kolom kiri: pilih buku */}
        <Card className="h-fit rounded-2xl border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul buku…"
                className="rounded-xl border-zinc-200/80 bg-zinc-50/70 pl-9 text-zinc-900"
              />
            </div>

            <div className="max-h-[520px] space-y-1 overflow-y-auto pr-1">
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                </div>
              ) : books.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">Tidak ada buku cocok.</p>
              ) : (
                books.map((book) => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => setSelected(book)}
                    className={`w-full cursor-pointer rounded-xl px-3 py-2 text-left transition-colors ${
                      selected?.id === book.id
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="block truncate text-xs font-semibold">{book.title}</span>
                    <span
                      className={`block truncate text-[11px] ${
                        selected?.id === book.id ? "text-zinc-300" : "text-zinc-400"
                      }`}
                    >
                      {book.author}
                    </span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Kolom kanan: sumber buku terpilih */}
        <Card className="rounded-2xl border-zinc-200/80 bg-white shadow-xs">
          <CardContent className="p-0">
            {!selected ? (
              <p className="py-16 text-center text-xs text-zinc-500">
                Pilih satu buku di sebelah kiri untuk mengatur sumber harganya.
              </p>
            ) : (
              <>
                <div className="border-b border-zinc-200/80 px-4 py-3">
                  <p className="text-sm font-bold text-zinc-900">{selected.title}</p>
                  <p className="text-[11px] text-zinc-500">
                    {sources.length} sumber terdaftar
                    {availableMarketplaces.length > 0 &&
                      ` · ${availableMarketplaces.length} marketplace belum dipakai`}
                  </p>
                </div>

                {loadingSources ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : sources.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Link2 className="h-6 w-6 text-zinc-300" />
                    <p className="text-xs font-semibold text-zinc-700">Belum ada sumber harga</p>
                    <p className="max-w-xs text-[11px] text-zinc-500">
                      Selama belum ada, tombol &ldquo;Bandingkan Harga&rdquo; di halaman buku akan
                      mengatakan belum ada pembanding.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Marketplace</TableHead>
                        <TableHead className="text-xs">Link produk</TableHead>
                        <TableHead className="text-xs">Kata kunci</TableHead>
                        <TableHead className="text-xs">Aktif</TableHead>
                        <TableHead className="text-right text-xs">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((source) => (
                        <TableRow key={source.id} className={source.is_active ? "" : "opacity-60"}>
                          <TableCell className="text-xs font-semibold text-zinc-800">
                            {source.label}
                          </TableCell>
                          <TableCell className="max-w-[260px] text-xs">
                            {source.product_url ? (
                              <a
                                href={source.product_url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 truncate text-blue-600 hover:underline"
                                title={source.product_url}
                              >
                                <span className="truncate">{source.product_url}</span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-zinc-400">— cari otomatis</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate text-xs text-zinc-500">
                            {source.search_keyword || "—"}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={source.is_active}
                              onCheckedChange={(next) => handleToggleActive(source, next)}
                              aria-label={`Aktifkan sumber ${source.label}`}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(source)}
                                className="h-7 cursor-pointer rounded-lg border-zinc-200 bg-white px-2 text-zinc-700 hover:bg-zinc-50"
                                aria-label={`Ubah sumber ${source.label}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={deletingId === source.id}
                                onClick={() => handleDelete(source)}
                                className="h-7 cursor-pointer rounded-lg border-zinc-200 bg-white px-2 text-red-600 hover:bg-red-50"
                                aria-label={`Hapus sumber ${source.label}`}
                              >
                                {deletingId === source.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                <div className="flex items-start gap-2 border-t border-zinc-200/80 bg-zinc-50/60 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-[11px] leading-relaxed text-zinc-600">
                    Harga diambil dari data terstruktur halaman (JSON-LD/Open Graph). Bila sebuah
                    marketplace menolak permintaan otomatis, ia muncul sebagai peringatan di modal
                    pembanding — sumbernya tidak perlu dihapus.{" "}
                    <Link href={`/books/${selected.id}`} className="font-semibold text-blue-600 hover:underline">
                      Lihat halaman buku
                    </Link>
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Ubah sumber ${editing.label}` : "Tambah sumber marketplace"}
            </DialogTitle>
            <DialogDescription>
              {selected?.title}
              {!editing && (
                <span className="mt-1 block">
                  Isi link produk bila sudah tahu halamannya. Kalau belum, cukup isi kata kunci —
                  harga akan dicari otomatis dan hanya dipakai bila judulnya cocok.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Marketplace</label>
              {editing ? (
                <Badge variant="secondary" className="rounded-lg">
                  {editing.label}
                </Badge>
              ) : availableMarketplaces.length === 0 ? (
                <p className="text-[11px] text-zinc-500">
                  Semua marketplace yang didukung sudah terdaftar untuk buku ini.
                </p>
              ) : (
                <Select value={slug} onValueChange={(value) => setSlug(value as MarketplaceSlug)}>
                  <SelectTrigger className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900">
                    <SelectValue placeholder="Pilih marketplace" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMarketplaces.map((mp) => (
                      <SelectItem key={mp.slug} value={mp.slug}>
                        {mp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="product-url" className="text-xs font-semibold text-zinc-700">
                Link produk
              </label>
              <Input
                id="product-url"
                type="url"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                placeholder="https://www.tokopedia.com/toko/bumi-manusia"
                className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Link langsung ke halaman produk. Bila diisi, pencarian otomatis tidak dijalankan.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="search-keyword" className="text-xs font-semibold text-zinc-700">
                Kata kunci pencarian
              </label>
              <Input
                id="search-keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="bumi manusia pramoedya"
                className="rounded-xl border-zinc-200/80 bg-zinc-50/70 text-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Dipakai bila link produk kosong. Judul hasil harus mirip judul buku, kalau tidak
                akan ditolak.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/70 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-zinc-700">Aktif</p>
                <p className="text-[11px] text-zinc-500">
                  Sumber nonaktif tidak ikut diambil saat pembanding dibuka.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Status aktif" />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="cursor-pointer rounded-xl border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || (!editing && availableMarketplaces.length === 0)}
                className="cursor-pointer rounded-xl bg-zinc-900 font-medium text-white shadow-xs hover:bg-zinc-800"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
