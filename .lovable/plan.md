# Wire the secondary (accent) brand color into the UI

## What's wrong today

The admin's second color is saved as `accent_color` and already reaches the browser as the live CSS variable `--brand-accent` (injected server-side on first paint and updated live, exactly like the primary color). But no component or stylesheet rule ever reads that variable, so changing it does nothing on screen.

Meanwhile the app's "secondary" surfaces (secondary badges, outline/ghost button hovers, sheet close button) use fixed amber tokens that are unrelated to the admin setting.

## The fix (no new mechanism, no schema change)

Keep the exact same pattern used by primary: derive everything in `src/styles.css` from the injected variable.

1. Derive the shadcn secondary/accent tokens from `--brand-accent`, for both light and dark/night modes:
   - `--secondary`, `--secondary-foreground`
   - `--accent`, `--accent-foreground`
   - plus soft/border helpers (`--brand-accent-soft`, `--brand-accent-border`) built with `color-mix`, mirroring how `--brand-soft` / `--brand-border` derive from `--primary`.
   Foreground colors are computed with `color-mix` against black/white so text stays readable whatever hex the admin picks.
2. Tie the ambient aurora's second blob to the accent so the customer-facing background visibly reflects the brand's secondary color.
3. Leave every `--primary`-derived token untouched — primary buttons, rings and brand-strong text keep behaving identically.

Result: elements that already use the existing `secondary` / `outline` / `ghost` shadcn variants (secondary badges such as "غير متاح", order/payment badges, cart-count badge, admin status chips, outline button hovers) start following the admin's second color automatically — no component rewrites needed.

## Verification

Set the secondary color to a bright orange in Admin → Settings, confirm the secondary badges/hover surfaces and aurora shift immediately (same live behavior as primary), capture a before/after screenshot, then restore the original value.

## Technical notes

- Only `src/styles.css` changes; `accent_color`, `--brand-accent`, `settings.ts` and `__root.tsx` injection stay as-is.
- Uses `color-mix(in oklab, …)`, already used elsewhere in the file, so hex values from the color picker work directly.
