-- Migration 0003_functions.sql: Stored Procedures & Business Views

-- 1. Atomic Stock Adjustment Function
CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_product_id UUID,
    p_quantity INT,
    p_type stock_movement_type,
    p_reason TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_old_stock INT;
    v_new_stock INT;
    v_product_title TEXT;
BEGIN
    SELECT stock, title INTO v_old_stock, v_product_title
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produk dengan ID % tidak ditemukan.', p_product_id;
    END IF;

    IF p_type IN ('Restok', 'Retur') THEN
        v_new_stock := v_old_stock + ABS(p_quantity);
    ELSIF p_type = 'Penjualan' THEN
        v_new_stock := v_old_stock - ABS(p_quantity);
    ELSIF p_type = 'Penyesuaian' THEN
        v_new_stock := p_quantity;
    END IF;

    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Stok produk % tidak mencukupi (sisa %).', v_product_title, v_old_stock;
    END IF;

    UPDATE public.products
    SET stock = v_new_stock,
        status = CASE WHEN v_new_stock = 0 THEN 'Habis'::product_status ELSE status END,
        updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO public.stock_movements (
        product_id, type, quantity, stock_before, stock_after, reason, reference_id, created_by
    ) VALUES (
        p_product_id, p_type, p_quantity, v_old_stock, v_new_stock, p_reason, p_reference_id, p_user_id
    );

    RETURN jsonb_build_object(
        'product_id', p_product_id,
        'title', v_product_title,
        'stock_before', v_old_stock,
        'stock_after', v_new_stock,
        'sukses', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Order Status Update with Stock Rollback on Cancellation
CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status order_status,
    p_notes TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_old_status order_status;
    v_item RECORD;
BEGIN
    SELECT status INTO v_old_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesanan dengan ID % tidak ditemukan.', p_order_id;
    END IF;

    IF v_old_status = p_new_status THEN
        RETURN jsonb_build_object('sukses', true, 'pesan', 'Status pesanan tidak berubah.');
    END IF;

    -- Update Order status
    UPDATE public.orders
    SET status = p_new_status,
        payment_status = CASE
            WHEN p_new_status = 'Selesai' THEN 'Sudah Bayar'::payment_status
            WHEN p_new_status = 'Dibatalkan' THEN 'Gagal'::payment_status
            ELSE payment_status
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Log history
    INSERT INTO public.order_status_history (order_id, status, notes, created_by)
    VALUES (p_order_id, p_new_status, p_notes, p_user_id);

    -- Stock rollback if cancelled
    IF p_new_status = 'Dibatalkan' AND v_old_status != 'Dibatalkan' THEN
        FOR v_item IN SELECT product_id, quantity FROM public.order_items WHERE order_id = p_order_id LOOP
            IF v_item.product_id IS NOT NULL THEN
                PERFORM public.adjust_stock(
                    v_item.product_id,
                    v_item.quantity,
                    'Retur'::stock_movement_type,
                    'Pembatalan pesanan #' || p_order_id,
                    p_order_id::text,
                    p_user_id
                );
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'order_id', p_order_id,
        'old_status', v_old_status,
        'new_status', p_new_status,
        'sukses', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Dashboard KPI Summary RPC
CREATE OR REPLACE FUNCTION public.dashboard_summary()
RETURNS JSONB AS $$
DECLARE
    v_total_omset DECIMAL(12,2);
    v_total_orders INT;
    v_total_books_sold INT;
    v_active_customers INT;
    v_low_stock_count INT;
BEGIN
    SELECT COALESCE(SUM(total_amount), 0), COUNT(id)
    INTO v_total_omset, v_total_orders
    FROM public.orders
    WHERE status != 'Dibatalkan';

    SELECT COALESCE(SUM(quantity), 0)
    INTO v_total_books_sold
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status != 'Dibatalkan';

    SELECT COUNT(id) INTO v_active_customers FROM public.profiles WHERE role = 'customer';
    SELECT COUNT(id) INTO v_low_stock_count FROM public.products WHERE stock <= 5;

    RETURN jsonb_build_object(
        'total_omset', v_total_omset,
        'total_orders', v_total_orders,
        'total_books_sold', v_total_books_sold,
        'active_customers', v_active_customers,
        'low_stock_count', v_low_stock_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Sales Timeseries RPC
CREATE OR REPLACE FUNCTION public.sales_timeseries(p_days INT DEFAULT 30)
RETURNS TABLE (
    date_label TEXT,
    buku_amount DECIMAL(12,2),
    non_buku_amount DECIMAL(12,2),
    total_amount DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            CURRENT_DATE - (p_days || ' days')::INTERVAL,
            CURRENT_DATE,
            '1 day'::INTERVAL
        )::DATE AS d
    )
    SELECT
        TO_CHAR(ds.d, 'DD Mon') AS date_label,
        COALESCE(SUM(CASE WHEN p.type = 'Buku' THEN oi.total_price ELSE 0 END), 0) AS buku_amount,
        COALESCE(SUM(CASE WHEN p.type = 'Non-Buku' THEN oi.total_price ELSE 0 END), 0) AS non_buku_amount,
        COALESCE(SUM(oi.total_price), 0) AS total_amount
    FROM date_series ds
    LEFT JOIN public.orders o ON o.created_at::DATE = ds.d AND o.status != 'Dibatalkan'
    LEFT JOIN public.order_items oi ON oi.order_id = o.id
    LEFT JOIN public.products p ON p.id = oi.product_id
    GROUP BY ds.d
    ORDER BY ds.d ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Business View: Low Stock Alert
CREATE OR REPLACE VIEW public.low_stock_products AS
SELECT id, title, author, isbn, stock, status, cover_url
FROM public.products
WHERE stock <= 5
ORDER BY stock ASC;
