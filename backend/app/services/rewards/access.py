"""Perhitungan reward dan akses — fungsi murni tanpa I/O.

Semua rumus Book Rewards ada di sini supaya bisa diuji tanpa database, dan
supaya service hanya bertugas mengambil data, memanggil RPC, dan menerjemahkan
kegagalan. Mengubah angka di sini juga mengubah test — bukan hanya perilaku
runtime yang tidak terlihat.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

#: Tingkat spoiler yang selalu gratis (tanpa syarat apa pun).
FREE_LEVELS = frozenset({"no_spoiler", "low"})

#: Tingkat spoiler yang bisa dibuka dengan syarat unit buku / poin.
PAID_LEVELS = ("medium", "heavy")

#: Metode akses yang disimpan di `ai_review_generations.access_method`.
ACCESS_FREE = "free"
ACCESS_PURCHASE = "purchase_eligibility"
ACCESS_POINTS = "points"


def purchase_points(total_paid: float | str | Decimal | None, per_unit: int) -> int:
    """Poin dari satu pesanan: `floor(total_paid / 10.000) * per_unit`.

    Memakai `Decimal` dari representasi string supaya pembulatan biner tidak
    membuat Rp20.000 terhitung satu kelipatan. Nilai negatif/NULL → 0.
    """
    if total_paid is None or per_unit <= 0:
        return 0
    try:
        amount = Decimal(str(total_paid))
    except (InvalidOperation, ValueError):
        return 0
    if not amount.is_finite() or amount <= 0:
        return 0
    return int(amount // Decimal(10_000)) * per_unit


@dataclass(frozen=True)
class SpoilerAccess:
    """Hasil penilaian satu tingkat spoiler untuk satu pengguna."""

    level: str
    #: Metode akses **bila level ini diminta sekarang**.
    method: str
    #: Poin yang akan dipotong bila `method == "points"`.
    cost: int
    #: Jumlah unit buku terkait yang sudah dibeli lewat pesanan selesai.
    units_bought: int
    min_units: int
    #: Benar bila level ini bisa dibuka tanpa membayar poin.
    granted: bool


def evaluate_access(
    *,
    level: str,
    units_bought: int,
    rules: dict[str, int],
) -> SpoilerAccess:
    """Tentukan metode dan biaya akses satu tingkat spoiler.

    - `no_spoiler`/`low` selalu gratis.
    - `medium`/`heavy` gratis bila unit buku terkait mencapai `min_units`;
      selain itu berbiaya poin (`spoiler_*_points`). Maksimal satu kali bayar
      untuk satu level buku, ditangani di service lewat ledger.
    """
    if level in FREE_LEVELS:
        return SpoilerAccess(
            level=level, method=ACCESS_FREE, cost=0, units_bought=units_bought,
            min_units=0, granted=True,
        )
    if level not in PAID_LEVELS:
        raise ValueError(f"Tingkat spoiler tidak dikenal: {level}")

    min_units = int(rules.get(f"spoiler_{level}_min_units", 0))
    cost = int(rules.get(f"spoiler_{level}_points", 0))
    if units_bought >= min_units:
        return SpoilerAccess(
            level=level, method=ACCESS_PURCHASE, cost=0, units_bought=units_bought,
            min_units=min_units, granted=True,
        )
    return SpoilerAccess(
        level=level, method=ACCESS_POINTS, cost=cost, units_bought=units_bought,
        min_units=min_units, granted=False,
    )


__all__ = [
    "ACCESS_FREE",
    "ACCESS_POINTS",
    "ACCESS_PURCHASE",
    "FREE_LEVELS",
    "PAID_LEVELS",
    "SpoilerAccess",
    "evaluate_access",
    "purchase_points",
]
