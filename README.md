# Crunchy — Restaurant Ordering & Accounts System

Production white-label restaurant ordering and account-management web app. Two ordering journeys:
- **Employees** order on a running account, settled periodically via admin-managed closings.
- **Visitors** order without an account and pay cash on pickup/delivery, tracked via a token link — no login required.

Bilingual: Arabic (RTL, default) + English (LTR). The restaurant owner/admin primarily uses Arabic.

## Stack

- **Frontend**: React + TanStack Router + TanStack Start (SSR), built via [Lovable](https://lovable.dev).
- **Backend**: Supabase — Postgres, Auth, Row Level Security, Storage, Realtime, `pg_cron`.
- **Reporting mirror**: Google Sheets, synced automatically via a Google Cloud service account (server-side only, no third-party workflow tool).

## Core business rules (current — see `supabase/migrations/` as the ultimate source of truth)

- **Order lifecycle**: `pending → confirmed → completed`, or `cancelled` (allowed from any of the first three, with a confirmation warning once already `confirmed`/`completed`).
- **Revenue & balance recognition**: only `completed` orders count toward sales or a customer's account balance. `pending` and `confirmed` have zero financial effect. This has been a deliberate, revisited design decision — check `public.customer_balance()` and the dashboard stats query in `src/routes/admin.index.tsx` for the authoritative current rule before assuming.
- **Balance sign convention**: a customer's balance is **negative** when they owe money (e.g. owes 200, pays 100 → balance shows `-100.00`).
- **Account closings**: `account_closings` carries a customer's `outstanding_after` forward as the opening balance of the next period. `customer_balance()` and `customer_accounts_summary()` are kept logically identical — never duplicate this math elsewhere (a client-side duplicate was a real bug once).
- **Orders are immutable once created.** Menu price changes never alter historical order totals (price/name are snapshotted per line item). The correction pattern for a wrong order is cancel + recreate, not in-place editing.
- All customer-owned data is protected by Postgres Row Level Security — never rely on UI-only restrictions.

## Google Sheets sync

Server-side only (`src/lib/sheets/`), authenticated via a Google Cloud service account JSON key stored as a Supabase secret — never in the frontend or in any committed file. Six Arabic-labeled tabs (visitor/cash orders, account orders, customer accounts & payments, expenses, daily closing, admin action log). Idempotent by design (`sheet_sync_state` table with a unique constraint) to survive concurrent writes without duplicating rows.

## Images

Product and brand images live in **public** Storage buckets (`menu-images`, `brand-assets`) — not sensitive content, so plain public URLs are used (no signed-URL round trip). Uploads are automatically resized/compressed client-side (max 800px edge, WebP) before storage.

## Local development

Standard Lovable/Supabase project — see the Lovable project dashboard for environment/secret configuration. Do not commit `.env` or any credentials; secrets belong in the platform's secret manager only.

## Security notes

- Admin-only mutations (order status changes, payment marking, account closing, password resets, payment voiding) run through `SECURITY DEFINER` Postgres functions or server functions with an explicit admin-role check — never trust a client-side role flag alone.
- CSV/Excel exports escape formula-leading characters to prevent spreadsheet formula injection.
- See `supabase/migrations/` for the full, current RLS policy set.
