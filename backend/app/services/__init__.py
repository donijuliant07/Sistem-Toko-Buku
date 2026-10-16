"""Business logic dan aturan bisnis.

Service adalah satu-satunya tempat aturan bisnis ditegakkan — layer API tidak
boleh mempercayai angka yang datang dari klien (harga, stok, ongkir, peran).
Token otorisasi (`require_admin`/`require_user`) tetap diperiksa di layer API,
bukan di sini.

Dua bentuk class hidup berdampingan di paket ini, dan pembagiannya disengaja:

1. **Service CRUD satu tabel** — `CategoryService` dan `PromoService` mewarisi
   `SupabaseTableService` (`app/services/base.py`). Keduanya **menyimpan state**
   (nama tabel), jadi method-nya *instance method* sungguhan dan kerangka
   `get_all`/`create`/`update`/`delete` ditulis sekali di induk. Kontrak yang
   berbeda per tabel (`_client`, `_order_clause`, `_serialize`, `get_by_id`)
   ditegakkan lewat `@abstractmethod`, sehingga subclass yang lupa mengisinya
   tidak bisa di-instansiasi.

2. **Service orkestrasi lintas-tabel** — `OrderService`, `CartService`,
   `InventoryService`, dan `DashboardService` **tetap class stateless**
   (`@staticmethod`). Mereka bukan CRUD satu tabel: `OrderService` mengatur
   pemotongan stok + nomor pesanan, `CartService` menjaga kepemilikan item,
   `DashboardService` beragregasi lintas tabel. Memaksakan mereka ke hierarki
   CRUD akan menuntut `get_all`/`delete` yang tidak bermakna, jadi bentuk
   `@staticmethod` di sini adalah jawaban jujur, bukan kemalasan.

`DashboardService` adalah kasus ketiga: ia mewarisi `ReportService`
(`app/services/base.py`) untuk **kontrak + aturan bersama** laporan, sambil tetap
`@staticmethod` karena tidak punya state untuk disimpan.

Bentuk keempat muncul bersama fitur perbandingan harga:

4. **Service ber-ketergantungan** — `MarketplaceComparisonService`
   (`app/services/marketplace/service.py`) menyimpan repository sumber dan
   repository harga sebagai state instance, plus `cache_ttl` dan `clock`. Ia
   **tidak** memakai `@staticmethod` justru karena ketergantungannya itulah yang
   membuatnya bisa diuji: pengujian menyuntikkan repository palsu dan waktu palsu
   lewat konstruktornya. Yang berbeda diserahkan ke adapter marketplace
   (`app/services/marketplace/base.py`), sehingga service ini tidak tahu apa-apa
   tentang Tokopedia atau Shopee secara spesifik.
"""
