"""Validasi berkas gambar untuk unggahan.

Satu sumber untuk `uploads.py` (sampul produk) dan bukti pembayaran, supaya
batas ukuran serta format yang diterima tidak berbeda diam-diam antara dua
endpoint.

Tipe berkas **ditentukan dari isi**, bukan dari `Content-Type` kiriman browser:
header itu dapat dipalsukan, sedangkan signature tidak.
"""

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp")

#: (magic bytes, content type, ekstensi aman)
_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
)


def detect_image_type(data: bytes) -> tuple[str, str] | None:
    """Kembalikan (content_type, ekstensi) dari isi berkas; `None` bila bukan gambar.

    WebP tidak punya magic di awal berkas: `RIFF` + ukuran + `WEBP`.
    """
    for magic, content_type, extension in _SIGNATURES:
        if data.startswith(magic):
            return content_type, extension
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def validate_image(data: bytes, declared_content_type: str | None) -> tuple[str, str]:
    """Validasi isi berkas; kembalikan (content_type, ekstensi) yang tepercaya.

    Melempar `ValueError` dengan pesan siap tampil untuk pemanggil API.
    """
    if len(data) > MAX_FILE_SIZE:
        raise ValueError("Ukuran berkas terlalu besar. Maksimal 5MB.")
    if not data:
        raise ValueError("Berkas kosong.")
    detected = detect_image_type(data)
    if detected is None:
        raise ValueError(
            "Isi berkas bukan gambar JPEG, PNG, atau WebP yang valid."
        )
    if declared_content_type and declared_content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError(
            "Tipe file tidak didukung. Hanya JPEG, PNG, dan WebP yang diperbolehkan."
        )
    return detected
