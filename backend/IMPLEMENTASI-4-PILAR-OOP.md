# Implementasi 4 Pilar OOP — Penjelasan Detail

Dokumen ini menjelaskan **implementasi eksplisit** empat pilar OOP (encapsulation,
abstraction, inheritance, polymorphism) di `backend/app/services/`, ditulis setelah
refactor Tahap 3 (2026-10-14).

Tujuannya supaya setiap konstruksi bisa dipertanggungjawabkan **satu per satu**:
bukan hanya "ada di mana", tetapi **kenapa dipilih**, **apa konsekuensi terukurnya**,
dan **tes mana yang membuktikannya**.

> **Dokumen pendamping:**
> - [`AUDIT-OOP-BACKEND.md`](AUDIT-OOP-BACKEND.md) — audit Tahap 1 (temuan awal)
> - [`AUDIT-OOP-BACKEND-TAHAP2.md`](AUDIT-OOP-BACKEND-TAHAP2.md) — Tahap 2 & 3 (hasil)
> - [`DOKUMENTASI-OOP-BACKEND.md`](DOKUMENTASI-OOP-BACKEND.md) — peta lengkap tiap konsep → lokasi kode
> - [`presentasi/02-MODUL-DAN-ALGORITMA.md`](presentasi/02-MODUL-DAN-ALGORITMA.md) — tur per-modul
Semua rujukan berbentuk `path:baris` dan mengacu pada kode di repositori ini.

---

## 0. Ringkasan Satu Halaman

| Pilar | Wujud konkret | File kunci | Tes pembuktian |
|---|---|---|---|
| **Encapsulation** | `__table_name` (private) + `@property table_name` (read-only); `PromoView.__row`; tiga tingkat akses | `app/services/base.py:52`, `promo_service.py:46` | `test_private_table_name_is_inaccessible_from_outside`, `test_table_name_property_is_read_only` |
| **Abstraction** | 3 ABC dengan 7 `@abstractmethod` yang **menegakkan** kontrak | `app/services/base.py` | `test_abstract_base_cannot_be_instantiated`, `test_subclass_missing_an_abstract_method_is_still_rejected` |
| **Inheritance** | `SupabaseTableService` → 2 service; `BookRepository` → 2 repository; `ReportService` → dashboard | `base.py:31,163,206`, `book_service.py` | `test_crud_services_inherit_the_shared_framework`, `test_inherited_framework_methods_are_not_redefined_by_subclasses` |
| **Polymorphism** | Dispatch `self._serialize()`/`self._order_clause()`; override + `super()`; hook override | `promo_service.py:122,145` | `test_get_all_dispatches_to_each_subclass_serializer`, `test_promo_update_validates_then_delegates_to_super` |

**Angka hasil:** 137 tes lulus (112 lama + 25 baru) · ruff 270 (turun dari 307) ·
kontrak API identik.

---

## 1. Peta Hierarki (baca ini dulu)

Seluruh konstruksi di bawah berpusat di satu file baru: `app/services/base.py`.

```
abc.ABC
 │
 ├── SupabaseTableService(ABC)            ← kerangka CRUD satu tabel PostgREST
 │    │   STATE   : __table_name (PRIVATE, name-mangled)
 │    │   PROPERTY: table_name (PUBLIC, read-only)
 │    │   KONKRET : get_all, create, update, delete, _table(), _before_delete()
 │    │   ABSTRACT: _client, _order_clause, _serialize, get_by_id
 │    │
 │    ├── CategoryService                (category_service.py)
 │    │     mengisi : _client, _order_clause=("name", False),
 │    │              _serialize=identitas, get_by_id (.single())
 │    │     override: update()  — tanpa super() (ganti pemetaan field)
 │    │
 │    └── PromoService                   (promo_service.py)
 │          mengisi : _client, _order_clause=("created_at", True),
 │                   _serialize → PromoView, get_by_id (None bila kosong)
 │          override: update()  — DENGAN super()
 │                    _before_delete()  — hook
 │
 ├── BookRepository(ABC)                  ← kontrak baca katalog (satu antarmuka, dua sumber)
 │    │   KONKRET : _search_term() (@staticmethod, dibagi)
 │    │   ABSTRACT: get, list_page
 │    │
 │    ├── OrmBookRepository              (book_service.py) — async, pegang AsyncSession
 │    └── RestBookRepository             (book_service.py) — sync, stateless
 │
 └── ReportService(ABC)                   ← kontrak laporan (agregasi baca-saja)
      │   KONKRET : _is_revenue_order() (@staticmethod, aturan dibagi)
      │   ABSTRACT: get_summary
      │
      └── DashboardService               (dashboard_service.py) — tetap @staticmethod
```

Class mandiri (sengaja **tidak** masuk hierarki, lihat §6):
`OrderService`, `CartService`, `InventoryService`.

---

## 2. Encapsulation (Enkapsulasi)

**Prinsip:** yang di luar class tidak perlu tahu **bagaimana** sesuatu dikerjakan,
hanya **apa** yang bisa diminta.

### 2.1 Tiga tingkat akses dipakai secara sadar

| Tingkat | Mekanisme | Contoh nyata | Konsekuensi terukur |
|---|---|---|---|
| **Public** | nama biasa | `get_all`, `create`, `table_name`, `to_dict` | Dipanggil router; ini kontrak API |
| **Protected** | awalan `_` | `_client()`, `_table()`, `_serialize()`, `_search_term()`, `_before_delete()` | Boleh dipakai subclass; "jangan sentuh dari luar" |
| **Private** | `__` (name-mangled) | `SupabaseTableService.__table_name`, `PromoView.__row` | Dari luar → `AttributeError` |

### 2.2 `__table_name` — invariant yang dilindungi

```python
# app/services/base.py
class SupabaseTableService(ABC):
    TABLE: str = ""                    # subclass mengisi nama tabel

    def __init__(self) -> None:
        self.__table_name = self.TABLE # PRIVATE — di-mangle jadi _SupabaseTableService__table_name

    @property
    def table_name(self) -> str:
        """Nama tabel yang dilayani service ini (read-only)."""
        return self.__table_name       # satu-satunya pintu baca
```

**Kenapa `__` bukan `_`?** Nilai ini adalah **invariant**: "satu service melayani tepat
satu tabel". Kalau protected (`_table_name`), subclass bisa menimpanya dan merusak
asumsi seluruh kerangka CRUD (`get_all`/`create`/`delete` memakai `_table()` yang
membaca nilai ini). Karena private, subclass hanya bisa **membacanya** lewat
`@property table_name` yang **tidak punya setter**.

```python
CategoryService().table_name        # → "categories"     ✔ boleh
CategoryService().table_name = "x"  # → AttributeError   ✘ ditolak
CategoryService().__table_name      # → AttributeError   ✘ di-mangle, tidak terlihat
```

> **Catatan penting untuk presentasi:** name-mangling Python **bukan** keamanan —
> ia tetap bisa ditembus dengan `service._SupabaseTableService__table_name`. Yang
> ditegakkan adalah **niat**: kode yang menulis `self.__table_name` dari subclass akan
> gagal (`AttributeError`), sehingga programmer dipaksa lewat pintu resmi. Ini adalah
> konvensi, bukan sandbox.

### 2.3 `PromoView.__row` — data mentah tidak bocor

```python
# app/services/promo_service.py
class PromoView:
    def __init__(self, row: dict[str, Any]) -> None:
        self.__row = dict(row)         # PRIVATE — hanya status/to_dict yang keluar

    @property
    def status(self) -> str: ...
    def to_dict(self) -> dict[str, Any]: ...
```

Perhatikan `dict(row)` — barisnya **disalin**, bukan di-aliaskan. Artinya pemanggil
tidak bisa mengubah data di belakang objek ini setelah ia dibentuk. (Ada tesnya:
`test_view_copies_its_row_so_callers_cannot_mutate_behind_its_back`.)

### 2.4 Encapsulation yang sudah ada sebelumnya

| Lokasi | Yang disembunyikan | Caranya |
|---|---|---|
| `book_service.py:74` | Sesi database | `self._db` — router tidak pernah menyentuh sesi |
| `book_service.py:101` | Bentuk filter kueri | `_search_filters` |
| `api/v1/books.py:49` | Deteksi UNIQUE violation PostgreSQL | `_is_isbn_conflict` |
| `core/config.py:13` | Sumber konfigurasi | `Settings` + `settings`; modul lain baca `settings.X` |

**Bukti encapsulation bekerja:** `api/v1/books.py:120` hanya menulis
`OrmBookRepository(db).list_page(...)`. Ia tidak tahu ada `select()`, `func.count()`,
`ilike()`, atau `offset()` di baliknya. Kalau bentuk kueri berubah, router tidak ikut berubah.

---

## 3. Abstraction (Abstraksi)

**Prinsip:** menyederhanakan antarmuka, menyembunyikan kompleksitas.

### 3.1 Tiga ABC — bukan penanda, tapi penegak kontrak

| ABC | File | Abstract method | Wajib abstract karena… |
|---|---|---|---|
| `SupabaseTableService` | `base.py:31` | `_client`, `_order_clause`, `_serialize`, `get_by_id` | Semuanya **berbeda per tabel**; tidak ada default yang benar untuk keduanya |
| `BookRepository` | `base.py:163` | `get`, `list_page` | Kontrak baca; dua implementasi (async vs sync) |
| `ReportService` | `base.py:206` | `get_summary` | Kontrak laporan |

### 3.2 Empat abstract method `SupabaseTableService` — kenapa masing-masing

Ini bagian yang paling sering ditanya. Jawaban untuk tiap satu:

| Method | Kenapa **harus** diputuskan tiap subclass |
|---|---|
| `_client()` | Tiap modul service mengimpor `supabase_admin` ke namespace-nya sendiri, dan **tes menggantinya per modul** (`patch("app.services.promo_service.supabase_admin")`). Kalau diwarisi mentah dari induk, patch berhenti bekerja — 4 tes langsung gagal (ini benar-benar terjadi saat implementasi) |
| `_order_clause()` | `categories` → urut `name` naik; `promos` → urut `created_at` turun. Tidak ada default yang benar |
| `_serialize()` | `promos` mengubah numeric-as-string → float **dan** menambah `status` turunan; `categories` mengembalikan baris apa adanya |
| `get_by_id()` | **Semantik "tidak ada" berbeda**: `categories` memakai `.single()` (baris kosong melempar error), `promos` membaca daftar dan mengembalikan `None` |

### 3.3 Konsekuensi yang bisa dijalankan

```bash
cd backend
.venv/Scripts/python.exe -c "from app.services.base import SupabaseTableService as B; B()"
```

```
TypeError: Can't instantiate abstract class SupabaseTableService
           with abstract methods _client, _order_clause, _serialize, get_by_id
```

Dan subclass yang **hanya melengkapi sebagian tetap ditolak** Python — dibuktikan
`test_subclass_missing_an_abstract_method_is_still_rejected`. Inilah bedanya
`@abstractmethod` yang benar-benar ditegakkan versus yang hanya jadi dokumentasi.

### 3.4 Abstraksi yang **tetap** dihindari

- **`Protocol` untuk kedua repository buku** — model eksekusinya berbeda mendasar
  (`AsyncSession` hanya bisa di-`await`; klien `supabase` tidak punya varian async).
  Satu `Protocol` akan memaksa salah satu jalur memakai coroutine yang salah, sehingga
  typing-nya jadi tidak benar. Karena itu `BookRepository(ABC)` hanya menuntut
  **nama method** (`get`, `list_page`), bukan satu bentuk coroutine.
  → Penjelasan lengkap: docstring `app/services/book_service.py:20-30`.
- **ABC untuk satu implementasi** — `InventoryService` tidak punya implementasi kedua,
  jadi ABC untuknya hanya menambah lapisan tanpa manfaat.

---

## 4. Inheritance (Pewarisan)

**Prinsip:** mewarisi **kontrak dan perilaku bersama**; bukan sekadar menandai hubungan.

### 4.1 Hierarki yang benar-benar menghapus duplikasi

| Pewarisan | Duplikasi yang hilang |
|---|---|
| `SupabaseTableService` → `CategoryService`, `PromoService` | 5 method CRUD (`get_all`/`get_by_id`/`create`/`update`/`delete`) yang **tadinya digandakan** di dua file |
| `BookRepository` → `OrmBookRepository`, `RestBookRepository` | Logika "kapan kata kunci pencarian dianggap kosong" yang tadinya ditulis 2× (`_search_filters` vs `or_(...)` inline) |
| `ReportService` → `DashboardService` | Aturan "pesanan batal bukan penjualan" yang tadinya diulang di 2 method |

### 4.2 Cara memverifikasi bahwa kerangka benar-benar diwarisi

Bukan sekadar "class dasarnya ada", tetapi method-nya **tidak** didefinisikan ulang:

```python
# dibuktikan test_inherited_framework_methods_are_not_redefined_by_subclasses
assert "get_all" not in CategoryService.__dict__   # ✔ diwarisi
assert "create" not in PromoService.__dict__       # ✔ diwarisi
assert "get_all" in SupabaseTableService.__dict__  # ✔ hidup di induk
```

Cara mengeceknya sendiri kapan saja:

```bash
grep -rn "def get_all\|def create\|def delete" app/services/category_service.py app/services/promo_service.py
# → tidak ada hasil (keduanya mewarisi dari base.py)
```

### 4.3 `is-a` yang jujur (bukan pewarisan yang dipaksakan)

`CategoryService` dan `PromoService` adalah *"service yang melakukan CRUD atas tepat
satu tabel Supabase, dengan proyeksi kolom tetap, urutan tetap, dan aturan serialisasi
sendiri"*. Itu kontrak nyata dengan **dua implementasi yang memenuhinya** — ambang
minimum agar sebuah ABC pantas ada.

### 4.4 Pewarisan lain yang sudah ada (tetap dipertahankan)

| Pewarisan | Manfaat |
|---|---|
| `Base(DeclarativeBase)` → seluruh model ORM | Satu metadata tabel; Alembic baca `Base.metadata` |
| `CartItemNotFound(ValueError)`, `PromoNotFound(ValueError)` | Layer HTTP membedakan 404 vs 400 lewat **jenis** exception |
| `CategoryBase` → `CategoryCreate`/`CategoryResponse` | Field ditulis sekali |
| `Settings(BaseSettings)` | `.env` + validasi tipe otomatis |

**Bukti perilaku nyata dari pewarisan exception:** `api/v1/cart.py:70-73` — urutan
`except CartItemNotFound` (404) **sebelum** `except ValueError` (400) hanya bisa bekerja
karena `CartItemNotFound` adalah subclass `ValueError`. Exception yang lebih spesifik
ditangkap lebih dulu.

---

## 5. Polymorphism (Polimorfisme)

**Prinsip:** satu pemanggilan, banyak bentuk.

### 5.1 Dispatch lewat warisan — satu kode, perilaku berbeda

`SupabaseTableService.get_all()` memanggil `self._order_clause()` dan
`self._serialize(row)`. Satu potongan kode, hasil berbeda per subclass:

```python
def get_all(self) -> list[dict[str, Any]]:
    column, desc = self._order_clause()                                    # ← dispatch 1
    res = self._table().select(self.COLUMNS).order(column, desc=desc).execute()
    return [self._serialize(row) for row in (res.data or [])]              # ← dispatch 2
```

| Pemanggilan | `_order_clause()` | `_serialize(row)` | Hasil |
|---|---|---|---|
| `category_service.get_all()` | `("name", False)` | baris apa adanya | tanpa `status` |
| `promo_service.get_all()` | `("created_at", True)` | numeric→float + `status` | ada `status` |

Dibuktikan `test_get_all_dispatches_to_each_subclass_serializer` dan
`test_order_clause_differs_per_subclass`.

### 5.2 Method override + `super()`

`PromoService.update()` (`promo_service.py:122`) meng-**override** induknya. Ia
menambah aturan khas promo, lalu **mendelegasikan penulisan ke induk**:

```python
def update(self, promo_id: str, payload: PromoUpdate) -> dict[str, Any]:
    current = self.get_by_id(promo_id)                 # aturan khas promo
    if not current:
        raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")

    changes = payload.model_dump(mode="json", exclude_unset=True)
    if not changes:
        return current

    start = changes.get("start_date", current["start_date"])   # validasi rentang
    end = changes.get("end_date", current["end_date"])         # setelah patch
    if str(end) < str(start):
        raise ValueError("Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.")

    return super().update(promo_id, payload)           # ← kerangka induk
```

**Manfaat terukur:** validasi berjalan **sebelum** ada tulisan apa pun ke database.
Dibuktikan `test_promo_update_rejects_an_inverted_range_without_touching_the_parent`
yang memastikan `super().update` **tidak pernah dipanggil** saat validasi gagal.

### 5.3 Hook override (template method)

`delete()` di induk adalah **template method** — kerangkanya tetap, langkah tambahan
dititipkan lewat hook:

```python
# base.py — kerangka (induk)
def delete(self, row_id: str) -> None:
    self._before_delete(row_id)                       # ← hook, default no-op
    self._table().delete().eq("id", row_id).execute()

def _before_delete(self, row_id: str) -> None:
    return                                            # default: tidak melakukan apa-apa

# promo_service.py — mengisi hook
def _before_delete(self, promo_id: str) -> None:
    if not self.get_by_id(promo_id):
        raise PromoNotFound(f"Promo dengan ID {promo_id} tidak ditemukan.")
```

`CategoryService` **tidak** mengisi hook → menghapus langsung. `PromoService`
mengisinya → menolak lebih dulu. Titik pemanggilan (`svc.delete(id)`) identik.

### 5.4 Dua bentuk override — override dipilih sesuai kebutuhan

| Override | Pakai `super()`? | Kenapa |
|---|---|---|
| `PromoService.update` | **Ya** | Menambah aturan **di atas** kerangka; penulisan tetap satu sumber |
| `CategoryService.update` | **Tidak** | Mengganti pemetaan field secara utuh (`null` = "jangan ubah", bukan `exclude_unset`) |

Ini menunjukkan override bukan ritual: kadang menambah, kadang mengganti.

### 5.5 Polimorfisme lain yang sudah ada

| Bentuk | Lokasi | Wujud |
|---|---|---|
| Duck typing | `book_service.py` | `OrmBookRepository` & `RestBookRepository` memakai nama method sama |
| Duck typing di tes | `tests/test_books.py:35,180` | `EmptyBookSession`/`FakeSession` bukan `AsyncSession`, tetap dipakai repository |
| Polimorfisme exception | `api/v1/cart.py:70-73` | Satu blok `try`, dua jenis exception → 404 vs 400 |
| Serialisasi Pydantic | `schemas/book.py:77` | `from_attributes=True` menerima ORM **dan** dict |
| Generik | `schemas/common.py:7,20` | `ApiResponse[T]`, `PaginatedResponse[T]` |

---

## 6. Yang **Sengaja Tidak** Di-OOP-kan (dan alasannya)

Ini penting: menunjukkan OOP diterapkan sesuai kebutuhan, bukan dipaksakan.

| Hal | Status | Alasan |
|---|---|---|
| `OrderService`, `CartService` | **Tetap `@staticmethod`** | Orkestrasi lintas-tabel, bukan CRUD satu tabel. Memaksa ke `SupabaseTableService` menuntut `get_all`/`delete` yang tidak bermakna |
| `InventoryService` | **Tetap `@staticmethod`** | 3 method yang tidak berbagi kontrak CRUD |
| `DashboardService` | **`@staticmethod`, tapi mewarisi `ReportService`** | Berbagi **kontrak & aturan**, bukan state. Contoh pewarisan untuk kontrak |
| Helper modul-level (`_serialize`, `_serialize_order`, `_is_uuid`, `_adjust_stock`) | **Tetap di tempatnya** | Fungsi murni; tes lama mengimpornya langsung. `_serialize` promo kini mendelegasikan ke `PromoView` |
| `@classmethod` di service | **Tidak ada** | Tidak ada yang butuh `cls`. Hanya validator Pydantic (`schemas/book.py`) yang mensyaratkannya |
| `@property database_url` (`config.py`) | **Tidak dijadikan contoh** | Hanya alias murni, tidak ada komputasi |

**Aturan yang dipakai untuk instance vs static:**

> **Ada state → instance method. Tidak ada state → `@staticmethod`.**

| Berstate (instance) | Stateless (`@staticmethod`) |
|---|---|
| `CategoryService`, `PromoService` (nama tabel) | `OrderService`, `CartService` |
| `OrmBookRepository` (sesi DB) | `InventoryService`, `DashboardService` |

---

## 7. Bukti Terukur (angka nyata, 2026-10-14)

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q            # → 137 passed
.venv/Scripts/python.exe -m ruff check app tests # → 270 errors (baseline: 307)
```

| Pemeriksaan | Baseline | Sesudah | Catatan |
|---|---|---|---|
| `pytest` | 112 | **137** | +25 tes OOP; **112 tes lama tidak diubah satu baris pun** |
| `ruff` | 307 | **270** | Turun 37; berkas yang disentuh ikut dirapikan |
| Kontrak API (path + status) | — | **identik** | `app.openapi()`: 158 baris, `diff` bersih |
| Bentuk JSON serializer promo | — | **identik** | Kunci & tipe sama persis |
| Skema DB / migrasi / `.env` | — | **tidak ada** | — |
| Frontend | — | **tidak ada** | `frontend/` tidak disentuh |

### 7.1 25 tes di `tests/test_oop_contracts.py`

| Grup | Tes | Membuktikan |
|---|---|---|
| Abstract | `test_abstract_base_cannot_be_instantiated`, `test_subclass_missing_an_abstract_method_is_still_rejected` | `@abstractmethod` ditegakkan Python |
| Inheritance | `test_crud_services_inherit_the_shared_framework`, `test_book_repositories_share_one_contract`, `test_dashboard_inherits_the_report_contract`, `test_inherited_framework_methods_are_not_redefined_by_subclasses` | Hubungan is-a nyata + kerangka benar-benar diwarisi |
| Encapsulation | `test_private_table_name_is_inaccessible_from_outside`, `test_table_name_property_is_the_only_read_path`, `test_table_name_property_is_read_only`, `test_promo_view_hides_its_raw_row` | Private & property read-only |
| `@property` | `test_promo_status_is_derived_not_stored`, `test_inactive_flag_wins_over_the_date_window`, `test_status_tracks_the_data_the_view_was_built_from`, `test_view_copies_its_row_so_callers_cannot_mutate_behind_its_back` | Nilai turunan berkomputasi |
| Polymorphism | `test_get_all_dispatches_to_each_subclass_serializer`, `test_order_clause_differs_per_subclass` | Dispatch per subclass |
| Override | `test_promo_update_validates_then_delegates_to_super`, `test_promo_update_rejects_an_inverted_range_without_touching_the_parent`, `test_promo_delete_hook_runs_before_the_framework_delete` | Override + `super()` + hook |
| Kompatibilitas | `test_module_level_serialize_alias_still_resolves_and_matches`, `test_search_term_is_shared_by_both_book_repositories`, `test_report_service_excludes_cancelled_orders`, `test_book_repositories_satisfy_the_abc_without_extra_methods` | Refactor tidak memecah kontrak lama |

---

## 8. Cara Menjawab Pertanyaan Penguji

**"Tunjukkan encapsulation-nya."**
`SupabaseTableService.__table_name` itu **private** (name-mangled) — dari luar
`service.__table_name` → `AttributeError`, dan satu-satunya cara membacanya adalah
`@property table_name` yang **tidak punya setter**, jadi invariant "satu service = satu
tabel" tidak bisa dilanggar. Ini memakai **tiga** tingkat akses (public/protected/private),
bukan satu gaya.
→ `app/services/base.py:52`, `:55`

**"Abstraction-nya? Buktikan bukan cuma komentar."**
Jalankan `SupabaseTableService()` — langsung `TypeError`. Ada **empat** `@abstractmethod`:
`_client`, `_order_clause`, `_serialize`, `get_by_id`. Subclass yang hanya melengkapi
sebagian **tetap** ditolak. (Dulu proyek ini sengaja tidak punya ABC sama sekali — klaim
itu sudah dicabut dan digantikan tiga ABC ini.)
→ `app/services/base.py`

**"Inheritance-nya bermanfaat, atau cuma gaya?"**
Terukur: lima method CRUD yang **tadinya digandakan** antara `category_service.py` dan
`promo_service.py` kini ditulis sekali di induk. Buktinya bisa dicek langsung —
`grep "def get_all" app/services/category_service.py` tidak menghasilkan apa-apa.
Ditambah `BookRepository` yang menghapus duplikasi logika pencarian.
→ `app/services/base.py:31`, `:163`

**"Polymorphism-nya?"**
`get_all()` di induk memanggil `self._serialize()` dan `self._order_clause()`. Satu
pemanggilan, hasil **berbeda per subclass** — kategori tanpa `status`, promo dengan
`status`. Plus override + `super()` di `PromoService.update()`, di mana validasi
berjalan **sebelum** induk menulis (dibuktikan: `super().update` tidak dipanggil saat
validasi gagal).
→ `app/services/base.py:122`, `promo_service.py:122`

**"Kenapa tidak semua service dijadikan instance method?"**
Karena tidak semua punya state. Aturannya: **ada state → instance method; tidak ada →
`@staticmethod`**. `OrderService`/`CartService`/`InventoryService` tidak menyimpan apa
pun, jadi `self` akan menganggur dan menyesatkan pembaca.
→ `app/services/__init__.py`

**"Kenapa repository buku pakai `BookRepository(ABC)` padahal `async` vs sinkron?"**
Karena yang ditegakkan ABC adalah **nama method**, bukan bentuk coroutine. Kontrak baca
jadi eksplisit dan util pencarian dibagi. Yang tetap dihindari adalah memaksa satu
signature seragam — itu akan membuat typing salah.
→ docstring `app/services/book_service.py:20-30`

**"Bagaimana Anda tahu refactor ini tidak merusak apa pun?"**
Tiga hal: (1) 112 tes lama lulus **tanpa satu baris pun diubah**; (2) kontrak API
dibandingkan lewat `app.openapi()` sebelum/sesudah — 158 baris, `diff` bersih; (3) bentuk
JSON serializer promo dibandingkan kunci & tipenya — identik.
→ §7 di atas

---

## 9. Alur Baca Kode (urutan yang disarankan saat demo)

1. `app/services/base.py` — baca `SupabaseTableService` dari atas: `__init__` (state
   private), `table_name` (`@property`), empat `@abstractmethod`, lalu `get_all`/`create`/
   `delete` (kerangka), terakhir `_before_delete` (hook).
2. `app/services/category_service.py` — lihat betapa **pendeknya** sekarang: hanya yang
   khas `categories`.
3. `app/services/promo_service.py` — lihat `PromoView` (`@property status`), lalu
   `PromoService.update` (override + `super()`) dan `_before_delete` (hook).
4. `tests/test_oop_contracts.py` — jalankan file ini saja untuk memperlihatkan semua
   klaim di atas benar-benar diuji:
   ```bash
   .venv/Scripts/python.exe -m pytest tests/test_oop_contracts.py -q -v
   ```
5. `app/services/book_service.py` — tutup dengan dua repository (`BookRepository(ABC)`)
   dan alasan kenapa ABC di sini tidak memaksa satu model eksekusi.
