-- Migration 0002_rls.sql: Row Level Security Policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Helper functions for RLS checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'staff')
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_staff_or_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Categories Policies
CREATE POLICY "Categories viewable by all"
    ON public.categories FOR SELECT
    TO public, anon, authenticated
    USING (true);

CREATE POLICY "Categories managed by staff/admin"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin());

-- Products Policies
CREATE POLICY "Public can view active products"
    ON public.products FOR SELECT
    TO public, anon, authenticated
    USING (status = 'Aktif' OR public.is_staff_or_admin());

CREATE POLICY "Products managed by staff/admin"
    ON public.products FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin());

-- Promos Policies
CREATE POLICY "Public can view active promos"
    ON public.promos FOR SELECT
    TO public, anon, authenticated
    USING (status = 'Aktif' OR public.is_staff_or_admin());

CREATE POLICY "Promos managed by staff/admin"
    ON public.promos FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin());

-- Orders Policies
CREATE POLICY "Customers can view own orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (customer_id = auth.uid() OR public.is_staff_or_admin());

CREATE POLICY "Customers can create orders"
    ON public.orders FOR INSERT
    TO authenticated
    WITH CHECK (customer_id = auth.uid() OR customer_id IS NULL);

CREATE POLICY "Orders managed by staff/admin"
    ON public.orders FOR UPDATE
    TO authenticated
    USING (public.is_staff_or_admin());

-- Order Items Policies
CREATE POLICY "Customers can view own order items"
    ON public.order_items FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = order_items.order_id
            AND (orders.customer_id = auth.uid() OR public.is_staff_or_admin())
        )
    );

CREATE POLICY "Order items insertable on checkout"
    ON public.order_items FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Stock Movements Policies
CREATE POLICY "Stock movements viewable and manageable by staff/admin"
    ON public.stock_movements FOR ALL
    TO authenticated
    USING (public.is_staff_or_admin());
