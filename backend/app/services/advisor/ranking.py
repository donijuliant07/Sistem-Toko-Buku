"""Ranking kandidat buku — murni, tanpa I/O.

Skor = rata-rata berbobot dari sinyal yang **data katalognya tersedia**.
Sinyal yang metadatanya tidak ada (gaya penyampaian, panjang buku) tidak
diberi skor dan bobotnya dikeluarkan dari penyebut. Dengan begitu skor tetap
0..1 dan tidak lagi berarti "persen kecocokan", melainkan "kecocokan pada
sinyal yang diketahui" — itu sebabnya respons mengirim `match_score` beserta
`signals_available`, bukan angka presisi palsu.

Bobot dapat diganti tanpa menyentuh service: `rank_candidates(..., weights=...)`.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal

from app.schemas.book_advisor import BookPreferences, CandidateBook

DEFAULT_WEIGHTS: Mapping[str, float] = {
    "topic": 0.35,
    "reading_level": 0.20,
    "style": 0.20,
    "budget": 0.15,
    "length": 0.10,
}

#: Sinonim minat umum → kata kunci yang dicari di judul, deskripsi, dan nama
#: kategori. Ini kosakata *backend*, bukan keluaran model: model hanya
#: mengembalikan minat bebas ("startup"), dan pencocokan dilakukan di sini.
TOPIC_SYNONYMS: Mapping[str, tuple[str, ...]] = {
    "bisnis": ("bisnis", "business", "wirausaha", "usaha", "startup", "kewirausahaan", "entrepreneur"),
    "startup": ("startup", "start-up", "rintisan", "wirausaha", "kewirausahaan", "mvp", "founder"),
    "investasi": ("investasi", "invest", "saham", "reksa dana", "keuangan", "finansial", "uang"),
    "teknologi": ("teknologi", "technology", "komputer", "pemrograman", "coding", "digital", "kecerdasan buatan", "artificial intelligence"),
    "psikologi": ("psikologi", "psychology", "mindset", "mental", "emosi"),
    "pengembangan diri": ("pengembangan diri", "self", "kebiasaan", "habit", "produktif", "motivasi", "stoik", "filosofi"),
    "filsafat": ("filsafat", "filosofi", "stoik", "philosophy"),
    "sejarah": ("sejarah", "history", "kolonial", "perang"),
    "fiksi": ("novel", "fiksi", "cerita", "kisah"),
    "manga": ("manga", "komik", "comic"),
    "komik": ("komik", "manga", "comic"),
    "sains": ("sains", "science", "fisika", "biologi", "alam"),
    "kesehatan": ("kesehatan", "sehat", "gizi", "olahraga", "gaya hidup"),
    "anak": ("anak", "remaja", "kids", "dongeng"),
    "biografi": ("biografi", "memoar", "biography", "kisah hidup"),
    "agama": ("agama", "spiritual", "islam", "tauhid", "ibadah"),
}

@dataclass(frozen=True)
class ScoredCandidate:
    """Kandidat beserta skor dan rinciannya (rincian dipakai untuk alasan)."""

    book: CandidateBook
    score: float
    signals: Mapping[str, float]
    matched_topics: tuple[str, ...]

    @property
    def signals_available(self) -> tuple[str, ...]:
        """Sinyal yang benar-benar dinilai untuk kandidat ini."""
        return tuple(self.signals)

def _haystack(book: CandidateBook) -> str:
    """Teks gabungan yang boleh dicari: judul, penulis, kategori, deskripsi."""
    return " ".join(
        part for part in (book.title, book.author, book.category or "", book.description or "") if part
    ).casefold()

def _keyword_hit(keyword: str, text: str) -> bool:
    """Cocokkan kata kunci sebagai awal kata, bukan bagian kata lain.

    Pencocokan kasar (`"ai" in "Katolik"`) membuat hampir setiap buku cocok
    dengan hampir setiap minat. Kata kunci dicari utuh di awal kata sehingga
    "pengembangan diri" masih cocok dengan "pengembangan".
    """
    return re.search(rf"(?<![a-z0-9]){re.escape(keyword.strip())}", text) is not None

def topic_match(preferences: BookPreferences, book: CandidateBook) -> tuple[float | None, tuple[str, ...]]:
    """Fraksi minat/genre pengguna yang cocok dengan metadata buku.

    `None` bila pengguna belum menyebut minat apa pun — jangan menafsirkan
    data kosong sebagai kecocokan penuh.
    """
    wanted = [*preferences.interests, *preferences.genres]
    if not wanted:
        return None, ()
    text = _haystack(book)
    matched: list[str] = []
    for interest in wanted:
        key = interest.casefold().strip()
        if not key:
            continue
        keywords = {key, *TOPIC_SYNONYMS.get(key, ())}
        if any(_keyword_hit(keyword, text) for keyword in keywords if keyword.strip()):
            matched.append(interest)
    return len(matched) / len(wanted), tuple(matched)

def author_match(preferences: BookPreferences, book: CandidateBook) -> bool:
    """Apakah penulis buku termasuk penulis favorit (substring dua arah)."""
    author = book.author.casefold()
    return any(
        fav.casefold() in author or author in fav.casefold()
        for fav in preferences.favorite_authors
        if fav.strip()
    )

def budget_match(preferences: BookPreferences, book: CandidateBook) -> float:
    """Kecocokan harga: 1 bila di dalam rentang, turun proporsional bila lebih.

    Kandidat di atas `max_budget` seharusnya sudah difilter sebagai syarat
    wajib; skor ini hanya memeringkatkan yang berada di dalam rentang.
    """
    price = book.price
    if preferences.max_budget is not None and price > preferences.max_budget:
        return 0.0
    if preferences.min_budget is not None and price < preferences.min_budget:
        span = preferences.min_budget - price
        return max(0.0, 1.0 - float(span / (preferences.min_budget or Decimal(1))))
    return 1.0

def rank_candidates(
    preferences: BookPreferences,
    candidates: Sequence[CandidateBook],
    *,
    weights: Mapping[str, float] | None = None,
) -> list[ScoredCandidate]:
    """Urutkan kandidat dari yang paling cocok, secara deterministik.

    Tie-break: harga lebih murah lebih dulu, lalu judul (casefold) — supaya
    dua kali pencarian dengan preferensi sama selalu memberi urutan sama.
    """
    weights = weights or DEFAULT_WEIGHTS
    scored: list[ScoredCandidate] = []
    for book in candidates:
        topic, matched = topic_match(preferences, book)
        # Penulis favorit yang cocok adalah sinyal topik yang kuat; diambil
        # sebagai nilai topik bila minat tidak disebut pengguna sama sekali.
        if author_match(preferences, book):
            topic = max(topic or 0.0, 1.0)
            matched = (*matched, book.author)
        signals: dict[str, float | None] = {
            "topic": topic,
            # `books` tidak punya kolom tingkat pembaca/panjang/gaya: nilainya
            # selalu None sehingga bobotnya dikeluarkan dari penyebut.
            "reading_level": None,
            "style": None,
            "budget": budget_match(preferences, book),
            "length": None,
        }
        known = {name: value for name, value in signals.items() if value is not None}
        total_weight = sum(weights[name] for name in known)
        score = sum(value * weights[name] for name, value in known.items()) / total_weight if total_weight else 0.0
        scored.append(
            ScoredCandidate(
                book=book,
                score=round(min(1.0, max(0.0, score)), 4),
                # Hanya sinyal yang dinilai yang dilaporkan; `None` dibuang
                # supaya klien tidak membacanya sebagai "tidak cocok".
                signals={name: value for name, value in signals.items() if value is not None},
                matched_topics=matched,
            )
        )

    scored.sort(key=lambda item: (-item.score, item.book.price, item.book.title.casefold()))
    return scored
