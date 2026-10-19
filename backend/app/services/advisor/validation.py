"""Validasi keluaran model — batas antara "kata model" dan "data backend".

Model tidak dipercaya hanya karena mengembalikan JSON. Yang ditegakkan di sini:

- Setiap ID buku yang disebut model harus ada di daftar kandidat; ID asing
  dibuang, bukan diteruskan ke pengguna.
- Harga, stok, dan metadata di respons **tidak** diambil dari model — objek
  `CandidateBook` berasal dari repository.
- Skor kecocokan berasal dari ranking backend, bukan dari model.
- Teks bebas dipotong panjangnya dan `None`/bukan-string ditolak.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Any

from pydantic import ValidationError

from app.schemas.book_advisor import (
    BookPreferences,
    PreferenceDelta,
    ReadingLevel,
    Recommendation,
)
from app.services.advisor.ranking import ScoredCandidate

#: Batas panjang teks yang dikembalikan model.
MAX_REPLY_LENGTH = 1200
MAX_REASON_LENGTH = 300
MAX_QUESTION_LENGTH = 200

#: Anggaran pada pesan pengguna untuk fallback tanpa model.
#: Kelompok 1 = angka setelah "Rp", 2 = angka berseparator ribuan ("150.000"),
#: 3 = angka dengan akhiran "rb/ribu/k" ("150rb").
_BUDGET_PATTERN = re.compile(
    r"rp\.?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)\b"
    r"|(\d{1,3}(?:[.,]\d{3})+)\b"
    r"|(\d+(?:\.\d+)?)\s*(?:rb|ribu|k)\b",
    re.IGNORECASE,
)
_PLAIN_NUMBER = re.compile(r"\b(\d{4,})\b")

#: Frasa yang menandakan pembaca pemula.
_BEGINNER_WORDS = ("pemula", "beginner", "baru mulai", "awam")

#: Sapaan/obrolan ringan yang dibalas natural walau tanpa model.
_GREETING_PATTERN = re.compile(
    r"^\s*(halo|hallo|hai|hi|hey|pagi|siang|sore|malam|selamat (pagi|siang|sore|malam)|"
    r"permisi|assalamu\w*|kak|kakak|min)\b",
    re.IGNORECASE,
)
_THANKS_PATTERN = re.compile(r"\b(terima kasih|makasih|thanks|thx|oke|sip|mantap)\b", re.IGNORECASE)


def small_talk_reply(message: str) -> str | None:
    """Balasan ramah untuk sapaan/terima kasih; `None` bila pesannya bukan small talk.

    Dipakai hanya pada mode tanpa model. Tidak berusaha "mengerti" pesan —
    cukup mengakui obrolan lalu membuka pintu ke buku.
    """
    if _GREETING_PATTERN.search(message):
        return "Halo juga! Senang bertemu. Lagi pengin baca buku bertema apa hari ini?"
    if _THANKS_PATTERN.search(message) and len(message) <= 40:
        return "Sama-sama! Kalau mau, aku bisa carikan bacaan lain yang sekiranya cocok untukmu."
    return None


def _parse_budget(message: str) -> int | None:
    """Ambil anggaran rupiah pertama yang jelas dari pesan; `None` bila tidak ada."""
    match = _BUDGET_PATTERN.search(message)
    if match is None:
        plain = _PLAIN_NUMBER.search(message)
        return int(plain.group(1)) if plain else None
    raw = next(group for group in match.groups() if group)
    value = float(raw.replace(",", ".")) if match.group(3) else float(re.sub(r"\D", "", raw))
    # "150rb" = 150.000; angka berseparator ("150.000") sudah dalam rupiah.
    return int(value * 1000) if match.group(3) else int(value)


def heuristic_delta(message: str, preferences: BookPreferences) -> PreferenceDelta:
    """Ekstraksi darurat tanpa model untuk fitur yang wajib tetap jalan.

    Dipakai hanya bila Gemini tidak dikonfigurasi. Sengaja konservatif:
    hanya mengambil minat yang ada di kosakata `TOPIC_SYNONYMS` dan anggaran
    yang angka-angkanya jelas; tidak menebak gaya atau panjang buku.
    """
    from app.services.advisor.ranking import TOPIC_SYNONYMS

    text = message.casefold()
    data: dict[str, Any] = {}
    interests = [topic for topic in TOPIC_SYNONYMS if topic in text]
    if interests:
        data["interests"] = interests

    if (budget := _parse_budget(message)) is not None:
        data["max_budget"] = budget
    elif preferences.max_budget is not None and "murah" in text:
        # "cari yang lebih murah" tanpa angka: turunkan batas lama sebesar 20%.
        data["max_budget"] = max(1, int(Decimal(preferences.max_budget) * Decimal("0.8")))

    if any(word in text for word in _BEGINNER_WORDS):
        data["reading_level"] = ReadingLevel.BEGINNER

    try:
        return PreferenceDelta.model_validate(data)
    except ValidationError:
        return PreferenceDelta()

def _clean_text(value: Any, *, limit: int) -> str | None:
    """Ambil teks bersih dari model; `None` bila bukan string berisi."""
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())
    return text[:limit] or None

def _fallback_reason(candidate: ScoredCandidate, preferences: BookPreferences) -> str:
    """Alasan dari sinyal backend, dipakai bila model tidak memberi alasan sah."""
    book = candidate.book
    reasons: list[str] = []
    if candidate.matched_topics:
        reasons.append(f"cocok dengan minat {', '.join(candidate.matched_topics)}")
    if preferences.max_budget is not None:
        reasons.append(f"harga Rp{int(book.price):,} masih dalam anggaran".replace(",", "."))
    if book.category:
        reasons.append(f"termasuk kategori {book.category}")
    if book.stock > 0:
        reasons.append("stok tersedia")
    if not reasons:
        reasons.append(f"buku karya {book.author} di katalog toko")
    text = "; ".join(reasons)
    # `.capitalize()` menurunkan "Rp95.000" jadi "rp95.000"; besar huruf awal saja.
    return text[:1].upper() + text[1:] + "."

def _candidate_reason(raw: Any) -> str | None:
    """Alasan dari model: string atau `{"reason": ...}`; selain itu `None`."""
    if isinstance(raw, str):
        return _clean_text(raw, limit=MAX_REASON_LENGTH)
    if isinstance(raw, dict):
        return _clean_text(raw.get("reason"), limit=MAX_REASON_LENGTH)
    return None

def validate_recommendations(
    raw: Any,
    candidates: list[ScoredCandidate],
    preferences: BookPreferences,
) -> list[Recommendation]:
    """Pertahankan hanya rekomendasi yang menunjuk kandidat sah.

    Model boleh mengembalikan `book_id`/`id` dan alasan dalam beberapa bentuk
    umum. Yang tidak dikenali dilewati tanpa error — satu entri rusak tidak
    boleh menggagalkan seluruh respons. Bila model tidak menyebut buku apa pun
    (mis. menjawab dengan prosa), semua kandidat ranking dipakai dengan alasan
    backend, sehingga pengguna tetap mendapat hasil.
    """
    by_id = {str(item.book.id): item for item in candidates}
    validated: list[Recommendation] = []
    seen: set[str] = set()

    if isinstance(raw, list):
        for entry in raw:
            if not isinstance(entry, dict):
                continue
            book_id = str(entry.get("book_id") or entry.get("id") or "").strip()
            candidate = by_id.get(book_id)
            if candidate is None or book_id in seen:
                continue
            seen.add(book_id)
            validated.append(
                Recommendation(
                    book=candidate.book,
                    reason=_candidate_reason(entry.get("reason")) or _fallback_reason(candidate, preferences),
                    score=candidate.score,
                )
            )

    if validated:
        return validated

    return [
        Recommendation(book=item.book, reason=_fallback_reason(item, preferences), score=item.score)
        for item in candidates
    ]

def parse_extraction(raw: dict[str, Any]) -> tuple[str | None, str | None]:
    """Ambil `(assistant_message, follow_up_question)` yang aman ditampilkan."""
    return (
        _clean_text(raw.get("assistant_message"), limit=MAX_REPLY_LENGTH),
        _clean_text(raw.get("follow_up_question"), limit=MAX_QUESTION_LENGTH),
    )

def parse_explanation(
    raw: dict[str, Any],
    candidates: list[ScoredCandidate],
    preferences: BookPreferences,
) -> tuple[str | None, str | None, list[Recommendation]]:
    """Ambil `(assistant_message, follow_up_question, rekomendasi tervalidasi)`."""
    message, question = parse_extraction(raw)
    recommendations = validate_recommendations(raw.get("recommendations"), candidates, preferences)
    return message, question, recommendations

