"""Manajer browser Playwright dengan konfigurasi anti-deteksi dan penghemat resource."""

import asyncio
import logging
import random
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from playwright.async_api import Browser, BrowserContext, Page, async_playwright

from src.config import settings

logger = logging.getLogger(__name__)

# Rotasi User-Agent antar versi minor Chrome agar lebih natural
_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6367.212 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.141 Safari/537.36',
]

# Ekstensi resource berat yang diblokir demi kecepatan & hemat bandwidth
BLOCKED_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".mp4", ".webm", ".mp3",
)

BLOCKED_DOMAINS = (
    "google-analytics.com",
    "googletagmanager.com",
    "facebook.net",
    "hotjar.com",
    "doubleclick.net",
    "analytics.yahoo.com",
    "scorecardresearch.com",
    "criteo.com",
    "taboola.com",
    "moatads.com",
    "krxd.net",
    "adnxs.com",
)

# Stealth init script lengkap — menutupi fingerprint yang biasa bocor di headless
_STEALTH_SCRIPT = """
// Sembunyikan webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// Chrome runtime yang realistis
window.chrome = {
  app: {
    isInstalled: false,
    InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
    RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
  },
  runtime: {
    PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }
  },
  csi: function(){},
  loadTimes: function(){}
};

// Plugins realistis (bukan [1,2,3,4,5])
const mockPlugins = [
  { name: 'Chrome PDF Plugin',  filename: 'internal-pdf-viewer',              description: 'Portable Document Format' },
  { name: 'Chrome PDF Viewer',  filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
  { name: 'Native Client',      filename: 'internal-nacl-plugin',             description: '' }
];
Object.defineProperty(navigator, 'plugins', { get: () => mockPlugins });

// Fingerprint hardware
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
Object.defineProperty(navigator, 'deviceMemory',        { get: () => 8 });
Object.defineProperty(navigator, 'platform',            { get: () => 'Win32' });
Object.defineProperty(navigator, 'maxTouchPoints',      { get: () => 0 });

// Bahasa
Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });

// Screen color depth
Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

// Timezone offset Jakarta (WIB = UTC+7 = -420 menit)
Date.prototype.getTimezoneOffset = function() { return -420; };

// Notification permission = 'default' (headless biasanya 'denied')
try { Object.defineProperty(Notification, 'permission', { get: () => 'default' }); } catch(e) {}
"""

# Extra HTTP headers yang mensimulasikan browser nyata
_EXTRA_HTTP_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1',
}


class BrowserManager:
    """Mengelola siklus hidup Playwright Browser instance."""

    def __init__(self) -> None:
        self._playwright = None
        self._browser: Browser | None = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        """Nyalakan instance Playwright dan Chromium."""
        if self._browser is not None:
            return

        async with self._lock:
            if self._browser is not None:
                return
            self._playwright = await async_playwright().start()
            self._browser = await self._launch_browser()
            logger.info("Chromium browser berhasil dinyalakan.")

    def _launch_args(self) -> list[str]:
        return [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-infobars",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--disable-gpu",
        ]

    async def _launch_browser(self) -> Browser:
        """Nyalakan Chromium; pakai channel penuh bila tersedia.

        Tokopedia menolak headless-shell lama dengan ERR_HTTP2_PROTOCOL_ERROR,
        sedangkan mode headless baru (channel "chromium") lolos.
        """
        assert self._playwright is not None
        args = self._launch_args()
        if settings.BROWSER_CHANNEL:
            try:
                return await self._playwright.chromium.launch(
                    headless=settings.HEADLESS,
                    channel=settings.BROWSER_CHANNEL,
                    args=args,
                )
            except Exception as exc:  # noqa: BLE001 - channel mungkin belum diinstal
                logger.warning(
                    "Channel '%s' tidak tersedia (%s); fallback ke headless lama.",
                    settings.BROWSER_CHANNEL,
                    exc,
                )
        return await self._playwright.chromium.launch(headless=settings.HEADLESS, args=args)

    async def close(self) -> None:
        """Tutup browser dan hentikan Playwright."""
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None
        logger.info("Chromium browser ditutup.")

    @staticmethod
    def _user_agent() -> str:
        """Pilih UA secara acak dari daftar versi Chrome minor yang berbeda.

        Rotasi UA mempersulit identifikasi pola scraper berulang dari IP yang sama.
        """
        return random.choice(_USER_AGENTS)  # noqa: S311

    @asynccontextmanager
    async def new_page(self) -> AsyncGenerator[Page, None]:
        """Buat BrowserContext dan Page baru dengan stealth dan blokir resource."""
        if self._browser is None:
            await self.start()

        assert self._browser is not None
        context: BrowserContext = await self._browser.new_context(
            user_agent=self._user_agent(),
            viewport={"width": 1366, "height": 768},
            device_scale_factor=1,
            has_touch=False,
            locale="id-ID",
            timezone_id="Asia/Jakarta",
            color_scheme="light",
            ignore_https_errors=True,
            java_script_enabled=True,
            extra_http_headers=_EXTRA_HTTP_HEADERS,
        )

        page: Page = await context.new_page()

        # Terapkan stealth script lengkap untuk menghapus jejak automation
        await page.add_init_script(_STEALTH_SCRIPT)

        # Blokir file gambar, font, dan tracking agar scraping hemat kuota & 5x lebih cepat
        async def route_interceptor(route):
            req_url = route.request.url.lower()
            if any(ext in req_url for ext in BLOCKED_EXTENSIONS) or any(d in req_url for d in BLOCKED_DOMAINS):
                await route.abort()
            else:
                await route.continue_()

        await page.route("**/*", route_interceptor)
        page.set_default_timeout(settings.REQUEST_TIMEOUT_MS)

        try:
            yield page
        finally:
            await page.close()
            await context.close()


browser_manager = BrowserManager()
