-- Add JSONB column to store full escrow detail from Shopee API
-- This replaces individual columns approach with a flexible JSONB structure

-- Add raw escrow data column (stores full order_income from Shopee API)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS escrow_detail JSONB DEFAULT NULL;

-- Keep existing columns for backward compatibility, they still work for basic queries
-- original_price, seller_voucher, shopee_voucher, shipping_fee,
-- commission_fee, service_fee, transaction_fee, escrow_amount, escrow_synced
-- were added in 007_escrow_columns.sql
