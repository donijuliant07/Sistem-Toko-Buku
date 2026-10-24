"""Uji bucket `payment-proofs`: privat, bisa unggah/baca via signed URL, lalu bersihkan.

Dijalankan manual (bukan bagian pytest) karena menyentuh Supabase Storage live:

    uv run python scripts/smoke_payment_bucket.py
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

from supabase import create_client

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BUCKET = "payment-proofs"
# PNG 1x1 transparan — cukup untuk menguji jalur unggah/baca.
PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000100ffff03000006"
    "0005574bd4ee0000000049454e44ae426082"
)


def main() -> int:
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    bucket = client.storage.from_(BUCKET)
    path = f"smoke-test/{uuid.uuid4()}.png"

    bucket.upload(path, PNG_1PX, {"content-type": "image/png", "upsert": "false"})
    print(f"unggah     : ok ({path})")

    signed = bucket.create_signed_url(path, 60)["signedURL"]
    if signed.startswith("http"):
        url = signed
    else:
        url = f"{os.environ['SUPABASE_URL']}/storage/v1{signed}"

    with httpx.Client(timeout=20) as http:
        response = http.get(url)
        response.raise_for_status()
        assert response.content == PNG_1PX, "isi objek tidak cocok"
        print("signed URL : ok, isi cocok")

        public = f"{os.environ['SUPABASE_URL']}/storage/v1/object/public/{BUCKET}/{path}"
        public_status = http.get(public).status_code
        assert public_status >= 400, f"bucket bocor ke publik (HTTP {public_status})"
        print(f"akses publik: ditolak (HTTP {public_status})")

    bucket.remove([path])
    print("bersih     : objek sementara dihapus")
    return 0


if __name__ == "__main__":
    sys.exit(main())