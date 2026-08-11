# Krunshy — White-Label Restaurant Ordering & Accounts (Phase 1)

Staged delivery. Each stage is fully wired to real Lovable Cloud data — no mock data, no placeholder screens.

## Stage 1 — Foundation, menu, and ordering

**Backend first**
- Enable Lovable Cloud (Postgres + Auth + Storage).
- Tables: `profiles`, `user_roles` (separate roles table), `categories`, `products`, `orders`, `order_items`, `payments`, `expenses`, `account_closings`, `audit_logs`, `restaurant_settings`.
- Row-level security on every table, scoped by `auth.uid()` for customer-owned rows and by an `admin` role check function for admin operations. Employees can never read another employee's orders, payments, or balance — enforced in the database, not the UI.
- Email/password auth with instant sign-in (no email confirmation). New employees land in `pending` status and cannot order until an admin approves them.
- Your email is seeded as the admin account in the first migration. **I still need that email address** — tell me and I'll bake it in.
- Storage buckets for product images and brand logo/favicon, with public read for menu images and admin-only writes.

**Frontend**
- Bilingual shell: Arabic RTL default with English LTR toggle, real direction mirroring (layout, nav, tables, forms), language persisted per user.
- Krunshy brand theme as design tokens, driven from `restaurant_settings` (name, logo, colors, currency) so nothing is hardcoded.
- Admin menu management: categories (create, rename, reorder, activate) and products (name, image upload, description, price, category, availability, sort order), with inline category creation. Archive instead of delete — anything referenced by history can't be removed.
- Visitor flow (public link/QR): menu → cart → confirm. Creates a `CASH` order with `payment_status = unpaid`, no account. Double-tap-safe order submission.
- Employee flow: account request → pending screen → after approval, order on account (`ACCOUNT` orders).

## Stage 2 — Operations and money

- Admin orders list and detail: filters by date range, customer, type, status; status transitions Pending → Confirmed → Preparing → Ready → Completed, plus Cancelled; one-click "Mark as Paid" for cash orders, written to the audit log.
- Pending account requests queue: approve/reject, assign an internal display name (e.g. "Mr. Mohamed Ali — 4th Floor").
- Customer accounts: list with balance, last order, last payment, status; detail view with full ledger of orders, line items, snapshot prices, payments, and closing history.
- Payments: record full or partial settlement (amount, method, date, note), validated server-side against negative or nonsensical amounts.
- Account closing: records who closed it, when, amount settled, and covered period. Never deletes or mutates history.
- Expenses: add, categorize, filter by date.
- Employee-facing account page scoped to only that employee.

## Stage 3 — Dashboard, reports, polish

- Admin dashboard KPIs driven by the active date filter: today's sales, account sales, cash sales, outstanding balances, expenses, estimated net profit. Recent orders and pending requests widgets.
- Date presets: Today, Last 7/10/30 Days, This Month, Last Month, Last 6 Months, Last 7 Months, Custom Range. Global search across customers, orders, expenses.
- Monthly closing view: revenue, collections, cash sales, expenses, outstanding, net profit for the period.
- Filter-aware CSV/Excel export for Orders, Customers, Payments, Expenses, and Monthly Reports with accounting-ready headers.
- White-label settings page that actually drives branding app-wide.
- Full pass on responsiveness, empty/loading/error states, validation, confirmation dialogs on financial actions, and toasts.

## Technical notes

- Price integrity: `order_items` stores `product_name_snapshot` and `unit_price_snapshot`; menu price edits never change historical totals.
- Financial writes (orders, payments, closings, mark-as-paid, approvals) go through server functions with server-side validation and audit logging, so a later Sheets/n8n or payment-gateway layer can hook in without touching client code.
- Admin authority comes from the `user_roles` table via a security-definer `has_role()` function — never a client flag.
- Completed orders, payments, and closings are immutable through the UI.
- Out of scope this phase, as specified: external sync, payment gateways, KDS, inventory, loyalty, multi-branch, advanced accounting.

## Assumptions

- Single restaurant instance per deployment (white-label by configuration, not multi-tenant).
- Visitor orders identified by a name/phone entered at checkout, no account created.
- Currency and locale formatting read from settings; default currency EGP unless you say otherwise.
