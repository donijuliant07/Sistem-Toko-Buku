import random
from datetime import datetime
from typing import Optional, Dict, Any, Tuple, List
from app.core.supabase import supabase_admin
from app.schemas.order import OrderCreate, OrderStatusUpdate


class OrderService:
    @staticmethod
    def get_list(
        page: int = 1,
        limit: int = 10,
        search: Optional[str] = None,
        status: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        offset = (page - 1) * limit
        query = supabase_admin.table("orders").select("*, items:order_items(*)", count="exact")

        if search:
            query = query.or_(f"order_number.ilike.%{search}%,customer_name.ilike.%{search}%,customer_email.ilike.%{search}%")
        if status:
            query = query.eq("status", status)
        if customer_id:
            query = query.eq("customer_id", customer_id)

        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
        res = query.execute()

        total = res.count if res.count is not None else len(res.data or [])
        return res.data or [], total

    @staticmethod
    def get_by_id(order_id: str) -> Optional[Dict[str, Any]]:
        res = (
            supabase_admin.table("orders")
            .select("*, items:order_items(*), history:order_status_history(*)")
            .eq("id", order_id)
            .single()
            .execute()
        )
        return res.data

    @staticmethod
    def create(payload: OrderCreate, customer_id: Optional[str] = None) -> Dict[str, Any]:
        subtotal = sum(item.unit_price * item.quantity for item in payload.items)
        total_amount = subtotal + payload.shipping_fee - payload.discount_amount

        date_str = datetime.now().strftime("%Y%m%d")
        rand_suffix = random.randint(1000, 9999)
        order_number = f"INV/{date_str}/{rand_suffix}"

        order_data = {
            "order_number": order_number,
            "customer_id": customer_id,
            "customer_name": payload.customer_name,
            "customer_email": payload.customer_email,
            "customer_phone": payload.customer_phone,
            "shipping_address": payload.shipping_address,
            "courier": payload.courier,
            "payment_method": payload.payment_method,
            "subtotal": subtotal,
            "shipping_fee": payload.shipping_fee,
            "discount_amount": payload.discount_amount,
            "total_amount": total_amount,
            "promo_code": payload.promo_code,
            "notes": payload.notes,
            "status": "Menunggu Pembayaran",
            "payment_status": "Belum Bayar",
        }

        # Insert Order
        res_order = supabase_admin.table("orders").insert(order_data).execute()
        new_order = res_order.data[0]
        order_id = new_order["id"]

        # Insert Order Items & adjust stock
        items_data = []
        for item in payload.items:
            items_data.append({
                "order_id": order_id,
                "product_id": item.product_id,
                "title": item.title,
                "author": item.author,
                "cover_url": item.cover_url,
                "unit_price": item.unit_price,
                "quantity": item.quantity,
                "total_price": item.unit_price * item.quantity,
            })
            if item.product_id:
                supabase_admin.rpc(
                    "adjust_stock",
                    {
                        "p_product_id": item.product_id,
                        "p_quantity": item.quantity,
                        "p_type": "Penjualan",
                        "p_reason": f"Penjualan Pesanan #{order_number}",
                        "p_reference_id": order_id,
                        "p_user_id": customer_id,
                    },
                ).execute()

        supabase_admin.table("order_items").insert(items_data).execute()

        # Log initial history
        supabase_admin.table("order_status_history").insert({
            "order_id": order_id,
            "status": "Menunggu Pembayaran",
            "notes": "Pesanan berhasil dibuat oleh pelanggan.",
            "created_by": customer_id,
        }).execute()

        return OrderService.get_by_id(order_id) or new_order

    @staticmethod
    def update_status(order_id: str, payload: OrderStatusUpdate, user_id: str) -> Dict[str, Any]:
        if payload.tracking_number:
            supabase_admin.table("orders").update({"tracking_number": payload.tracking_number}).eq("id", order_id).execute()

        res = supabase_admin.rpc(
            "update_order_status",
            {
                "p_order_id": order_id,
                "p_new_status": payload.status,
                "p_notes": payload.notes,
                "p_user_id": user_id,
            },
        ).execute()

        return res.data


order_service = OrderService()
