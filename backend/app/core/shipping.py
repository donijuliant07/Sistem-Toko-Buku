"""Tarif ongkir sisi server.

Tidak ada API kurir yang terintegrasi, jadi ini tarif tetap per layanan — bukan
hasil perhitungan otomatis. Backend adalah sumber kebenaran: `courier`,
`courier_service`, dan `shipping_cost` pesanan selalu berasal dari sini, bukan
dari payload client.

ponytail: tabel statis. Ganti dengan kuotasi kurir (mis. RajaOngkir) begitu
ongkir perlu berbeda per tujuan/berat.
"""


# id -> (kurir, layanan, tarif)
SHIPPING_OPTIONS: dict[str, tuple[str, str, int]] = {
    "jne-reg": ("JNE", "REG", 20000),
    "jnt-ez": ("J&T Express", "EZ", 18000),
    "sicepat-reg": ("SiCepat", "REG", 17000),
    "anteraja-reg": ("AnterAja", "Reguler", 19000),
    "pos-reg": ("POS Indonesia", "Reguler", 22000),
}


def resolve(option_id: str | None) -> tuple[str, str, float]:
    """Kembalikan (courier, courier_service, fee) untuk id layanan yang sah."""
    option = SHIPPING_OPTIONS.get(option_id or "")
    if option is None:
        raise ValueError(
            f"Layanan pengiriman '{option_id}' tidak dikenal. "
            f"Pilihan yang tersedia: {', '.join(SHIPPING_OPTIONS)}."
        )
    courier, service, fee = option
    return courier, service, float(fee)
