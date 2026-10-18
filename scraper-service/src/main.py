"""Entry point untuk Scraper Worker Service."""

import asyncio
import logging
import sys

from src.pipeline import run_scrape_pipeline

# Konfigurasi logging standar
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger("scraper_main")


def run_cli() -> None:
    """Fungsi pembungkus untuk entry point CLI."""
    asyncio.run(main())


async def main() -> None:
    """Eksekusi utama saat cron Railway atau script lokal dijalankan."""
    logger.info("Service Scraper dijalankan...")
    try:
        results = await run_scrape_pipeline()
        logger.info(f"Hasil eksekusi: {results}")
    except Exception as e:
        logger.exception(f"Terjadi kesalahan fatal saat menjalankan pipeline: {e}")
        sys.exit(1)


if __name__ == "__main__":
    run_cli()
