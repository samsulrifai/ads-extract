-- Antigravity: Shopee Ads Data Extractor
-- Neon schema (consolidates the old supabase/migrations 001–008).
--
-- Prerequisite: enable Neon Auth + Data API on the branch first.
-- That installs pg_session_jwt, which provides auth.user_id() and auth.session().
-- Run as the database owner:  psql "$DATABASE_URL" -f db/schema.sql

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
CREATE TYPE ads_type_enum AS ENUM ('search', 'discovery', 'video', 'cpc');
CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Connected Shopee shops with OAuth tokens
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopee_shop_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Unnamed Shop',
  access_token TEXT,
  refresh_token TEXT,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily ads performance per shop and ad type
CREATE TABLE public.ads_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL REFERENCES public.shops(shopee_shop_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ads_type ads_type_enum NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  orders INT DEFAULT 0,
  gmv DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, date, ads_type)
);

CREATE INDEX idx_ads_performance_shop_date ON public.ads_performance(shop_id, date);
CREATE INDEX idx_ads_performance_date ON public.ads_performance(date);

-- Orders + escrow (financial) detail
CREATE TABLE public.orders (
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
  updated_at TIMESTAMPTZ DEFAULT now(),
  original_price DECIMAL(14,2) DEFAULT 0,
  seller_voucher DECIMAL(14,2) DEFAULT 0,
  shopee_voucher DECIMAL(14,2) DEFAULT 0,
  shipping_fee DECIMAL(14,2) DEFAULT 0,
  commission_fee DECIMAL(14,2) DEFAULT 0,
  service_fee DECIMAL(14,2) DEFAULT 0,
  transaction_fee DECIMAL(14,2) DEFAULT 0,
  escrow_amount DECIMAL(14,2) DEFAULT 0,
  escrow_synced BOOLEAN DEFAULT false,
  escrow_detail JSONB DEFAULT NULL
);

CREATE INDEX idx_orders_shop_id_create_time ON public.orders(shop_id, create_time);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- App members. user_id is the Neon Auth user id (neon_auth.user.id, JWT `sub`).
-- user_id is NULL for members not yet linked to a Neon Auth account
-- (e.g. migrated from Supabase); claim_membership() links them by email.
CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE, -- stored lowercase
  role user_role NOT NULL DEFAULT 'member',
  assigned_shop_ids BIGINT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Auth helpers (SECURITY DEFINER so RLS policies on members don't recurse)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.user_id());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.members WHERE user_id = auth.user_id() AND role = 'admin');
$$;

-- Called by the app after sign-in. Returns the caller's member profile:
--  * links a pending (user_id IS NULL) member row whose email matches the JWT email
--  * the very first user, when the members table is empty, becomes admin
--    (replaces the old Supabase handle_new_user trigger)
CREATE OR REPLACE FUNCTION public.claim_membership()
RETURNS SETOF public.members
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid TEXT := auth.user_id();
  jwt_email TEXT := lower(auth.session() ->> 'email');
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.members WHERE user_id = uid) THEN
    IF jwt_email IS NOT NULL THEN
      UPDATE public.members SET user_id = uid
      WHERE user_id IS NULL AND lower(email) = jwt_email;
    END IF;

    IF NOT FOUND AND NOT EXISTS (SELECT 1 FROM public.members) THEN
      INSERT INTO public.members (user_id, email, role)
      VALUES (uid, coalesce(jwt_email, ''), 'admin');
    END IF;
  END IF;

  RETURN QUERY SELECT * FROM public.members WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.is_member(), public.is_admin(), public.claim_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member(), public.is_admin(), public.claim_membership() TO authenticated;

-- ---------------------------------------------------------------------------
-- Data API grants + Row Level Security
-- The serverless functions in api/ connect as the owner and bypass RLS.
-- Browser requests go through the Data API as `authenticated`.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT, DELETE ON public.ads_performance TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_all_shops" ON public.shops
  FOR ALL TO authenticated
  USING (public.is_member()) WITH CHECK (public.is_member());

CREATE POLICY "members_read_ads" ON public.ads_performance
  FOR SELECT TO authenticated USING (public.is_member());

CREATE POLICY "members_delete_ads" ON public.ads_performance
  FOR DELETE TO authenticated USING (public.is_member());

CREATE POLICY "members_read_orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_member());

CREATE POLICY "read_own_or_admin_members" ON public.members
  FOR SELECT TO authenticated
  USING (user_id = auth.user_id() OR public.is_admin());

CREATE POLICY "admin_insert_members" ON public.members
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "admin_update_members" ON public.members
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "admin_delete_members" ON public.members
  FOR DELETE TO authenticated USING (public.is_admin());
