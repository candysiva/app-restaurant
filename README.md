# SB Billing

A fast, mobile-first billing app for a South Indian tiffin counter and rice flour batter (maavu) retail shop. Built as a PWA (installable from the browser, no app store needed) with an [Aaly](https://aaly.io) backend.

## v1 scope

- **Menu** — fixed-price items (idly, dosa, parotta, ...) and per-kg items (batter/maavu), grouped by category.
- **Billing** — tap-to-add for fixed items, quick weight entry for per-kg items, one-tap checkout with payment method.
- **Orders** — today / last 7 days / recent history, line-item detail, cancel a bill.
- **Dashboard** — daily / weekly / monthly sales totals, bill count, average bill, item-wise sales ranking.

Vendor management, procurement, raw materials, and spend-vs-profit are intentionally out of scope for v1 (planned for a later version).

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

The backend project starts with no users. On first launch, use the **First-time setup** tab on the login screen to create the shop's account (this also creates the shop's tenant). After that, everyone at the counter signs in with that same email/phone + password — the backend does not support self-service signup for additional accounts on a single-tenant project.

## Installing on a phone

Open the deployed URL in Chrome (Android) or Safari (iOS) and use "Add to Home Screen" — it installs like a native app icon and launches full-screen.
