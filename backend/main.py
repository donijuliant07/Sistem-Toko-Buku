"""Menjalankan server pengembangan dengan alamat dari `.env` (`HOST`/`PORT`)."""

import uvicorn

from app.core.config import settings


def run() -> None:
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)


if __name__ == "__main__":
    run()
