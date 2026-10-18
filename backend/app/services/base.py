"""Kontrak dasar service — rumah bagi *abstraction* dan *inheritance*.

Modul ini sengaja ada supaya pilar OOP "abstraction" dan "inheritance" punya
tempat mendarat yang eksplisit, bukan hanya "kesamaan nama method". Isinya
kumpulan *abstract base class* (ABC) yang benar-benar dipakai implementasi
konkret, jadi ABC di sini bukan wadah kosong:

1. **State bersama** — nama tabel disimpan sebagai atribut instance **private**
   (name-mangled). Karena ada state, method di sini adalah *instance method*
   yang benar-benar memakai `self`, bukan `@staticmethod` yang hanya kebetulan
   berkelompok.
2. **Kerangka CRUD bersama** — `get_all`/`create`/`update`/`delete` ditulis
   **satu kali**. Sebelumnya method itu digandakan antara
   `category_service.py` dan `promo_service.py`.
3. **Tiga method abstract** — `_client`, `_order_clause`, dan `_serialize`.
   Ketiganya *harus* berbeda per tabel, sehingga subclass **wajib** mengisinya;
   Python menolak meng-instansiasi subclass yang belum melengkapinya.

Alasan desain yang perlu disebut saat presentasi: kita **tidak** memaksakan
seluruh service masuk ke hierarki ini. `OrderService`, `CartService`,
`DashboardService`, dan `InventoryService` sengaja tetap class mandiri karena
mereka bukan CRUD satu tabel (lihat komentar modul masing-masing dan
`app/services/__init__.py`).

Kontrak lain di modul ini mengikuti pembagian yang sama:

- `BookRepository` — baca katalog buku, dua implementasi (ORM + PostgREST).
- `MarketplaceSourceRepository` / `MarketplacePriceRepository` — konfigurasi dan
  hasil perbandingan harga marketplace, satu implementasi ORM masing-masing.
- `ReportService` — agregasi lintas tabel untuk dashboard.
"""

from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID


class SupabaseTableService(ABC):
    """Kerangka CRUD generik untuk satu tabel Supabase lewat PostgREST.

    Subclass menyediakan nama tabel plus tiga implementasi yang khas tabelnya
    (`_client`, `_order_clause`, `_serialize`). Sisanya diwarisi apa adanya.
    """

    #: Nama tabel di Supabase. Wajib diisi subclass.
    TABLE: str = ""

    #: Kolom yang dipilih pada operasi baca. `"*"` berarti seluruh kolom.
    COLUMNS: str = "*"

    #: Pesan `ValueError` ketika `create` tidak mengembalikan baris apa pun.
    CREATE_FAILED_MESSAGE: str = "Data gagal dibuat."

    def __init__(self) -> None:
        # State instance — inilah alasan method di class ini bukan @staticmethod.
        # Disimpan *private* (name-mangled jadi `_SupabaseTableService__table_name`)
        # supaya subclass tidak bisa menimpanya diam-diam dan merusak invariant
        # "satu service = satu tabel".
        self.__table_name = self.TABLE

    @property
    def table_name(self) -> str:
        """Nama tabel yang dilayani service ini (read-only).

        Satu-satunya pintu membaca `__table_name` yang private. Tanpa setter,
        jadi pihak luar tidak bisa memindahkan service ke tabel lain.
        """
        return self.__table_name

    # ------------------------------------------------------------------
    # Method abstract — implementasinya WAJIB berbeda per tabel.
    # ------------------------------------------------------------------

    @abstractmethod
    def _client(self) -> Any:
        """Klien PostgREST yang dipakai service ini.

        Wajib abstract, dan **bukan** cukup disimpan sekali di `__init__`:
        masing-masing modul service mengimpor `supabase_admin` ke namespace-nya
        sendiri, dan pengujian mengganti nilai itu per modul
        (`patch("app.services.promo_service.supabase_admin")`). Karena itu
        tiap subclass harus membacanya dari modulnya sendiri **saat dipanggil**.
        """
        raise NotImplementedError

    @abstractmethod
    def _order_clause(self) -> tuple[str, bool]:
        """Urutan `get_all` sebagai `(nama_kolom, menurun?)`.

        Wajib abstract karena tiap tabel punya urutan alami sendiri:
        `categories` menurut `name`, `promos` menurut `created_at` menurun.
        Tidak ada default yang masuk akal untuk keduanya.
        """
        raise NotImplementedError

    @abstractmethod
    def _serialize(self, row: dict[str, Any]) -> dict[str, Any]:
        """Ubah satu baris mentah PostgREST menjadi bentuk respons.

        Wajib abstract karena `promos` perlu mengubah numeric-as-string menjadi
        angka **dan** menambahkan `status` turunan, sedangkan `categories`
        mengembalikan baris apa adanya.
        """
        raise NotImplementedError

    @abstractmethod
    def get_by_id(self, row_id: str) -> dict[str, Any] | None:
        """Ambil satu baris; `None` bila tidak ada.

        Wajib abstract karena **semantik "tidak ada" berbeda**: `categories`
        memakai `.single()` sehingga baris kosong melempar error, sementara
        `promos` membaca daftar dan mengembalikan `None`. Perbedaan ini nyata
        dan harus diputuskan tiap subclass, bukan ditebak di sini.
        """
        raise NotImplementedError

    # ------------------------------------------------------------------
    # Method konkret — diwarisi apa adanya oleh subclass.
    # ------------------------------------------------------------------

    def _table(self) -> Any:
        """Query builder PostgREST untuk tabel ini (protected).

        Pintu tunggal ke tabel: semua operasi lewat sini, bukan memanggil
        `supabase_admin.table(...)` berulang-ulang.
        """
        return self._client().table(self.table_name)

    def get_all(self) -> list[dict[str, Any]]:
        """Daftar seluruh baris, terurut dan terserialisasi sesuai subclass."""
        column, desc = self._order_clause()
        res = self._table().select(self.COLUMNS).order(column, desc=desc).execute()
        return [self._serialize(row) for row in (res.data or [])]

    def create(self, payload: Any) -> dict[str, Any]:
        """Sisipkan satu baris dari payload Pydantic, kembalikan baris terserialisasi."""
        res = self._table().insert(payload.model_dump(mode="json")).execute()
        if not res.data:
            raise ValueError(self.CREATE_FAILED_MESSAGE)
        return self._serialize(res.data[0])

    def update(self, row_id: str, payload: Any) -> dict[str, Any]:
        """Terapkan perubahan parsial, kembalikan baris baru.

        Subclass boleh meng-override dan memanggil `super().update(...)` untuk
        menambah validasi — lihat `PromoService.update`.
        """
        changes = payload.model_dump(mode="json", exclude_unset=True)
        res = self._table().update(changes).eq("id", row_id).execute()
        return self._serialize(res.data[0])

    def delete(self, row_id: str) -> None:
        """Hapus satu baris, setelah menjalankan hook `_before_delete()`.

        Ini *template method*: kerangka hapus ada di induk, sementara langkah
        tambahan dititipkan lewat hook — lihat `PromoService._before_delete`.
        """
        self._before_delete(row_id)
        self._table().delete().eq("id", row_id).execute()

    # ------------------------------------------------------------------
    # Hook (protected, default no-op) — titik ekstensi tanpa mengubah kerangka.
    # ------------------------------------------------------------------

    def _before_delete(self, row_id: str) -> None:
        """Dijalankan `delete()` sebelum baris dihapus. Default: tidak melakukan apa-apa."""
        return


class BookRepository(ABC):
    """Kontrak baca katalog buku — satu antarmuka, dua sumber data.

    `OrmBookRepository` (SQLAlchemy, async) dan `RestBookRepository` (PostgREST,
    sinkron) sama-sama memenuhi kontrak ini. Mereka berbagi **kontrak**, bukan
    implementasi: karena itu ABC ini hanya menuntut *nama method* ada, tanpa
    memaksa bentuk `async`/`sync` — perbedaan itu justru bagian dari dua
    implementasinya, dan memaksa satu signature seragam akan membuat typing
    salah untuk salah satu jalur.

    ABC ini juga menjadi rumah bersama bagi satu util yang sebelumnya digandakan
    di kedua jalur: `_search_term()`. Inilah nilai nyata dari inheritance di
    sini — bukan sekadar penanda, tapi menghapus duplikasi.

    Jalur tulis (create/update/delete) sengaja **tidak** masuk kontrak ini:
    hanya jalur baca yang punya dua implementasi untuk dipertukarkan.
    """

    @abstractmethod
    def get(self, book_id: UUID) -> Any:
        """Satu buku. Bentuk hasilnya (dict) disepakati kedua implementasi."""
        raise NotImplementedError

    @abstractmethod
    def list_page(self, page: int, page_size: int, q: str | None) -> Any:
        """Satu halaman buku beserta total barisnya."""
        raise NotImplementedError

    @staticmethod
    def _search_term(q: str | None) -> str | None:
        """Kata kunci pencarian yang sudah dirapikan, atau `None` bila kosong.

        Sebelumnya logika «kalau `q` kosong, jangan pasang filter» ini ditulis
        dua kali — sekali sebagai `_search_filters` (SQLAlchemy) dan sekali
        sebagai `if q and q.strip()` inline (PostgREST). Kini keduanya memanggil
        satu tempat ini.
        """
        if not q:
            return None
        term = q.strip()
        return term or None


class ReportService(ABC):
    """Kontrak service agregasi baca-saja (laporan).

    Berbeda dari `SupabaseTableService` yang melayani CRUD satu tabel, service
    di sini **menghitung** lintas tabel: pesanan batal tidak boleh ikut terhitung,
    dan `cancelled` adalah satu-satunya nilai status yang dikenali database live
    (`orders_status_check`). Aturan itu ditulis sekali di sini, bukan diulang di
    tiap method laporan.
    """

    #: Status pesanan yang tidak pernah dihitung sebagai penjualan.
    EXCLUDED_STATUS = "cancelled"

    @abstractmethod
    def get_summary(self) -> Any:
        """Angka KPI utama untuk kartu ringkasan dashboard."""
        raise NotImplementedError

    @staticmethod
    def _is_revenue_order(row: dict[str, Any]) -> bool:
        """Apakah satu baris pesanan ikut dihitung sebagai penjualan."""
        return row.get("status") != ReportService.EXCLUDED_STATUS


class MarketplaceSourceRepository(ABC):
    """Kontrak penyimpanan *sumber* harga marketplace (tabel `marketplace_sources`).

    Berbeda dari `BookRepository` yang punya dua implementasi (ORM dan PostgREST),
    kontrak ini hanya punya **satu** implementasi: data ini milik backend sendiri,
    bukan katalog publik yang perlu jalur cadangan. ABC-nya tetap ada karena tiga
    alasan nyata:

    1. Layer API hanya boleh bergantung pada kontrak, bukan kelas konkret —
       sehingga pengujian bisa menyuntikkan fake in-memory (lihat
       `tests/test_marketplaces.py`) tanpa menyentuh database, seperti yang sudah
       dilakukan `tests/test_books.py` dengan `FakeSession`.
    2. Semua method-nya `async`, jadi bentuknya disepakati sekali di sini.
    3. Nama method-nya dibagi dengan `MarketplacePriceRepository`, sehingga
       service orkestrasi memperlakukan keduanya dengan cara yang sama.
    """

    @abstractmethod
    async def list_for_book(self, book_id: UUID, *, only_active: bool = False) -> list[Any]:
        """Semua sumber milik satu buku; `only_active` menyaring yang dimatikan admin."""
        raise NotImplementedError

    @abstractmethod
    async def get(self, source_id: UUID) -> Any | None:
        """Satu sumber; `None` bila tidak ada."""
        raise NotImplementedError

    @abstractmethod
    async def create(self, payload: Any) -> Any:
        """Simpan sumber baru dan kembalikan barisnya."""
        raise NotImplementedError

    @abstractmethod
    async def update(self, source_id: UUID, payload: Any) -> Any | None:
        """Terapkan patch parsial; `None` bila sumbernya tidak ada."""
        raise NotImplementedError

    @abstractmethod
    async def create_many_if_absent(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Sisipkan sumber yang belum ada; kembalikan hanya yang baru dibuat.

        Idempoten: pasangan `(book_id, marketplace)` yang sudah terdaftar
        dilewati lewat aturan unik database, sehingga pemanggilan berulang
        dengan payload yang sama tidak menambah baris apa pun.
        """
        raise NotImplementedError

    @abstractmethod
    async def delete(self, source_id: UUID) -> bool:
        """Hapus satu sumber; `False` bila tidak ada yang terhapus."""
        raise NotImplementedError


class MarketplacePriceRepository(ABC):
    """Kontrak penyimpanan *hasil* harga marketplace (tabel `marketplace_prices`).

    Bentuknya **append-only**: `add_snapshot` hanya menyisipkan baris baru. Tidak
    ada `update` di kontrak ini dengan sengaja — menimpa baris lama akan
    menghapus riwayat, padahal riwayat itulah yang membuat tren harga mungkin.
    """

    @abstractmethod
    async def latest_for_book(self, book_id: UUID) -> list[Any]:
        """Snapshot terbaru per marketplace untuk satu buku."""
        raise NotImplementedError

    @abstractmethod
    async def history_for_book(self, book_id: UUID, *, limit: int = 60) -> list[Any]:
        """Riwayat harga satu buku, terbaru lebih dulu, dibatasi `limit` baris."""
        raise NotImplementedError

    @abstractmethod
    async def add_snapshot(self, payload: Any) -> Any:
        """Sisipkan satu titik harga baru (tidak pernah menimpa baris lama)."""
        raise NotImplementedError

    @abstractmethod
    async def add_snapshots(self, payloads: list[Any]) -> list[Any]:
        """Sisipkan banyak titik harga dalam satu round trip; urutan dipertahankan.

        Ada agar satu perbandingan tidak memicu satu perjalanan database per
        marketplace — sumber utama lambatnya modal perbandingan harga.
        """
        raise NotImplementedError
