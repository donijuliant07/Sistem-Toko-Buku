"""Registry marketplace: satu tempat yang tahu adapter mana yang tersedia.

Menambah marketplace = menambah satu class adapter lalu mendaftarkannya di
`ADAPTER_CLASSES`. Tidak ada satu pun `if slug == "shopee"` di service orkestrasi
atau layer API, sehingga fitur ini bisa tumbuh tanpa menyentuh kode yang sudah
teruji.

Yang disimpan adalah **instance**, bukan kelas: adapter tidak punya state
(`fetch` tidak menyimpan apa pun antar-permintaan), jadi satu instance per slug
aman dipakai bersama.
"""

from __future__ import annotations

from app.services.marketplace.adapters.catalog import (
    BlibliAdapter,
    BukalapakAdapter,
    GoogleBooksAdapter,
    LazadaAdapter,
    OpenLibraryAdapter,
    ShopeeAdapter,
    TokopediaAdapter,
)
from app.services.marketplace.adapters.demo import (
    DemoStoreAAdapter,
    DemoStoreBAdapter,
    DemoStoreCAdapter,
)
from app.services.marketplace.base import AdapterError, MarketplaceAdapter

#: Urutan di sini sekaligus urutan tampilan di UI.
#:
#: Adapter contoh **tidak** ikut di sini — ia punya daftar sendiri di
#: `DEMO_CLASSES` supaya `supported_marketplaces()` (isi dropdown admin) tidak
#: pernah menawarkannya sebagai pilihan sungguhan.
ADAPTER_CLASSES: tuple[type[MarketplaceAdapter], ...] = (
    GoogleBooksAdapter,
    TokopediaAdapter,
    ShopeeAdapter,
    LazadaAdapter,
    BlibliAdapter,
    BukalapakAdapter,
    OpenLibraryAdapter,
)

#: Adapter contoh untuk demo. Terdaftar di registry supaya bisa dipanggil lewat
#: `get_adapter`, tetapi tersaring keluar dari panel admin.
#:
#: **Untuk mematikan demo, kosongkan tuple ini.** Tidak ada berkas lain yang
#: perlu diubah; slug-nya tetap dikenali database sehingga riwayat lama tetap
#: terbaca sebagai data contoh, bukan error.
DEMO_CLASSES: tuple[type[MarketplaceAdapter], ...] = (
    DemoStoreAAdapter,
    DemoStoreBAdapter,
    DemoStoreCAdapter,
)

_REGISTRY: dict[str, MarketplaceAdapter] = {
    adapter_class.slug: adapter_class()
    for adapter_class in (*ADAPTER_CLASSES, *DEMO_CLASSES)
}


def get_adapter(slug: str) -> MarketplaceAdapter:
    """Adapter untuk `slug`.

    Melempar `AdapterError` (bukan `KeyError`) supaya pemanggil menanganinya
    dengan cara yang sama seperti kegagalan marketplace lain: sebagai peringatan.
    """
    try:
        return _REGISTRY[slug]
    except KeyError as exc:
        raise AdapterError(f"Marketplace '{slug}' belum didukung.") from exc


def supported_marketplaces() -> list[MarketplaceAdapter]:
    """Adapter terdaftar, urut sesuai `ADAPTER_CLASSES`.

    Hanya yang sungguhan — adapter demo tidak ikut, karena daftar ini dipakai
    untuk mengisi dropdown "marketplace mana yang dipakai" di halaman admin.
    Menawarkan "Demo Store A" di sana akan mengundang admin sungguhan memilihnya.
    """
    return [adapter for adapter in _REGISTRY.values() if not getattr(adapter, "is_mock", False)]


def marketplace_label(slug: str) -> str:
    """Nama tampilan marketplace; slug tak dikenal dikembalikan apa adanya.

    Dipakai juga saat membaca baris lama, jadi slug yang sudah tidak terdaftar
    tidak boleh membuat pembacaan riwayat gagal.
    """
    adapter = _REGISTRY.get(slug)
    return adapter.label if adapter else slug


def supported_slugs() -> tuple[str, ...]:
    """Slug yang benar-benar punya adapter, urut sesuai `ADAPTER_CLASSES`.

    Dipakai untuk memeriksa kesesuaian dengan daftar slug di skema Pydantic;
    tanpa itu, sebuah slug bisa lolos validasi API tetapi tidak punya adapter
    dan baru ketahuan saat scrape dijalankan.
    """
    return tuple(_REGISTRY)
