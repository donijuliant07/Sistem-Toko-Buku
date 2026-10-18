"""Konfigurasi scraper worker."""

import os
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/postgres",
        description="Database URL PostgreSQL/Supabase",
    )

    HEADLESS: bool = Field(default=True, description="Jalankan browser headless")
    BROWSER_CHANNEL: str = Field(
        default="chromium",
        description=(
            "Channel Chromium Playwright. 'chromium' memakai mode headless baru "
            "(bukan headless-shell lama) yang lolos di Tokopedia. Kosongkan = headless lama."
        ),
    )
    CONCURRENCY: int = Field(default=5, ge=1, le=5, description="Jumlah browser tab paralel")
    REQUEST_TIMEOUT_MS: int = Field(default=15000, description="Timeout halaman dalam milidetik")

    DELAY_MIN_SECONDS: float = Field(default=2.0, description="Jeda minimal antar pencarian")
    DELAY_MAX_SECONDS: float = Field(default=5.0, description="Jeda maksimal antar pencarian")

    MAX_BOOKS_PER_RUN: int = Field(default=0, description="Maks buku sekali run (0 = semua)")

    # --- Mode server API (`python -m src.api`, dipanggil backend) ---
    PORT: int = Field(default=8001, description="Port server API scraper")
    SCRAPER_API_TOKEN: str = Field(
        default="",
        description="Token yang wajib dikirim backend di header X-Scraper-Token (kosong = tanpa token)",
    )
    MAX_CONCURRENT_SCRAPES: int = Field(
        default=2,
        ge=1,
        le=4,
        description="Jumlah buku yang boleh di-scrape bersamaan di server API",
    )



settings = Settings()
