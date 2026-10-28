# Base image resmi Microsoft Playwright: sudah berisi dependensi OS untuk Chromium.
# Versi image disamakan dengan paket `playwright` di `uv.lock` (1.64.0) supaya
# library sistem cocok dengan Chromium yang dipasang di bawah.
FROM mcr.microsoft.com/playwright/python:v1.64.0-noble

# Pasang binary uv resmi dari Astral
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# `PORT` sengaja TIDAK di-set di sini: platform (Railway/Render) menyuntikkan
# PORT sendiri, dan env var platform mengalahkan `.env`. Bila Dockerfile ikut
# menulis PORT, nilai itu menimpa PORT=8001 di `.env` lokal saat image dijalankan.
# Default bila tidak ada yang menyuntikkan: 8001 (src/config.py).
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Browser dipasang ke path milik root di dalam WORKDIR, bukan `/ms-playwright`
    # bawaan image: folder itu dimiliki user `pwuser`, sehingga `playwright install`
    # sebagai root bisa gagal EACCES di sebagian builder. Path ini menjamin
    # `install` dan runtime memakai lokasi yang sama dan writable.
    PLAYWRIGHT_BROWSERS_PATH=/app/.ms-playwright \
    # Mode API dipakai backend; cron worker cukup mengganti start command
    BROWSER_CHANNEL=chromium \
    HEADLESS=true

WORKDIR /app

# Copy definisi dependensi untuk memaksimalkan layer caching
COPY pyproject.toml uv.lock ./

# Install dependensi proyek via uv (tanpa dev dependency, sesuai uv.lock)
RUN uv sync --frozen --no-dev

# Pastikan Chromium versi paket `playwright` terpasang, bukan versi image.
# Base image Playwright sudah membawa library sistem yang dibutuhkan, jadi
# tidak perlu `--with-deps` (yang akan menjalankan apt dan memperlambat build).
# Baris `find` membuat build gagal di sini — bukan saat request pertama — bila
# binary tidak benar-benar mendarat di PLAYWRIGHT_BROWSERS_PATH.
RUN uv run playwright install chromium \
    && find "$PLAYWRIGHT_BROWSERS_PATH" -maxdepth 4 -name chrome -type f -print -quit | grep -q .

# Copy source code — isi `.dockerignore` menentukan apa yang ikut
COPY . .

EXPOSE 8001

# Default mode: server API (`POST /scrape`). Railway/Render menyuntikkan PORT
# sendiri, yang dibaca src/config.py lewat pydantic-settings.
CMD ["uv", "run", "python", "-m", "src.api"]
