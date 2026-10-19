"""Pembatas laju pengiriman pesan — in-memory, per proses.

Sama seperti `_FULL_ATTEMPT_COOLDOWN` di marketplace dan `_LAST_FORCE_REFRESH`:
cukup untuk melindungi satu proses dari kiriman beruntun (klien macet yang
me-retry terus, atau tombol yang ditekan berulang). Ini **bukan** pembatas
terdistribusi — bila backend dijalankan lebih dari satu worker, batas efektif
menjadi N × batas.

Kuncinya per `(user_id, group_id)`: satu pengguna yang membanjiri satu ruang
tidak menutup kirimannya di ruang lain, dan anggota grup lain tidak terdampak.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Callable

#: Maksimum pesan per pengguna per grup dalam satu jendela waktu.
MAX_MESSAGES_PER_WINDOW = 10

#: Panjang jendela geser dalam detik.
WINDOW_SECONDS = 10.0


class SendRateLimiter:
    """Jendela geser berbasis monotonic clock; bisa disuntik waktu untuk uji."""

    def __init__(
        self,
        *,
        limit: int = MAX_MESSAGES_PER_WINDOW,
        window_seconds: float = WINDOW_SECONDS,
        clock: Callable[[], float] | None = None,
    ) -> None:
        self._limit = limit
        self._window = window_seconds
        self._clock = clock or time.monotonic
        self._hits: dict[tuple[str, str], deque[float]] = {}
        self._lock = threading.Lock()

    def retry_after(
        self, *, user_id: str, group_id: str
    ) -> float:
        """Catat satu kiriman.

        Mengembalikan `0.0` bila diterima, atau sisa detik sampai kiriman boleh
        dilakukan lagi (nilai > 0 berarti harus ditolak dengan 429). Kiriman
        yang ditolak **tidak** ikut dicatat supaya klien yang terus mencoba
        tidak memperpanjang masa tunggunya tanpa batas.
        """
        key = (str(user_id), str(group_id))
        now = self._clock()
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                hits = deque()
                self._hits[key] = hits
            cutoff = now - self._window
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self._limit:
                return max(hits[0] + self._window - now, 0.001)
            hits.append(now)
            return 0.0

    def reset(self, user_id: str | None = None, group_id: str | None = None) -> None:
        """Kosongkan catatan (dipakai pengujian, atau semua bila tanpa argumen)."""
        with self._lock:
            if user_id is None and group_id is None:
                self._hits.clear()
                return
            for key in list(self._hits):
                if (user_id is None or key[0] == str(user_id)) and (
                    group_id is None or key[1] == str(group_id)
                ):
                    del self._hits[key]
