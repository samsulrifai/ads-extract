-- Migration for orders table
CREATE TABLE IF NOT EXISTS public.orders (
    order_sn TEXT PRIMARY KEY,
    shop_id BIGINT NOT NULL REFERENCES public.shops(shopee_shop_id) ON DELETE CASCADE,
    create_time TIMESTAMPTZ NOT NULL,
    order_status TEXT NOT NULL,
    total_amount DECIMAL(14,2) DEFAULT 0,
    shipping_carrier TEXT,
    payment_method TEXT,
    item_count INT DEFAULT 0,
    product_name TEXT,
    sku TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_shop_id_create_time ON public.orders(shop_id, create_time);

-- RLS Policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow anon to read orders (matching earlier permissive pattern for shops/ads_performance)
-- Or ideally we'd restrict it based on `assigned_shop_ids`, but keeping it simple based on 001 rules:
CREATE POLICY "anon_read_orders" ON public.orders
  FOR SELECT TO anon USING (true);

-- Allow authenticated to read orders
CREATE POLICY "authenticated_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (true);

-- Allow service_role full access
CREATE POLICY "service_role_all_orders" ON public.orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Trigger for updated_at
-- (Assuming `public.update_updated_at_column()` exists from 001)
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
