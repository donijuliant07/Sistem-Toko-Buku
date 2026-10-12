"""Pesanan: pembuatan, pembacaan, perubahan status, dan pemulihan stok.

Modul ini memegang aturan bisnis paling penting di toko:

- **Harga, judul, dan berat item berasal dari tabel `books`**, bukan dari
  payload klien (`create` menimpanya).
- **Ongkir ditentukan server** lewat `app.core.shipping`; klien hanya memilih
  `shipping_option_id`.
- **Stok dipotong di sini** — satu-satunya jalur yang memotong — dan
  dikembalikan saat pesanan dibatalkan atau kedaluwarsa.

Catatan transaksi: operasi lintas tabel dijalankan sebagai beberapa panggilan
PostgREST berurutan dengan kompensasi manual, bukan satu transaksi database.
Lihat komentar pada `_adjust_stock` untuk batasannya.
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin
from app.core import shipping
from app.schemas.order import OrderCreate, OrderStatusUpdate

# Berapa kali nomor pesanan diacak ulang bila bentrok dengan UNIQUE constraint.
_ORDER_NUMBER_ATTEMPTS = 5


def _generate_order_number() -> str:
    return f"INV/{datetime.now().strftime('%Y%m%d')}/{random.randint(1000, 9999)}"


def _is_unique_violation(error: Exception) -> bool:
    """Deteksi pelanggaran UNIQUE dari PostgREST/asyncpg tanpa bergantung librarynya."""
    code = getattr(error, "code", None)
    if code in ("23505", "PGRST23505"):
        return True
    text = str(error)
    return "23505" in text or "duplicate key" in text.lower()


def _dedupe_items(items: List[Any]) -> Dict[str, int]:
    """Gabungkan kuantitas per `book_id`.

    Payload boleh menyebut buku yang sama lebih dari sekali; kalau tidak
    digabung, tiap baris lolos cek stok sendiri dan stok bisa tembus.
    """
    totals: Dict[str, int] = {}
    for item in items:
        totals[item.book_id] = totals.get(item.book_id, 0) + item.quantity
    return totals


def _adjust_stock(items: List[Dict[str, Any]], sign: int) -> List[Tuple[str, int]]:
    """Ubah `books.stock` per item; kembalikan perubahan yang berhasil (`book_id`, delta)."""
    applied: List[Tuple[str, int]] = []
    for item in items:
        book_id = item.get("book_id")
        if not book_id:
            continue
        res = supabase_admin.table("books").select("stock").eq("id", book_id).single().execute()
        if not res.data:
            continue
        before = int(res.data.get("stock") or 0)
        after = max(0, before + sign * int(item.get("quantity") or 0))
        supabase_admin.table("books").update({"stock": after}).eq("id", book_id).execute()
        applied.append((book_id, after - before))
    # ponytail: read-modify-write per buku, bukan satu transaksi DB — dua checkout
    # bersamaan masih bisa lolos cek stok yang sama. Ganti dengan RPC
    # `adjust_stock(book_id, delta)` (satu UPDATE ... WHERE stock + delta >= 0)
    # begitu oversell nyata mulai terjadi.
    return applied


def _undo_stock(applied: List[Tuple[str, int]]) -> None:
    """Balikkan perubahan stok yang sudah terjadi (kompensasi saat insert gagal)."""
    for book_id, delta in applied:
        res = supabase_admin.table("books").select("stock").eq("id", book_id).single().execute()
        if not res.data:
            continue
        stock = int(res.data.get("stock") or 0) - delta
        supabase_admin.table("books").update({"stock": stock}).eq("id", book_id).execute()


def _shipping_address_json(payload: OrderCreate) -> Dict[str, Any]:
    """Bentuk `orders.shipping_address` (JSONB) dari payload lama maupun kanonik."""
    addr = payload.address
    data: Dict[str, Any] = {
        "recipient_name": (addr.recipient_name if addr else payload.customer_name) or "",
        "phone": (addr.phone if addr else payload.customer_phone) or "",
        "full_address": (addr.full_address if addr else payload.shipping_address) or "",
    }
    if addr:
        data["city"] = addr.city
        data["province"] = addr.province
        data["postal_code"] = addr.postal_code

    customer = payload.customer
    data["customer"] = {
        "name": (customer.name if customer else payload.customer_name) or data["recipient_name"],
        "email": (customer.email if customer else payload.customer_email) or "",
        "phone": (customer.phone if customer else payload.customer_phone) or data["phone"],
    }
    # Tabel `orders` tidak punya kolom catatan; instruksi pengiriman disimpan
    # bersama alamatnya.
    if payload.notes:
        data["notes"] = payload.notes
    return data


def _decode_shipping_address(raw: Any) -> Tuple[Dict[str, Any], str]:
    """Kembalikan (jsonb, teks alamat) dari nilai JSONB yang mungkin berbentuk apa saja."""
    if isinstance(raw, dict):
        return raw, str(raw.get("full_address") or "")
    if isinstance(raw, str):
        return {}, raw
    return {}, ""


def _serialize_items(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Petakan baris `order_items` (skema live) ke `OrderItemResponse`.

    Skema live hanya menyimpan `book_id`, `title_snapshot`, `quantity`, `price`,
    dan `weight_gram`; `author`/`cover_url` diambil dari tabel `books`.
    """
    if not rows:
        return []

    book_ids = list({row["book_id"] for row in rows if row.get("book_id")})
    books: Dict[str, Dict[str, Any]] = {}
    if book_ids:
        res = supabase_admin.table("books").select("id, author, cover_url").in_("id", book_ids).execute()
        books = {row["id"]: row for row in (res.data or [])}

    items = []
    for row in rows:
        book = books.get(row.get("book_id")) or {}
        unit_price = float(row.get("price") or 0)
        quantity = int(row.get("quantity") or 0)
        items.append({
            "id": row["id"],
            "order_id": row["order_id"],
            "book_id": row.get("book_id"),
            "title": row.get("title_snapshot"),
            "author": book.get("author"),
            "cover_url": book.get("cover_url"),
            "unit_price": unit_price,
            "quantity": quantity,
            "total_price": unit_price * quantity,
        })
    return items


def _serialize_order(row: Dict[str, Any], items: List[Dict[str, Any]] | None = None,
                     payment: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Petakan satu baris `orders` (skema live) ke bentuk respons API."""
    address, address_text = _decode_shipping_address(row.get("shipping_address"))
    customer = address.get("customer") or {}
    shipping_fee = float(row.get("shipping_cost") or 0)
    total_amount = float(row.get("total") or 0)
    subtotal = float(row.get("subtotal") or 0)
    # Skema live tidak menyimpan diskon; selisihnya dilaporkan apa adanya.
    discount_amount = max(0.0, subtotal + shipping_fee - total_amount)

    return {
        "id": row["id"],
        "order_number": row.get("order_number"),
        "user_id": row.get("user_id"),
        "customer_name": address.get("recipient_name") or customer.get("name"),
        "customer_email": customer.get("email"),
        "customer_phone": address.get("phone") or customer.get("phone"),
        "shipping_address": address_text,
        "address": address or None,
        "courier": row.get("courier"),
        "courier_service": row.get("courier_service"),
        "tracking_number": row.get("tracking_number"),
        "status": row.get("status") or "pending",
        "payment_status": (payment or {}).get("status") or "pending",
        "payment_method": (payment or {}).get("method"),
        "subtotal": subtotal,
        "shipping_fee": shipping_fee,
        "discount_amount": discount_amount,
        "total_amount": total_amount,
        "promo_code": None,
        "notes": address.get("notes"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "items": _serialize_items(items if items is not None else row.get("items") or []),
    }


class OrderService:
    @staticmethod
    def expire_overdue_orders() -> List[str]:
        """Batalkan pesanan `pending` yang melewati `expires_at` dan kembalikan stoknya.

        Tanpa ini, stok yang sudah dipotong saat pesanan dibuat tertahan selamanya
        oleh keranjang yang tidak pernah dibayar. Dipanggil dari endpoint job
        (`POST /orders/expire-overdue`), bukan dari jalur baca.
        """
        overdue = (
            supabase_admin.table("orders")
            .select("id")
            .eq("status", "pending")
            .lt("expires_at", datetime.now(timezone.utc).isoformat())
            .execute()
            .data
            or []
        )

        expired: List[str] = []
        for row in overdue:
            items_res = (
                supabase_admin.table("order_items")
                .select("book_id, quantity")
                .eq("order_id", row["id"])
                .execute()
            )
            # Tandai dulu supaya kegagalan pengembalian stok tidak mengulang
            # pemotongan; stok dikembalikan sekali per pesanan.
            supabase_admin.table("orders").update({"status": "expired"}).eq("id", row["id"]).execute()
            _adjust_stock(items_res.data or [], 1)
            expired.append(row["id"])

        return expired

    @staticmethod
    def get_list(
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        query = supabase_admin.table("orders").select(
            "*, items:order_items(*), payments(*)", count="exact"
        )

        if search:
            query = query.or_(f"order_number.ilike.%{search}%")
        if status:
            query = query.eq("status", status)
        if user_id:
            query = query.eq("user_id", user_id)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        rows = res.data or []
        orders = [
            _serialize_order(row, row.get("items") or [], (row.get("payments") or [None])[0])
            for row in rows
        ]
        total = res.count if res.count is not None else len(orders)
        return orders, total

    @staticmethod
    def get_by_id(order_id: str) -> Optional[Dict[str, Any]]:
        res = (
            supabase_admin.table("orders")
            .select("*, items:order_items(*), payments(*)")
            .eq("id", order_id)
            .single()
            .execute()
        )
        row = res.data
        if not row:
            return None
        return _serialize_order(row, row.get("items") or [], (row.get("payments") or [None])[0])

    @staticmethod
    def create(payload: OrderCreate, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Buat pesanan. Harga, judul, dan berat diambil dari `books`, bukan dari client.

        Stok dipotong di sini — satu-satunya jalur yang memotong — dan hanya
        dikembalikan saat pesanan dibatalkan.
        """
        quantities = _dedupe_items(payload.items)
        book_ids = list(quantities)
        books_res = supabase_admin.table("books").select("id, title, price, weight_gram, stock").in_("id", book_ids).execute()
        books = {row["id"]: row for row in (books_res.data or [])}

        missing = [bid for bid in book_ids if bid not in books]
        if missing:
            raise ValueError(f"Buku tidak ditemukan: {', '.join(missing)}")

        items_data = []
        subtotal = 0.0
        for book_id, quantity in quantities.items():
            book = books[book_id]
            stock = int(book.get("stock") or 0)
            if stock < quantity:
                raise ValueError(f"Stok '{book['title']}' tidak mencukupi (sisa {stock}).")
            price = float(book["price"])
            subtotal += price * quantity
            items_data.append({
                "book_id": book_id,
                "title_snapshot": book["title"],
                "quantity": quantity,
                "price": price,
                "weight_gram": int(book.get("weight_gram") or 0),
            })

        shipping_fee = float(payload.shipping_fee)
        discount_amount = float(payload.discount_amount)
        if shipping_fee:
            raise ValueError(
                "Ongkos kirim ditentukan server; kirim `shipping_option_id`, bukan `shipping_fee`."
            )
        if discount_amount or payload.promo_code:
            raise ValueError(
                "Kode promo belum tersedia, jadi diskon tidak dapat diterapkan."
            )

        # Kurir, layanan, dan tarif berasal dari daftar layanan server.
        courier, courier_service, shipping_cost = shipping.resolve(payload.shipping_option_id)
        total_amount = max(0.0, subtotal + shipping_cost)

        order_data = {
            "user_id": user_id,
            "status": "pending",
            "subtotal": subtotal,
            "shipping_cost": shipping_cost,
            "total": total_amount,
            "shipping_address": _shipping_address_json(payload),
            "courier": courier,
            "courier_service": courier_service,
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        }

        # `orders.order_number` punya UNIQUE constraint di database live. Nomor
        # diacak, jadi bentrok mungkin; coba beberapa kali sebelum menyerah.
        new_order = None
        for _ in range(_ORDER_NUMBER_ATTEMPTS):
            order_data["order_number"] = _generate_order_number()
            try:
                new_order = supabase_admin.table("orders").insert(order_data).execute().data[0]
                break
            except Exception as e:
                if not _is_unique_violation(e):
                    raise
        if new_order is None:
            raise ValueError("Gagal membuat nomor pesanan unik. Silakan coba lagi.")

        order_id = new_order["id"]

        applied: List[Tuple[str, int]] = []
        try:
            for row in items_data:
                row["order_id"] = order_id
            supabase_admin.table("order_items").insert(items_data).execute()

            # Pemrosesan pembayaran belum lengkap: baris ini hanya mencatat niat bayar,
            # tidak menandai pembayaran berhasil.
            supabase_admin.table("payments").insert({
                "order_id": order_id,
                "provider": "manual",
                "method": payload.payment_method,
                "amount": total_amount,
                "status": "pending",
            }).execute()

            applied = _adjust_stock(items_data, -1)
        except Exception:
            # Jangan tinggalkan pesanan tanpa item, atau stok terpotong tanpa pesanan.
            _undo_stock(applied)
            supabase_admin.table("order_items").delete().eq("order_id", order_id).execute()
            supabase_admin.table("orders").delete().eq("id", order_id).execute()
            raise

        return OrderService.get_by_id(order_id) or _serialize_order(new_order, items_data)

    @staticmethod
    def _current_payment(order_id: str) -> Optional[Dict[str, Any]]:
        res = (
            supabase_admin.table("payments")
            .select("*")
            .eq("order_id", order_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return (res.data or [None])[0]

    @staticmethod
    def update_status(order_id: str, payload: OrderStatusUpdate) -> Dict[str, Any]:
        # RPC `update_order_status` tidak ada di database live, jadi transisi
        # dilakukan langsung.
        current = OrderService.get_by_id(order_id)
        if not current:
            raise ValueError(f"Pesanan dengan ID {order_id} tidak ditemukan.")

        old_status = current["status"]
        new_status = payload.status

        update_data: Dict[str, Any] = {"status": new_status}
        if payload.tracking_number:
            update_data["tracking_number"] = payload.tracking_number
        supabase_admin.table("orders").update(update_data).eq("id", order_id).execute()

        # Stok dipotong saat pesanan dibuat, jadi dikembalikan saat dibatalkan dari
        # status apa pun yang belum batal. `old_status == "cancelled"` membuat ini
        # idempotent: pembatalan kedua tidak menambah stok lagi.
        if new_status == "cancelled" and old_status != "cancelled":
            items_res = supabase_admin.table("order_items").select("book_id, quantity").eq("order_id", order_id).execute()
            _adjust_stock(items_res.data or [], 1)

        return {
            "order_id": order_id,
            "old_status": old_status,
            "new_status": new_status,
            "sukses": True,
        }

    @staticmethod
    def update_payment_status(order_id: str, status: str) -> Dict[str, Any]:
        """Pisahkan dari `update_status`: perubahan status pesanan tidak boleh
        otomatis menandai pembayaran berhasil."""
        payment = OrderService._current_payment(order_id)
        if not payment:
            raise ValueError(f"Pembayaran untuk pesanan {order_id} tidak ditemukan.")

        data: Dict[str, Any] = {"status": status}
        if status == "success":
            data["paid_at"] = datetime.now(timezone.utc).isoformat()
        supabase_admin.table("payments").update(data).eq("id", payment["id"]).execute()

        return {"order_id": order_id, "payment_id": payment["id"], "payment_status": status, "sukses": True}


order_service = OrderService()
