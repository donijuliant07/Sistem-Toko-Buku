"""Katalog aturan reward yang boleh diubah admin.

Satu sumber kebenaran untuk tiga tempat yang tidak boleh berbeda diam-diam:
migrasi `20261019_11` (CHECK + nilai awal), validasi API saat admin mengubah
aturan, dan pembacaan default bila baris belum ada di tabel `reward_rules`.

Nilai disimpan sebagai `bigint` per key (bukan JSON bebas) supaya salah tipe
atau nilai negatif ditolak database; `MAX_VALUE` membatasi salah ketik.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RuleDefinition:
    key: str
    default: int
    #: Batas atas saat admin mengubah aturan. Cukup longgar untuk penyesuaian
    #: ekonomi, tetapi menolak angka yang jelas salah (mis. 10^9 poin).
    max_value: int


RULES: tuple[RuleDefinition, ...] = (
    #: Poin per kelipatan Rp10.000 pada `total_paid` pesanan selesai.
    RuleDefinition("purchase_points_per_10000", 10, 1000),
    #: Poin untuk satu ulasan yang disetujui moderator (maks. 1 per user/buku).
    RuleDefinition("review_points", 20, 1000),
    #: Poin untuk satu kontribusi diskusi yang disetujui moderator grup.
    RuleDefinition("community_contribution_points", 5, 1000),
    #: Batas jumlah reward kontribusi per pengguna per hari (Asia/Jakarta).
    RuleDefinition("community_contribution_daily_cap", 2, 100),
    #: Poin untuk satu jawaban yang ditandai "membantu" oleh cukup anggota lain.
    RuleDefinition("helpful_answer_points", 10, 1000),
    #: Batas jumlah reward jawaban bermanfaat per pengguna per hari.
    RuleDefinition("helpful_answer_daily_cap", 3, 100),
    #: Biaya poin satu generasi AI review tingkat `medium` (bila belum punya buku).
    RuleDefinition("spoiler_medium_points", 100, 100_000),
    #: Biaya poin satu generasi AI review tingkat `heavy` (bila belum punya buku).
    RuleDefinition("spoiler_heavy_points", 300, 100_000),
    #: Unit buku dari pesanan selesai untuk membuka `medium` secara gratis.
    RuleDefinition("spoiler_medium_min_units", 1, 1000),
    #: Unit buku dari pesanan selesai untuk membuka `heavy` secara gratis.
    RuleDefinition("spoiler_heavy_min_units", 3, 1000),
    #: Jumlah penanda "membantu" berbeda yang membuat jawaban mendapat reward.
    RuleDefinition("helpful_answer_min_marks", 2, 50),
    #: Biaya poin satu pesan yang benar-benar diproses AI Book Advisor.
    RuleDefinition("advisor_message_points", 10, 1000),
)

RULES_BY_KEY: dict[str, RuleDefinition] = {rule.key: rule for rule in RULES}

#: Nilai awal per key; juga dipakai bila baris belum ada di tabel.
DEFAULT_VALUES: dict[str, int] = {rule.key: rule.default for rule in RULES}

__all__ = ["DEFAULT_VALUES", "RULES", "RULES_BY_KEY", "RuleDefinition"]
