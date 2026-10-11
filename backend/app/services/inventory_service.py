from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin
from app.schemas.inventory import StockAdjustmentRequest


class InventoryService:
    @staticmethod
    def get_movements(
        page: int = 1,
        limit: int = 10,
        product_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        # Tabel `stock_movements` tidak ada di database live; jejak pergerakan
        # diturunkan dari `order_items` buku (setiap item memotong stok saat
        # pesanan dibuat, lihat `OrderService.create`).
        offset = (page - 1) * limit
        query = supabase_admin.table("order_items").select(
            "id, book_id, title_snapshot, quantity, price, order_id, created_at:orders(created_at), books(title)",
            count="exact",
        )

        if product_id:
            query = query.eq("book_id", product_id)

        query = query.order("id", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        rows = res.data or []
        movements = [
            {
                "id": row["id"],
                "product_id": row.get("book_id"),
                "product_title": (row.get("books") or {}).get("title") or row.get("title_snapshot"),
                "type": "Penjualan",
                "quantity": row.get("quantity"),
                "stock_before": None,
                "stock_after": None,
                "reason": f"Penjualan pesanan {row.get('order_id')}",
                "reference_id": row.get("order_id"),
                "created_by": None,
                "created_at": (row.get("orders") or {}).get("created_at"),
            }
            for row in rows
        ]

        total = res.count if res.count is not None else len(movements)
        return movements, total

    @staticmethod
    def adjust_stock(payload: StockAdjustmentRequest) -> Dict[str, Any]:
        """Sesuaikan stok langsung di tabel `books` (RPC `adjust_stock` tidak ada
        di database live). Penyesuaian manual lewat jalur ini; pemotongan karena
        penjualan dilakukan `OrderService.create`, dan pengembaliannya dilakukan
        `OrderService.update_status` saat pesanan dibatalkan."""
        res = supabase_admin.table("books").select("stock, title").eq("id", payload.product_id).single().execute()
        book = res.data
        if not book:
            raise ValueError(f"Produk dengan ID {payload.product_id} tidak ditemukan.")

        stock_before = int(book.get("stock") or 0)

        if payload.type in ("Restok", "Retur"):
            stock_after = stock_before + abs(payload.quantity)
        elif payload.type == "Penjualan":
            stock_after = stock_before - abs(payload.quantity)
        else:  # Penyesuaian: nilai quantity adalah stok baru
            stock_after = payload.quantity

        if stock_after < 0:
            raise ValueError(f"Stok produk {book.get('title')} tidak mencukupi (sisa {stock_before}).")

        supabase_admin.table("books").update({"stock": stock_after}).eq("id", payload.product_id).execute()

        return {
            "product_id": payload.product_id,
            "title": book.get("title"),
            "stock_before": stock_before,
            "stock_after": stock_after,
            "sukses": True,
        }

    @staticmethod
    def get_low_stock_products() -> List[Dict[str, Any]]:
        # View `low_stock_products` tidak ada di database live.
        res = supabase_admin.table("books").select("id, title, author, stock, cover_url").lte("stock", 5).execute()
        return res.data or []


inventory_service = InventoryService()
