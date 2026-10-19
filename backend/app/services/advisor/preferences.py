"""Penggabungan preferensi kumulatif dan penentuan kesiapan rekomendasi.

Aturan yang ditegakkan di sini (bukan di prompt):

- Field `None` pada delta berarti **belum diketahui**, jadi nilai lama
  dipertahankan. Ini yang membuat "cari yang lebih murah" hanya mengubah
  anggaran tanpa menghapus minat pengguna.
- Daftar digabung sebagai himpunan (case-insensitive), tidak menimpa.
- `reset_interests` adalah satu-satunya jalan mengganti minat, dan hanya
  dipakai bila pengguna benar-benar menyatakan topik barunya.
- Kesiapan dihitung backend dari data yang benar-benar ada di katalog.
"""

from typing import Any

from pydantic import ValidationError

from app.schemas.book_advisor import BookPreferences, PreferenceDelta

#: Preferensi yang katalog live benar-benar bisa cocokkan. Dipakai untuk
#: memilih pertanyaan lanjutan yang berguna — menanyakan panjang buku tidak ada
#: gunanya karena `books` tidak punya kolom halaman.
ACTIONABLE_PREFERENCES: tuple[str, ...] = (
    "interests",
    "genres",
    "reading_level",
    "reading_goals",
    "preferred_style",
    "max_budget",
    "favorite_authors",
)

#: Preferensi yang tidak punya metadata pendukung di katalog. Disimpan bila
#: pengguna menyebutkannya, tetapi tidak pernah dipakai untuk memberi skor dan
#: tidak ditanyakan.
UNSCORED_PREFERENCES: tuple[str, ...] = (
    "preferred_length",
    "preferred_language",
    "format_preferences",
    "availability_preferences",
)

def _merge_list(existing: list[str], delta: list[str] | None) -> list[str]:
    """Gabungkan dua daftar teks tanpa duplikat (case-insensitive)."""
    if not delta:
        return existing
    seen = {item.casefold() for item in existing}
    merged = list(existing)
    for item in delta:
        if item.casefold() not in seen:
            seen.add(item.casefold())
            merged.append(item)
    return merged

def merge_preferences(current: BookPreferences, delta: PreferenceDelta) -> BookPreferences:
    """Terapkan delta ke profil lama dan kembalikan profil baru.

    Tidak pernah memutasi `current`: state sesi diganti sebagai objek utuh
    supaya tidak ada perubahan setengah jadi bila validasi gagal.
    """
    data = current.model_dump()

    if delta.reset_interests and delta.interests:
        data["interests"] = []
    for field in (
        "interests",
        "genres",
        "reading_goals",
        "favorite_authors",
        "liked_books",
        "disliked_books",
        "format_preferences",
    ):
        data[field] = _merge_list(data[field], getattr(delta, field))

    for field in (
        "reading_level",
        "preferred_style",
        "preferred_language",
        "min_budget",
        "max_budget",
        "preferred_length",
        "availability_preferences",
    ):
        value = getattr(delta, field)
        if value is not None:
            data[field] = value

    # Anggaran yang baru disebut sebagian: "cari yang lebih murah" hanya
    # mengirim max_budget, dan min_budget lama dipertahankan. Bila hasilnya
    # rentang terbalik (mis. min 200rb, max baru 150rb), batas atas pengguna
    # adalah syarat wajib — batas bawah lama dibuang.
    if (
        data["min_budget"] is not None
        and data["max_budget"] is not None
        and data["min_budget"] > data["max_budget"]
    ):
        data["min_budget"] = None

    return BookPreferences.model_validate(data)

def missing_preferences(preferences: BookPreferences) -> list[str]:
    """Preferensi berguna yang masih kosong, urut prioritas.

    Hanya field yang bisa dicocokkan katalog; `reading_level` dan gaya tetap
    ditanyakan karena model boleh memakainya untuk memilih nada penjelasan,
    walau ranking tidak memberi skor untuk keduanya.
    """
    missing: list[str] = []
    if not preferences.interests and not preferences.genres:
        missing.append("interests")
    if not preferences.reading_goals and preferences.reading_level is None:
        missing.append("reading_level")
    if preferences.max_budget is None:
        missing.append("max_budget")
    if not preferences.favorite_authors:
        missing.append("favorite_authors")
    return [item for item in missing if item in ACTIONABLE_PREFERENCES]

def is_ready(preferences: BookPreferences) -> bool:
    """Apakah preferensi sudah cukup untuk mencari kandidat.

    Cukup bila ada minat/genre/penulis — anggaran dan tingkat pembaca hanya
    memperhalus ranking, bukan syarat. Pengguna tidak boleh dipaksa menjawab
    semua pertanyaan sebelum melihat rekomendasi.
    """
    return bool(preferences.interests or preferences.genres or preferences.favorite_authors)

def parse_delta(raw: Any) -> PreferenceDelta:
    """Validasi `extracted_preferences` dari model.

    Model tidak tepercaya: kunci asing dibuang oleh Pydantic, nilai enum dan
    rentang yang salah membuat seluruh delta ditolak (lebih aman daripada
    menyimpan sebagian data yang salah).
    """
    if not isinstance(raw, dict):
        return PreferenceDelta()
    try:
        return PreferenceDelta.model_validate(raw)
    except ValidationError:
        return PreferenceDelta()

def delta_from_user_changes(changes: dict[str, Any]) -> PreferenceDelta:
    """Perubahan eksplisit dari pengguna (PATCH) dibentuk sebagai delta.

    Daftar yang dikirim pengguna menggantikan daftar lama (permintaan langsung,
    bukan tebakan dari percakapan), sehingga `replace_lists` disetel di
    `merge_preferences`.
    """
    return parse_delta(changes)

def merge_user_changes(current: BookPreferences, changes: dict[str, Any]) -> BookPreferences:
    """Terapkan PATCH pengguna: daftar diganti, field skalar diubah bila dikirim."""
    data = current.model_dump()
    for key, value in changes.items():
        if value is None or key not in data:
            continue
        data[key] = value
    try:
        return BookPreferences.model_validate(data)
    except ValidationError:
        # Data pengguna yang tidak konsisten (mis. min > max) ditolak utuh.
        raise ValueError("Perubahan preferensi tidak valid.") from None
