-- Antigravity: Shopee Ads Data Extractor
-- Initial database schema

-- Enum for ad types
CREATE TYPE ads_type_enum AS ENUM ('search', 'discovery', 'video');

-- Shops table: stores connected Shopee shops with OAuth tokens
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopee_shop_id BIGINT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Unnamed Shop',
  access_token TEXT,
  refresh_token TEXT,
  expired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ads performance table with composite unique key to prevent duplicates
CREATE TABLE ads_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id BIGINT NOT NULL REFERENCES shops(shopee_shop_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ads_type ads_type_enum NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  spend DECIMAL(12,2) DEFAULT 0,
  orders INT DEFAULT 0,
  gmv DECIMAL(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shop_id, date, ads_type)
);

-- Index for faster date-range queries
CREATE INDEX idx_ads_performance_shop_date ON ads_performance(shop_id, date);
CREATE INDEX idx_ads_performance_date ON ads_performance(date);

-- RLS Policies (internal tool - simplified)
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_performance ENABLE ROW LEVEL SECURITY;

-- Allow anon to read shops
CREATE POLICY "anon_read_shops" ON shops
  FOR SELECT TO anon USING (true);

-- Allow anon to read ads data
CREATE POLICY "anon_read_ads" ON ads_performance
  FOR SELECT TO anon USING (true);

-- Allow service_role full access (Edge Functions use service_role)
CREATE POLICY "service_role_all_shops" ON shops
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_ads" ON ads_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_shops_updated_at
  BEFORE UPDATE ON shops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
