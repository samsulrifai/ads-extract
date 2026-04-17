-- Add escrow/financial columns to orders table
-- Data source: Shopee API /api/v2/payment/get_escrow_detail

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS original_price DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_voucher DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shopee_voucher DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_fee DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_fee DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS transaction_fee DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS escrow_amount DECIMAL(14,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS escrow_synced BOOLEAN DEFAULT false;
