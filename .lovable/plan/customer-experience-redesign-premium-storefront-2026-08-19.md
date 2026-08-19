# Customer Experience Redesign — Premium Storefront

Goal: turn the public ordering pages into a polished restaurant storefront, add a real hero image system, and remove the brand-color flash on first paint. No changes to ordering, accounts, payments, RLS, sync, or admin workflows.

## 1. Brand color flash (first paint)

Today colors are injected after hydration by `useApplyBranding`, so the default orange paints first.

- Add a root route loader that reads `restaurant_settings` (name, colors, logo, hero, favicon) on the server and returns it as route context.
- Inject the resolved `--primary` / `--brand-accent` (plus derived brand tokens) as an inline `<style>` in the server-rendered HTML, before any CSS paint.
- Seed the settings query cache with the loader data so the client never refetches-then-flashes; `useApplyBranding` stays only as the live-update path after an admin changes colors.
- No cache is required for a first-time visitor: the values arrive with the HTML.

## 2. Brand token cleanup (white-label + night mode)

- Introduce derived semantic tokens in `src/styles.css`: brand primary, accent, foreground, subtle surface, selected state, focus ring — all computed from `--primary` / `--brand-accent`.
- Night mode derives from the same variables instead of the fixed `krunshy-*` palette, so the configured colors hold in both modes.
- Replace hard-coded `krunshy-red` / `krunshy-amber` usages in customer UI (cart bar, category chips, hero, product card) with the brand tokens. Structural neutrals (dark surface, cream) stay as design tokens.

## 3. Hero image system

- Migration: add `hero_image_url TEXT NULL` to `restaurant_settings` (nullable, no data change).
- Update generated types, `RestaurantSettings`, and settings read/write paths.
- Admin Settings gets a "Brand Identity" section with three clearly-labelled slots — Logo (header), Menu Hero Image (homepage), Favicon (browser icon) — each with upload/preview/replace/remove, reusing the existing brand-assets bucket, compression and signed-URL helpers.

## 4. Header redesign

- Logo visually centered on desktop and mobile, correct aspect ratio, no name duplication when a logo exists.
- Utilities balanced around the brand: search, language, day/night, account / previous guest orders, cart, admin (admins only).
- Mobile: left utility group, centered logo, right utility group, RTL-safe logical positioning, no logo displacement at 375px.

## 5. Homepage

- Remove the current hero block (name + "Order from the menu" + big search input) and the dashed "pick a category" box.
- New hero: full-width image from `hero_image_url` with a restrained overlay, restaurant name, and one CTA ("استكشف المنيو" / "Explore the Menu") that smooth-scrolls to the menu section.
- Fallback when no hero image: a designed branded panel (brand color treatment + typography), not a placeholder.
- Categories: single horizontal scrolling rail on mobile (no wrapping into multiple rows), refined rail on desktop; selected state uses brand tokens.
- Products: existing data and add-to-cart untouched; presentation refined — 2 columns mobile, 3 medium, 4 large, stronger image, clean price and add action, subtle hover.

## 6. Search

- Search logic (`src/lib/search.ts`) unchanged.
- Moves into the header as an icon that expands into a compact field; layout-stable on desktop, full-width sheet-style field on mobile, no horizontal overflow.

## 7. Cart bar

- Keeps the sticky/floating behavior and route.
- Shows count · total · action label ("عرض السلة" / "View Cart"), respects mobile safe-area bottom inset, RTL-correct, brand-token colored.

## 8. QA before finishing

Verified at 1440 / 1024 / 768 / 390 / 375 px, Arabic RTL and English LTR, day and night: no orange flash on hard reload, no horizontal overflow, logo centered, hero and fallback both correct, search open/close, category rail scroll, guest and account checkout flows end-to-end, hero upload in admin, branding persists after refresh.

## Technical notes

- Files: `src/routes/__root.tsx` (loader + inline branding style), `src/lib/settings.ts`, `src/styles.css`, `src/components/site-header.tsx`, `src/routes/index.tsx`, `src/components/menu/product-card.tsx`, `src/components/menu/cart-bar.tsx`, `src/routes/admin.settings.tsx`, plus one migration and the generated types.
- The settings read used by the loader is a public read of the existing settings row; no new policies or storage buckets.
- Accessibility: 44px targets, visible focus rings on brand tokens, labelled controls, alt text on logo/hero, reduced-motion respected.
