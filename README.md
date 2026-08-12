# Orderly Plate

Lovable Build Prompt — Phase 1 (Production MVP)

White-Label Restaurant Ordering & Account Management System

ROLE & MINDSET

You are a senior full-stack product engineer building a production-ready, white-label restaurant ordering and account-management web application. This is NOT a prototype or demo — do not use mock/dummy data, do not stub out business logic "for later." Build the Supabase schema, Auth, Row Level Security (RLS), and Storage policies FIRST, then build the UI on top of them. Every screen must be wired to real data from day one.

1. PRODUCT VISION

A modern white-label web app for a restaurant operating inside a company/organization. Two ordering journeys:

Employees order on a running account and settle later (partial/full payments, account closing).

Visitors order without an account and pay immediately (cash/manual settlement).

The Admin controls menu, customers, orders, payments, expenses, reports and monthly closing. The product must be architected so that restaurant name, logo, colors and menu can be swapped for a new customer without touching core code (true white-label separation of branding from logic).

Languages: Bilingual — Arabic (RTL) and English (LTR), with a language switcher. Arabic is the primary/default language; the entire UI (including Admin dashboard) must mirror correctly in RTL (layout direction, icons, table alignment, forms, navigation).

Currency: Configurable in restaurant settings (do not hardcode a currency symbol — store it in restaurant_settings and format all monetary displays from it).

2. USER ROLES & PERMISSIONS

Role Access Admin / Restaurant Owner Full access: menu, employees, visitor orders, customer accounts, payments, expenses, reports, filters, exports, settings Employee / Account Customer Authenticated only; browse menu, order on account, view ONLY their own orders/balance/payment history/account status Visitor No account; accesses menu via QR/public link, orders, pays immediately (manual/cash — see Section 5). Cannot access employee accounts

Non-negotiable security rule: No user may ever view another customer's account, orders, or payment data. This must be enforced at the database level via Supabase RLS, never only in the UI. Every customer-owned table needs RLS policies scoped to auth.uid().

3. CORE USER FLOWS

3.1 Employee Account Registration

Employee selects "Order on Account."

Enters email + password → submits account request.

UI shows: "Your account request is pending admin approval."

Admin sees pending requests queue, reviews email/name, assigns an internal display name (e.g., "Mr. Mohamed Ali — 4th Floor").

Admin approves or rejects. Only approved users can order on account.

After approval, employee signs in and sees only their own account/data.

3.2 Visitor Ordering

Visitor scans QR code or opens the public ordering link (no login).

Views menu → selects products → cart → confirms order.

Payment = manual/cash on delivery/pickup. The order is created with payment_status = unpaid. Admin marks it paid once cash is collected (single action from the orders list/detail).

No account or balance is created for the visitor.

3.3 Account Closing

Admin opens a customer's account → sees full ledger: all orders, dates, items, quantities, historical prices at time of order, payments, outstanding balance.

Admin can record a partial or full payment (amount, method, date, note).

Admin can click "Close Account" → marks the current account period as settled.

Closing NEVER deletes or mutates historical transactions — it is purely a period-control/reporting action. Store who closed it, when, amount settled, and the covered period in account_closings.

4. MENU MANAGEMENT

Create/rename/reorder categories (e.g., Hot Drinks, Desserts) with active/inactive status.

Create a product and either pick an existing category or create a new one inline during product creation.

Product fields: name, image, description, price, category, availability status (Active / Out-of-Stock-Hidden), display order.

Edit price, image, name, category at any time.

No hard delete of products/categories referenced by historical orders — deactivate/archive instead. Enforce this at the DB level (e.g., prevent delete via RLS/trigger, or soft-delete flag only).

Critical rule: every order_item stores a snapshot of product_name and unit_price at order time. Changing a menu price later must NEVER alter historical order totals.

5. ORDERS

Order types: ACCOUNT (employee) and CASH (visitor, manual/pay-on-delivery).

Order states: Pending → Confirmed → Preparing → Ready → Completed, plus Cancelled.

Order detail: customer/visitor reference, items, quantities, unit prices, subtotal, total, payment status (unpaid/paid), order type, timestamps, notes.

Admin can filter by date range, customer, order type, and status.

Employee sees only their own order history.

For visitor/CASH orders: Admin has a one-click "Mark as Paid" action that logs who marked it and when (for audit).

6. ADMIN DASHBOARD

KPI cards: today's sales, account sales, cash/immediate sales, outstanding balances, expenses, estimated net profit — all driven by the active date filter.

Recent orders + pending account requests widgets.

Customer/account summary: current balance, last payment.

Date presets: Today, Last 7 Days, Last 10 Days, Last 30 Days, This Month, Last Month, Last 6 Months, Last 7 Months, Custom Range.

Global search wherever practical: customer, email, order, date, status, expense type.

7. CUSTOMER ACCOUNTS

Admin list view: internal display name, email, approval status, balance, last order, last payment, account status.

Customer detail: full order ledger, item-level detail, historical prices, payments, balance, closing history.

Payment entry: full or partial settlement.

Account closing record: who closed it, when, amount, covered period.

Employee-facing account page: scoped to that employee only (enforced by RLS).

8. EXPENSES & MONTHLY CLOSING

Admin manually adds expenses: date, category/type, description, amount, optional note.

Example categories: food purchases, supplies, utilities, other.

Same date filtering + export as other lists.

Monthly closing view: revenue, account collections, cash sales, expenses, outstanding balances, estimated net profit — for the selected period.

Closing is reporting/period-control only — never deletes/mutates transactions.

9. REPORTS & EXCEL EXPORT

Export filtered Orders, Customers/Accounts, Payments, Expenses, and Monthly Reports to Excel/CSV.

Export must respect the currently active filters.

Clear column headers, dates, totals, and IDs suitable for accounting review.

Note: Google Sheets / n8n synchronization is explicitly OUT OF SCOPE for this phase. Do not build any external sync, webhook, or Google API integration now. Design the schema so this can be added later without migration pain (e.g., don't rely on client-only writes for financial events).

10. UI/UX REQUIREMENTS

Modern, premium restaurant-SaaS aesthetic: clean, minimal, professional, fast — not generic/templated.

Mobile-first customer ordering flow: large touch targets, short checkout (menu → cart → confirm, minimal steps).

Admin dashboard optimized for desktop/tablet, fully responsive down to mobile.

Full bilingual support: Arabic (RTL) as default + English (LTR) toggle. All layouts, icons, tables, and forms must correctly mirror in RTL — this is not just text translation, it's a genuine RTL layout implementation.

Visual hierarchy: KPIs → filters → data → actions.

Tables for operational data; cards for summaries.

Prominent primary actions: Add Product, Add Category, Record Payment, Close Account, Add Expense, Export, Mark as Paid.

Confirmation dialogs on destructive/financial actions; clear success/error toasts.

Empty states, loading states, validation messages, error recovery on every screen.

White-label settings page: restaurant name, logo, favicon, brand colors, currency, contact info.

11. TECHNICAL ARCHITECTURE

Frontend: React (Lovable-generated), production-quality, fully responsive, bilingual RTL/LTR.

Backend: Supabase — Auth + PostgreSQL + Storage + RLS.

Images: Supabase Storage with secure, scoped access policies.

Auth: email/password; employee accounts require Admin approval before they can order.

Authorization: enforced at DB level via RLS AND at application level via route/role guards (defense in depth — never rely on UI checks alone).

Separation of concerns: clean split between UI, business logic, and data access layers so future integrations (payment gateway, Google Sheets/n8n) can be added without refactoring core flows.

12. DATA MODEL (build these tables first, with RLS, before any UI)

profiles — user identity, email, internal display name, role (admin/employee), approval status, department/floor metadata.

categories — name, sort order, active status.

products — category_id, name, description, image_url, current price, active/availability status, sort order.

orders — customer/visitor reference (nullable for visitors), order type (ACCOUNT/CASH), status, payment_status, totals, timestamps.

order_items — order_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total.

payments — customer/order reference, amount, method, date, notes.

expenses — date, category, description, amount, notes.

account_closings — customer_id, period_start, period_end, amount_settled, closed_by (admin), closed_at, status.

audit_logs — actor_id, action, entity, entity_id, previous_value, new_value, timestamp. Log: price changes, employee approvals, payments, account closings, menu changes, "mark as paid" actions.

restaurant_settings — name, logo_url, favicon_url, brand colors, currency, contact info.

13. SECURITY & RELIABILITY

RLS on every customer-owned table — no exceptions.

All admin-only mutations enforced server-side (RLS policies / Postgres functions with security definer where appropriate), never trusted from client role flags alone.

Validate all financial inputs server-side: reject negative amounts, non-numeric input, overpayment beyond logical bounds where relevant.

Immutable history: completed orders, payments, and closings must not be editable/deletable through the app UI.

Audit log entries for all sensitive admin actions (see Section 12).

Handle duplicate submissions (e.g., idempotent order creation on double-tap "Confirm Order") and network failures gracefully with retry/error states.

14. MVP ACCEPTANCE CRITERIA

[ ] Visitor: scan QR → browse menu → create order → order recorded as unpaid CASH order, no registration required.

[ ] Admin can mark a visitor order as paid with one action, logged in audit_logs.

[ ] Employee: request account → pending state shown → admin approves → employee signs in → orders on account.

[ ] Employee sees ONLY their own orders/payments/balance (verified via RLS, not just UI hiding).

[ ] Admin manages categories/products; changing a price does NOT alter any historical order's stored totals (snapshot verified).

[ ] Admin records partial/full payments and can close an account while all historical orders/payments remain intact and visible.

[ ] Admin adds/filters expenses; dashboard shows revenue, expenses, and estimated net profit for the selected date range.

[ ] Orders/Customers/Payments/Expenses lists support date/customer/status filters AND filtered Excel/CSV export.

[ ] Full UI is usable end-to-end in both Arabic (RTL) and English (LTR).

[ ] App is responsive and visually polished on mobile (customer flow) and desktop/tablet (admin).

[ ] White-label settings page exists and actually drives branding (name/logo/colors/currency) shown throughout the app — not hardcoded.

15. EXPLICITLY OUT OF SCOPE FOR THIS BUILD (Phase 1)

Do not build these now — they are Phase 2+:

Google Sheets / n8n synchronization or any external integration layer.

Online payment gateway (Stripe/Paymob/Tap/etc.) — visitor payment is manual/cash only in this phase.

Kitchen Display System.

Inventory/stock/supplier management.

Coupons, loyalty, promotions.

Multi-branch / multi-restaurant SaaS management.

Advanced accounting, tax, or payroll modules.

Design the schema and architecture so these can be added later without breaking changes — but do not implement them now.

16. BUILD ORDER (execute in this sequence)

Supabase schema (Section 12) + RLS policies for every table.

Auth setup (email/password) + approval-gated employee role logic.

Storage buckets + policies for product images and logo/favicon.

Admin: menu management (categories/products) — fully functional against real data.

Visitor ordering flow (QR/public link → menu → cart → order, unpaid CASH).

Employee ordering flow (account request → approval → order on account).

Admin: orders list/detail, filters, mark-as-paid, status transitions.

Admin: customer accounts, payments, account closing.

Admin: expenses + monthly closing view.

Admin dashboard (KPIs, date presets, global search).

Reports & Excel/CSV export (filter-aware).

White-label settings page + apply branding globally.

Bilingual AR(RTL)/EN(LTR) pass across every screen.

Full responsive + empty/loading/error state pass.

Build feature-complete and wired to real Supabase data at every step — no placeholder screens.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://krunshy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1ba71549-6919-485c-b802-dad045d9ebc3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
