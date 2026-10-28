#!/usr/bin/env bash
# Copy data from the old Supabase database into Neon.
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres' \
#   DATABASE_URL='postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require' \
#   ./db/migrate-from-supabase.sh
#
# Run db/schema.sql on Neon first. Members are copied without user_id: Supabase
# accounts can't be moved to Neon Auth (different password hashing), so each
# member signs up / is created again in Neon Auth with the same email and is
# linked automatically by claim_membership() on first login.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Supabase direct connection string)}"
: "${DATABASE_URL:?Set DATABASE_URL (Neon owner connection string)}"

copy_table() {
  local table="$1" columns="$2"
  echo "→ $table"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
    -c "\\copy (SELECT $columns FROM public.$table) TO STDOUT WITH (FORMAT csv)" |
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
      -c "\\copy public.$table ($columns) FROM STDIN WITH (FORMAT csv)"
}

copy_table shops \
  "id, shopee_shop_id, name, access_token, refresh_token, expired_at, created_at, updated_at"

copy_table ads_performance \
  "id, shop_id, date, ads_type, impressions, clicks, spend, orders, gmv, created_at"

copy_table orders \
  "order_sn, shop_id, create_time, order_status, total_amount, shipping_carrier, payment_method, item_count, product_name, sku, created_at, updated_at, original_price, seller_voucher, shopee_voucher, shipping_fee, commission_fee, service_fee, transaction_fee, escrow_amount, escrow_synced, escrow_detail"

echo "→ members"
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q \
  -c "\\copy (SELECT id, lower(email), role, assigned_shop_ids, created_at, updated_at FROM public.members) TO STDOUT WITH (FORMAT csv)" |
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
    -c "\\copy public.members (id, email, role, assigned_shop_ids, created_at, updated_at) FROM STDIN WITH (FORMAT csv)"

echo
echo "Row counts (Supabase → Neon):"
for t in shops ads_performance orders members; do
  src=$(psql "$SUPABASE_DB_URL" -tAc "SELECT count(*) FROM public.$t")
  dst=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM public.$t")
  printf '  %-16s %6s → %6s\n' "$t" "$src" "$dst"
done
