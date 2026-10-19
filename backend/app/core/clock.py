"""Sumber tunggal "hari ini" untuk laporan dan status yang bergantung tanggal.

Server produksi berjalan di UTC; toko beroperasi di WIB. Memakai `date.today()`
membuat promo berakhir/berganti sehari lebih lambat dan laporan harian salah
zona, jadi semua tanggal bisnis dihitung lewat helper ini.

Offset ditulis tetap (UTC+7, tanpa DST) dan bukan `zoneinfo`, karena image
server Windows tidak selalu membawa database tzdata (`tzdata` belum menjadi
dependensi).
"""

from datetime import date, datetime, timedelta, timezone

STORE_TZ = timezone(timedelta(hours=7), name="WIB")


def store_now() -> datetime:
    """Waktu sekarang menurut zona waktu toko (WIB)."""
    return datetime.now(STORE_TZ)


def store_today() -> date:
    """Tanggal "hari ini" menurut zona waktu toko."""
    return store_now().date()
