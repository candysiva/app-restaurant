# SB Billing

A fast, mobile-first billing app for a South Indian tiffin counter and rice flour batter (maavu) retail shop. Built as a PWA (installable from the browser, no app store needed) with an [Aaly](https://aaly.io) backend.

**Live:** https://candysiva.github.io/app-restaurant/

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

The backend project starts with no users. On first launch, use the **First-time setup** tab on the login screen to create the shop's account (this also creates the shop's tenant/shared workspace).

## Adding staff logins

After first-time setup, additional staff get their own login (name + email/phone + password) from **Orders → Staff** in the app — no separate signup needed. Everyone added this way shares the same shop data (menu, orders, dashboard).

## Installing on a phone

Open the deployed URL in Chrome (Android) or Safari (iOS) and use "Add to Home Screen" — it installs like a native app icon and launches full-screen.

## Deployment

`.github/workflows/deploy-pages.yml` builds and deploys to GitHub Pages automatically on every push to `main` or the active feature branch. One-time setup (repo owner only):

1. GitHub repo → **Settings → Pages → Build and deployment → Source** → select **GitHub Actions**.
2. Push (or re-run the workflow from the **Actions** tab) — the site publishes to `https://<owner>.github.io/app-restaurant/`.

The app is built with `base: '/app-restaurant/'` in `vite.config.ts` to match the Pages project-site path. If the repo is ever renamed, update `base` there (and the base path in `public/404.html`) to match.
