# Antigravity — Shopee Ads Data Extractor

React + Vite dashboard for Shopee ads, orders and earnings. Serverless API on Vercel (`api/`), database and auth on **Neon** (Postgres + Neon Auth + Data API).

## Setup

1. **Neon project**: in the Neon Console enable **Neon Auth** and the **Data API** on the branch.
2. **Schema**: `psql "$DATABASE_URL" -f db/schema.sql`
3. **Env**: copy `.env.example` → `.env` (and set the same vars in Vercel, plus the `SHOPEE_*` vars).
4. `npm install && npm run dev`

## Auth & members

- Login uses Neon Auth (email + password). Browser queries go through the Data API with RLS: only users that have a row in `members` can see data.
- After login the app calls `claim_membership()`, which links a pending `members` row by email, or makes the very first user admin when `members` is empty.
- Admins create members from the **Members** page (sets a temporary password). The admin must also have the Neon Auth **admin** role (Console → Auth → Users → *Make admin*).
- Recommended: disable public sign-up in Neon Auth settings, since accounts are created by admins.

## Migrating from Supabase

```bash
SUPABASE_DB_URL='postgresql://postgres:...@db.xxx.supabase.co:5432/postgres' \
DATABASE_URL='postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require' \
./db/migrate-from-supabase.sh
```

Copies `shops`, `ads_performance`, `orders` and `members`. Supabase passwords can't be moved, so each member needs a new Neon Auth account with the same email (sign up, or created in the Neon Console); it is linked to the migrated row on first login.
