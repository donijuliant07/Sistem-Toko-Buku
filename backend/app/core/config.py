"""Konfigurasi aplikasi dari variabel lingkungan atau berkas `.env`.

`Settings` adalah satu-satunya tempat nilai konfigurasi dideklarasikan;
modul lain mengimpornya lewat objek `settings` yang sudah di-instansiasi di
bawah. Nilai default sengaja permisif untuk pengembangan lokal, tetapi wajib
ditimpa di lingkungan nyata (lihat `.env.example`).
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Nilai konfigurasi backend, dibaca dari `.env` dengan fallback default."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "PustakaGram Admin REST API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    SUPABASE_URL: str = Field(default="https://your-project.supabase.co", description="URL Project Supabase")
    SUPABASE_ANON_KEY: str = Field(default="your-anon-key", description="Anon Key Supabase")
    SUPABASE_SERVICE_ROLE_KEY: str = Field(default="your-service-role-key", description="Service Role Key Supabase")
    SUPABASE_JWT_SECRET: str = Field(default="super-secret-jwt-key", description="JWT Secret Supabase Auth")

    #: Kedua ejaan loopback didaftarkan: browser Windows bisa membuka dev server
    #: lewat `127.0.0.1` sementara origin `localhost` saja akan ditolak CORS.
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    STORAGE_BUCKET_PRODUCTS: str = "product-images"
    #: Bucket privat bukti pembayaran. Browser tidak pernah mengaksesnya
    #: langsung; backend membuat signed URL berumur pendek.
    STORAGE_BUCKET_PAYMENT_PROOFS: str = "payment-proofs"
    #: Umur signed URL bukti (detik). Cukup untuk membuka/zoom satu gambar,
    #: tidak cukup untuk dibagikan ulang.
    PAYMENT_PROOF_SIGNED_URL_TTL: int = Field(default=300, ge=30)

    #: Google AI Studio (Gemini API) untuk Penasihat Buku (`/book-advisor`).
    #: Dibuat gratis di https://aistudio.google.com/apikey . Kosong = Penasihat
    #: Buku memakai fallback aturan tanpa memanggil model.
    GEMINI_API_KEY: str = Field(default="", description="Google AI Studio (Gemini) API Key")
    GEMINI_MODEL: str = Field(
        default="gemini-3.5-flash",
        description="Model Gemini untuk Penasihat Buku",
    )
    #: Base URL API Gemini. Bisa diarahkan ke gateway lain yang kompatibel.
    GEMINI_BASE_URL: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta",
        description="Base URL Google Gemini API",
    )
    #: Batas satu panggilan model (detik). Lebih kecil dari batas request
    #: frontend supaya pengguna menerima fallback, bukan timeout kosong.
    GEMINI_TIMEOUT_SECONDS: float = Field(
        default=30.0, gt=0, description="Batas waktu panggilan model Gemini"
    )
    #: Batas token keluaran per panggilan — kontrol biaya/kuota per giliran.
    #: Model Gemini 3 menghitung token "berpikir" ke dalam batas ini, jadi
    #: nilainya harus cukup untuk berpikir **dan** menulis JSON balasan:
    #: dengan 900 token, JSON sering terpotong dan balasan jatuh ke aturan.
    GEMINI_MAX_OUTPUT_TOKENS: int = Field(
        default=2048, ge=64, description="Token keluaran maksimum Gemini"
    )
    #: Anggaran token "berpikir" (Gemini 3) per panggilan. Diisi 0 untuk
    #: mematikan mode berpikir; kosong berarti biarkan default provider.
    #: Token berpikir dihitung ke `max_output_tokens`, jadi pekerjaan JSON
    #: pendek seperti milik advisor tidak perlu mode berpikir panjang.
    GEMINI_THINKING_BUDGET: int | None = Field(
        default=0,
        ge=0,
        description="Token thinkingBudget Gemini; 0 = mati, kosong = default provider",
    )

    #: OpenRouter — dipakai ulasan AI dan validator harga marketplace (bukan
    #: Penasihat Buku, yang memakai Gemini).
    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key")
    OPENROUTER_MODEL: str = Field(
        default="nvidia/nemotron-3-ultra-550b-a55b:free",
        description="Model gratis OpenRouter",
    )
    #: Endpoint Chat Completions OpenRouter. Bisa diarahkan ke gateway lain
    #: yang kompatibel tanpa mengubah kode.
    OPENROUTER_BASE_URL: str = Field(
        default="https://openrouter.ai/api/v1",
        description="Base URL API OpenRouter",
    )
    #: Batas satu panggilan model (detik). Lebih kecil dari batas request
    #: frontend supaya pengguna menerima fallback, bukan timeout kosong.
    OPENROUTER_TIMEOUT_SECONDS: float = Field(
        default=30.0, gt=0, description="Batas waktu panggilan model OpenRouter"
    )
    #: Batas token keluaran per panggilan — kontrol biaya per giliran.
    OPENROUTER_MAX_OUTPUT_TOKENS: int = Field(
        default=900, ge=64, description="Token keluaran maksimum OpenRouter"
    )

    #: Kunci API Google Books, dipakai adapter `google_books`. Kuota harian untuk
    #: permintaan tanpa kunci terukur `0`, jadi tanpa nilai ini setiap pencarian
    #: harga Google Books berakhir HTTP 429. Dibuat gratis di Google Cloud Console
    #: (aktifkan "Books API" lalu buat API key). Kosong = fitur tetap jalan,
    #: hanya marketplace itu yang muncul di `warnings`.
    GOOGLE_BOOKS_API_KEY: str = Field(default="", description="Google Books API Key")

    #: Alamat service scraper Playwright (`scraper-service`, `POST /scrape`).
    #: Kosong = harga marketplace e-commerce hanya diambil dari adapter bawaan,
    #: yang saat ini diblokir anti-bot — UI tetap jalan dengan peringatan.
    SCRAPER_SERVICE_URL: str = Field(default="", description="URL service scraper Playwright")

    #: Token yang dikirim ke service scraper (header `X-Scraper-Token`).
    SCRAPER_API_TOKEN: str = Field(default="", description="Token service scraper")

    #: Batas satu panggilan service scraper. Harus lebih kecil dari
    #: `SCRAPE_TIMEOUT_SECONDS` supaya backend sempat melaporkan kegagalannya.
    SCRAPER_TIMEOUT_SECONDS: float = Field(default=20.0, gt=0, description="Batas waktu panggilan scraper")

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        description="Database URL PostgreSQL",
    )

    #: Umur maksimum koneksi pool sebelum didaur ulang (detik). Supabase memutus
    #: koneksi yang menganggur; tanpa ini permintaan pertama setelah diam lama
    #: gagal sekali lalu mencoba lagi — terlihat sebagai "freeze" di UI.
    DATABASE_POOL_RECYCLE_SECONDS: int = Field(default=1800, ge=60)

    @property
    def database_url(self) -> str:
        """URL database untuk engine SQLAlchemy (`app.db.session`)."""
        return self.DATABASE_URL

    @property
    def cors_origins(self) -> list[str]:
        """Daftar origin frontend hasil pemisahan `FRONTEND_ORIGINS` per koma.

        Nilai kosong dibuang supaya koma berlebih di `.env` tidak menghasilkan
        origin string kosong yang membuat CORS menolak secara tidak terduga.
        """
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    @property
    def dev_lan_origins_trusted(self) -> bool:
        """Origin LAN dev (port 3000) boleh diterima saat mengembangkan.

        Next `next dev` mendengarkan di semua antarmuka, sehingga dev server
        kadang dibuka lewat IP LAN (mis. `http://192.168.1.5:3000`). Origin
        seperti itu tidak bisa didaftarkan sekali untuk semua mesin, jadi hanya
        di `development` kita memakai `allow_origin_regex` untuk jaringan privat
        (127.0.0.0/8, 10/8, 172.16/12, 192.168/16) pada port 3000. Di
        production regex tidak dipakai sama sekali — hanya daftar eksplisit.
        """
        return self.ENVIRONMENT == "development"


settings = Settings()
