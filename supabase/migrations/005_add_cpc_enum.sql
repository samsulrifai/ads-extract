-- Add 'cpc' to ads_type_enum (Shopee API returns this as default type)
ALTER TYPE ads_type_enum ADD VALUE IF NOT EXISTS 'cpc';
