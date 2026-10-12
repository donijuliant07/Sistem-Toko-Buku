"""Keranjang belanja pelanggan (`carts`/`cart_items`).

Keranjang hanya menyimpan `book_id` dan `quantity`. Harga dan stok **selalu**
dibaca ulang dari tabel `books` setiap kali keranjang diminta, sehingga angka
yang tersimpan tidak pernah basi, dan pesanan tetap divalidasi ulang oleh
`OrderService.create` saat checkout.
"""

import uuid
from typing import Any, Dict, List, Optional

from app.core.supabase import supabase_admin
from app.schemas.cart import CartMergeItem

# Kolom `books` yang dipakai untuk mengisi harga/stok keranjang.
_BOOK_FIELDS = "id, title, author, price, stock, cover_url"

# Batas atas per buku, selaras `OrderItemBase.quantity` di schemas/order.py.
_MAX_QUANTITY = 99


def _is_uuid(value: Any) -> bool:
    """Apakah `value` UUID yang valid (bentuk apa pun yang diterima PostgreSQL).

    `cart_items.book_id` adalah kolom UUID, jadi id non-UUID tidak mungkin
    dipesan; menyaring di sini menghindari satu round-trip ke database.
    """
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True


class CartItemNotFound(ValueError):
    """Item tidak ada, atau bukan milik keranjang user ini.

    Dipisahkan dari `ValueError` biasa supaya endpoint bisa membedakan
    "tidak ditemukan" (404) dari "jumlah/stok tidak valid" (400).
    """



class CartService:
    """Keranjang tersimpan di `carts`/`cart_items` (skema live, tanpa perubahan).

    Harga dan stok tidak pernah disimpan maupun dipercaya dari client: setiap
    pembacaan keranjang men-join `books`, dan `OrderService.create` tetap
    memvalidasi ulang saat pesanan dibuat.
    """

    @staticmethod
    def _get_or_create_cart(user_id: str) -> Dict[str, Any]:
        res = (
            supabase_admin.table("carts")
            .select("id, user_id")
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        if rows:
            return rows[0]
        # UNIQUE(user_id) menjamin tidak ada dua keranjang per user.
        return supabase_admin.table("carts").insert({"user_id": user_id}).execute().data[0]

    @staticmethod
    def _item_rows(cart_id: str) -> List[Dict[str, Any]]:
        res = (
            supabase_admin.table("cart_items")
            .select("id, book_id, quantity")
            .eq("cart_id", cart_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    @staticmethod
    def _fetch_books(book_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        if not book_ids:
            return {}
        res = supabase_admin.table("books").select(_BOOK_FIELDS).in_("id", book_ids).execute()
        return {row["id"]: row for row in (res.data or [])}

    @staticmethod
    def _serialize(cart_id: str, rows: List[Dict[str, Any]],
                   books: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        items: List[Dict[str, Any]] = []
        total_items = 0
        total_price = 0.0

        for row in rows:
            book = books.get(row.get("book_id"))
            quantity = int(row.get("quantity") or 0)
            total_items += quantity

            if not book:
                # Buku dihapus setelah masuk keranjang: barisnya tetap ditampilkan
                # supaya user bisa menghapusnya, tapi ditandai tidak tersedia.
                items.append({
                    "id": row["id"],
                    "book_id": row.get("book_id"),
                    "title": "Buku tidak tersedia",
                    "author": None,
                    "cover_url": None,
                    "unit_price": 0.0,
                    "stock": 0,
                    "quantity": quantity,
                    "subtotal": 0.0,
                    "available": False,
                })
                continue

            price = float(book.get("price") or 0)
            stock = int(book.get("stock") or 0)
            subtotal = price * quantity
            items.append({
                "id": row["id"],
                "book_id": row["book_id"],
                "title": book.get("title") or "",
                "author": book.get("author"),
                "cover_url": book.get("cover_url"),
                "unit_price": price,
                "stock": stock,
                "quantity": quantity,
                "subtotal": subtotal,
                "available": stock >= quantity,
            })
            total_price += subtotal

        return {
            "cart_id": cart_id,
            "items": items,
            "total_items": total_items,
            "total_price": total_price,
        }

    @staticmethod
    def get(user_id: str) -> Dict[str, Any]:
        cart = CartService._get_or_create_cart(user_id)
        rows = CartService._item_rows(cart["id"])
        books = CartService._fetch_books([r["book_id"] for r in rows if r.get("book_id")])
        return CartService._serialize(cart["id"], rows, books)

    @staticmethod
    def _require_book(book_id: str) -> Dict[str, Any]:
        res = supabase_admin.table("books").select(_BOOK_FIELDS).eq("id", book_id).execute()
        rows = res.data or []
        if not rows:
            raise ValueError(f"Buku dengan ID {book_id} tidak ditemukan.")
        return rows[0]

    @staticmethod
    def _require_quantity(book: Dict[str, Any], quantity: int) -> None:
        stock = int(book.get("stock") or 0)
        if quantity > stock:
            raise ValueError(f"Stok '{book.get('title')}' tidak mencukupi (sisa {stock}).")
        if quantity > _MAX_QUANTITY:
            raise ValueError(f"Jumlah maksimal {_MAX_QUANTITY} eksemplar per buku.")

    @staticmethod
    def add_item(user_id: str, book_id: str, quantity: int) -> Dict[str, Any]:
        """Tambahkan `quantity` ke baris yang ada (bukan menimpanya).

        Menjumlahkan dulu lalu memvalidasi terhadap `books.stock` mencegah
        keranjang menyimpan jumlah yang sudah pasti ditolak saat checkout.
        """
        if not _is_uuid(book_id):
            raise ValueError("Buku tidak valid untuk dimasukkan ke keranjang.")

        book = CartService._require_book(book_id)
        cart = CartService._get_or_create_cart(user_id)
        existing = next(
            (r for r in CartService._item_rows(cart["id"]) if r.get("book_id") == book_id),
            None,
        )
        total = int(existing["quantity"]) + quantity if existing else quantity
        CartService._require_quantity(book, total)

        supabase_admin.table("cart_items").upsert(
            {"cart_id": cart["id"], "book_id": book_id, "quantity": total},
            on_conflict="cart_id,book_id",
        ).execute()
        return CartService.get(user_id)

    @staticmethod
    def _item_by_id(item_id: str) -> Optional[Dict[str, Any]]:
        res = (
            supabase_admin.table("cart_items")
            .select("id, cart_id, book_id, quantity")
            .eq("id", item_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    @staticmethod
    def _owned_item(user_id: str, item_id: str) -> Dict[str, Any]:
        """Ambil item dan pastikan ia milik keranjang user ini.

        Kepemilikan diperiksa eksplisit, bukan diserahkan ke filter query, supaya
        item milik user lain tidak pernah bisa diubah walau filter berubah.
        Baris milik user lain sengaja tidak dibedakan dari baris yang tidak ada,
        agar keberadaan keranjang orang lain tidak bocor lewat kode status.
        """
        cart = CartService._get_or_create_cart(user_id)
        item = CartService._item_by_id(item_id)
        if not item or item.get("cart_id") != cart["id"]:
            raise CartItemNotFound(f"Item keranjang {item_id} tidak ditemukan.")
        return item

    @staticmethod
    def update_item(user_id: str, item_id: str, quantity: int) -> Dict[str, Any]:
        item = CartService._owned_item(user_id, item_id)
        CartService._require_quantity(CartService._require_book(item["book_id"]), quantity)

        supabase_admin.table("cart_items").update({"quantity": quantity}).eq("id", item_id).execute()
        return CartService.get(user_id)

    @staticmethod
    def remove_item(user_id: str, item_id: str) -> Dict[str, Any]:
        CartService._owned_item(user_id, item_id)
        supabase_admin.table("cart_items").delete().eq("id", item_id).execute()
        return CartService.get(user_id)

    @staticmethod
    def clear(user_id: str) -> Dict[str, Any]:
        cart = CartService._get_or_create_cart(user_id)
        supabase_admin.table("cart_items").delete().eq("cart_id", cart["id"]).execute()
        return CartService.get(user_id)

    @staticmethod
    def merge(user_id: str, items: List[CartMergeItem]) -> Dict[str, Any]:
        """Gabungkan keranjang tamu (localStorage) setelah login.

        Baris yang tidak valid dilewati, bukan menggagalkan permintaan: merge
        berjalan sebagai efek samping login dan tidak boleh memblokir user.
        """
        for item in items:
            if not _is_uuid(item.book_id):
                continue
            try:
                CartService.add_item(user_id, item.book_id, item.quantity)
            except ValueError:
                # Stok kurang / buku hilang: sisa keranjang tetap di-merge.
                continue
        return CartService.get(user_id)


cart_service = CartService()
