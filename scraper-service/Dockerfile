# Base image resmi Microsoft Playwright: sudah berisi dependensi OS untuk Chromium.
# Tag dipin ke versi stabil terbaru yang tersedia; versi paket `playwright` di
# `uv.lock` (1.64) tetap memasang Chromium miliknya sendiri lewat
# `playwright install chromium` di bawah, sehingga binary selalu cocok dengan paket.
FROM mcr.microsoft.com/playwright/python:v1.63.0-noble

# Pasang binary uv resmi dari Astral
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    # Browser disimpan di lokasi default image agar tidak hilang bila user berubah
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    # Mode API dipakai backend; cron worker cukup mengganti start command
    PORT=8000 \
    BROWSER_CHANNEL=chromium \
    HEADLESS=true

WORKDIR /app

# Copy definisi dependensi untuk memaksimalkan layer caching
COPY pyproject.toml uv.lock ./

# Install dependensi proyek via uv (tanpa dev dependency, sesuai uv.lock)
RUN uv sync --frozen --no-dev

# Pastikan Chromium versi paket `playwright` terpasang (bukan versi image)
RUN uv run playwright install chromium

# Copy source code — isi `.dockerignore` menentukan apa yang ikut
COPY . .

EXPOSE 8000

# Default mode: server API (`POST /scrape`). Railway menyuntikkan PORT sendiri,
# yang dibaca src/config.py lewat pydantic-settings.
CMD ["uv", "run", "python", "-m", "src.api"]
