"""Kontrak error Book Rewards.

Service melempar `RewardsError`; router menerjemahkannya menjadi
`HTTPException`. Detail selalu diawali kode mesin (mis.
`INSUFFICIENT_POINTS: ...`) supaya frontend bisa bereaksi tanpa mencocokkan
teks Bahasa Indonesia, dan kodenya sama dengan kode `RAISE EXCEPTION` di RPC
`apply_point_transaction` — satu kosa kata dari database sampai UI.
"""

from __future__ import annotations


class RewardsError(Exception):
    """Kesalahan reward yang sudah dipetakan ke status HTTP dan kode mesin."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.status_code = status_code
        self.code = code
        self.message = message

    @property
    def detail(self) -> str:
        return f"{self.code}: {self.message}"


def insufficient_points(needed: int, balance: int) -> RewardsError:
    return RewardsError(
        400,
        "INSUFFICIENT_POINTS",
        f"Poin tidak cukup (butuh {needed}, saldo {balance}).",
    )


def daily_cap_reached(kind: str) -> RewardsError:
    return RewardsError(
        429,
        "DAILY_CAP_REACHED",
        f"Batas harian reward {kind} sudah tercapai. Coba lagi besok.",
    )


def idempotency_conflict() -> RewardsError:
    return RewardsError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Kunci idempotensi sudah dipakai untuk transaksi lain.",
    )


def reward_already_claimed() -> RewardsError:
    return RewardsError(
        409,
        "REWARD_ALREADY_CLAIMED",
        "Reward untuk sumber ini sudah pernah diberikan.",
    )


def not_eligible(reason: str) -> RewardsError:
    return RewardsError(409, "NOT_ELIGIBLE", reason)


def invalid_request(message: str) -> RewardsError:
    return RewardsError(422, "INVALID_REQUEST", message)


#: Kode yang dilempar RPC PostgreSQL (`RAISE EXCEPTION '<CODE>'`).
_RPC_CODES: dict[str, RewardsError] = {
    "INVALID_DELTA": invalid_request("Nilai poin tidak boleh nol."),
    "PROFILE_NOT_FOUND": RewardsError(404, "PROFILE_NOT_FOUND", "Profil tidak ditemukan."),
    "IDEMPOTENCY_CONFLICT": idempotency_conflict(),
    "INSUFFICIENT_POINTS": RewardsError(
        400, "INSUFFICIENT_POINTS", "Poin tidak cukup untuk operasi ini."
    ),
    "DAILY_CAP_REACHED": daily_cap_reached("aktivitas"),
}


def from_rpc_error(exc: Exception) -> RewardsError | None:
    """Petakan pesan RPC PostgreSQL ke `RewardsError`.

    Hanya code `P0001`–`P0004` yang dipakai RPC kita yang diterjemahkan;
    pelanggaran constraint lain dibiarkan naik sebagai bug, bukan pesan bisnis.
    """
    orig = getattr(exc, "orig", exc)
    # PostgREST (`SupabaseLedger`, jalur produksi) membungkus sqlstate di dict
    # `.json` (`{"code": "P0004", "message": "INSUFFICIENT_POINTS", ...}`);
    # SQLAlchemy menaruhnya di `sqlstate`/`pgcode`. Tanpa jalur pertama, saldo
    # kurang tampil sebagai 500 alih-alih 400 ber-kode.
    payload = getattr(exc, "json", None)
    if callable(payload):
        payload = payload()
    payload = payload if isinstance(payload, dict) else {}
    sqlstate = (
        getattr(orig, "sqlstate", None)
        or getattr(orig, "pgcode", None)
        or payload.get("code")
    )
    if sqlstate not in {"P0001", "P0002", "P0003", "P0004"}:
        return None
    text = f"{orig} {payload.get('message') or ''}"
    for code, error in _RPC_CODES.items():
        if code in text:
            return error
    return None


__all__ = [
    "RewardsError",
    "daily_cap_reached",
    "from_rpc_error",
    "idempotency_conflict",
    "insufficient_points",
    "invalid_request",
    "not_eligible",
    "reward_already_claimed",
]
