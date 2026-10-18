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

    FRONTEND_ORIGINS: str = "http://localhost:3000"
    STORAGE_BUCKET_PRODUCTS: str = "product-images"

    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API Key")
    OPENROUTER_MODEL: str = Field(
        default="qwen/qwen-2.5-72b-instruct:free",
        description="Free OpenRouter Qwen Model",
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


settings = Settings()
