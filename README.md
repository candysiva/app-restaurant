# Dhanalakshmi Tiffen Stall

A fast, mobile-first billing app for a South Indian tiffin counter and rice flour batter (maavu) retail shop. Built as a PWA (installable from the browser, no app store needed) with an [Aaly](https://aaly.io) backend.

**Live:** https://candysiva.github.io/app-restaurant/

## v1 scope

The bottom nav is deliberately kept to five items — **Bill, Orders, Stock, Dashboard, More** — so day-to-day work (billing, checking orders, checking/logging stock, glancing at sales) is one tap away, while things touched rarely (menu setup, categories, staff, vendors, purchases) live under **More** instead of crowding the nav bar.

- **Bill** — tap-to-add for fixed items; for per-kg items, either weigh directly (kg → price) or tap a rupee amount (a preset or a custom one) and the kg is calculated for you — one-tap checkout with payment method.
- **Orders** — today / last 7 days / recent history, line-item detail, cancel a bill.
- **Stock** (owner-only) — the day-to-day stock screen: materials at or below their low-stock threshold surface in a "Needs reorder" section; tap any material to log usage, wastage, or a correction (see below).
- **Dashboard** (owner-only) — sales totals and item-wise ranking over today / week / 1-12 months / a custom number of months; trend chart by calendar date or by weekday (e.g. every Saturday's sales across a quarter). Tap a bar in the trend chart to drill the item-wise list below into just that date (or, in "by weekday" view, every occurrence of that weekday in the period) — tap it again, or hit Clear, to go back to the full period.
- **More** — account info, and (owner-only) menu, categories, staff logins, vendors, purchases, materials & stock, sign out. Vendor payments/dues, employee salaries, and other expenses (rent, electricity, ...) are planned as follow-up features; a Sales-vs-Expenses net profit view on the Dashboard comes once all of those exist.

## Tech

- React + TypeScript + Vite, Tailwind CSS v4, `vite-plugin-pwa`
- [Aaly](https://aaly.io) as the backend (auth + REST CRUD) — see `src/lib/api.ts` for the base URL and `src/lib/data.ts` for the data layer
- Charts via [Recharts](https://recharts.org)

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build
npm run lint     # oxlint
```

## First-time setup (one time only)

The backend project starts with no users. On first launch, use the **First-time setup** tab on the login screen to create the shop's account (this also creates the shop's tenant/shared workspace).

## Staff logins and roles

The first-time-setup account is the **owner**. From **More → Staff logins** (owners only), the owner can add teammates directly — no separate signup needed — edit their name/role/password, or remove their login. Everyone shares the same shop data (menu, orders), but **Stock, Dashboard, and the rest of Shop setup under More are owner-only**: staff logins don't see those nav items or More rows, and are redirected away from Stock/Dashboard/Purchases if they hit the URL directly.

This role check is enforced in the app's UI/routing, not by the backend — every signed-in user's JWT can still reach the same data API. That's an acceptable tradeoff for a single small shop where everyone is trusted staff, but don't treat it as a security boundary against an untrusted user with API access.

## Categories

Menu categories (Tiffin, Batter, ...) are no longer fixed — owners manage them from **More → Categories**: add, rename, reorder, or delete (deleting is blocked while any menu item still uses that category, so items are never silently orphaned). Use the up/down arrows next to each category to reorder — this order controls the category tabs in Billing and the section order in **More → Menu**, so put your most-ordered category first for quicker tapping. New shops start with zero categories; the Categories screen offers a one-tap "add starter categories" shortcut, or add your own from scratch. A menu item needs at least one category to exist before you can add items from More → Menu.

**Migrating from before this feature:** menu items created before categories existed won't have one assigned (they show up under "Uncategorized" in More → Menu and are only reachable via the "All" tab in Billing) — open each one and pick a category to file it properly.

## Per-kg items: billing by amount

Per-kg items (batter/maavu) sell in fixed, per-item ₹/kg prices set in More → Menu. Since customers often ask for a rounded rupee amount rather than an exact weight, each per-kg menu item can also have a handful of **quick amounts** (e.g. ₹20, ₹50, ₹100) set from its edit screen — Billing then shows those as tap buttons plus a custom-amount field, and the kg is calculated automatically from the item's price (rounded to the nearest gram). Precise weight entry ("By weight (kg)") is still available as the other tab in the same sheet for anything that doesn't fit a round amount.

## Vendor purchases &amp; stock

Owners manage **Vendors** and **Materials &amp; stock** (master data — name, unit, low-stock threshold) from **More** (add/edit/deactivate, same pattern as Categories). A material has a unit (kg, litre, piece, ...), a running **current stock** quantity, and a **low-stock threshold**.

Day-to-day stock work happens in the **Stock** nav tab, not More: materials at or below their threshold surface in a "Needs reorder" section, and tapping any material opens a **log a stock change** form (usage, wastage, or a manual correction) — stock isn't tied to sales automatically (that would need a recipe/ingredients mapping for every menu item, a bigger feature not built here), so log what goes out as you use it. More → Materials & stock stays focused on editing a material's name/unit/threshold; it shows current stock read-only and points you to the Stock tab to change it.

**More → Purchases** records a vendor bill with one or more material lines, each with its own quantity and price — prices aren't fixed and can differ purchase to purchase, even for the same material. Saving a purchase automatically increases each material's stock and writes an audit entry (visible per-material history is planned). Purchases start **unpaid**; recording payments against a bill and tracking vendor dues/due-dates is the next feature.

## Order numbers

Bill numbers (`#1`, `#2`, ...) restart at 1 every calendar day and are shared across every login/device — placing a bill from any phone looks up today's highest existing order number from the backend and continues from there, so numbering stays consistent no matter who's ringing up the sale. Two devices checking out in the exact same instant could in theory land on the same number (there's no server-side atomic counter), but for a single-counter shop ringing up bills one at a time this is not a practical concern in normal use.

## Installing on a phone

Open the deployed URL in Chrome (Android) or Safari (iOS) and use "Add to Home Screen" — it installs like a native app icon and launches full-screen.

## Deployment

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages automatically on every push to `main` or the active feature branch. One-time setup (repo owner only):

1. GitHub repo → **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
2. Push (or re-run the workflow from the **Actions** tab) — the site publishes to `https://<owner>.github.io/app-restaurant/`.

The app is built with `base: '/app-restaurant/'` in `vite.config.ts` to match the Pages project-site path. If the repo is ever renamed, update `base` there (and the base path in `public/404.html`) to match.
