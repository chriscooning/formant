# Deploy Options — Full Reference

**Quick start:** For the simplest deploy with database: `pnpm formant deploy form.html --target cloudflare`

This document covers all deploy targets. For the recommended path (share with others or preview locally), see the [README](../README.md#deploy).

---

## Decision tree

```
Need to share with others?
├── Yes → Cloudflare (recommended, one command) or Vercel + Postgres (manual DB setup)
└── No (testing) → Offline or preview (see README)

Special needs?
├── Google Sheets (one-click OAuth) → Vercel + Sheets
├── Kiosk / offline device → Local (--local)
└── Shareable URL, Excel only → Vercel (plain)
```

---

## Cloudflare (recommended)

**Best for:** Shareable URL + database with one command. No manual setup.

```bash
pnpm formant deploy forms/my-form.html --target cloudflare
```

- Deploys Worker + D1, uploads form, returns live URL + API key
- Database auto-created; migrations run on deploy
- See [README](../README.md#deploy-options) for details

---

## Vercel + Postgres

**Best for:** Vercel hosting with server-side storage. Requires adding a database in the Vercel dashboard first.

```bash
pnpm formant deploy forms/my-form.html --target vercel --with-backend
```

- Vercel + Postgres requires a one-time setup. See [setup-vercel-postgres.md](setup-vercel-postgres.md) for the 3 steps.

---

## Vercel (plain)

**Best for:** Shareable public URL, Excel download on submit. No server-side storage.

```bash
pnpm formant deploy forms/my-form.html --target vercel
```

- Deploys form as a static site
- Responses download as Excel in the submitter's browser
- Optionally add Google Sheets via [Connect Google Sheet](connect-google-sheet-local.md) (requires Worker + admin)

---

## Vercel + Sheets

**Best for:** Shareable URL with responses flowing to a Google Sheet via one-click OAuth.

```bash
FORMANT_ADMIN_PASSWORD=your-secret pnpm formant deploy forms/my-form.html --target vercel --with-sheets
```

- Deploys Cloudflare Worker first (Connect Google Sheet API)
- Builds form + admin with `FORMANT_API_URL`, deploys both to Vercel
- **Post-deploy:** Add your Vercel URL to Google Cloud OAuth → Authorized JavaScript origins
- Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Cloudflare
- See [docs/connect-google-sheet-local.md](connect-google-sheet-local.md) (Production section)

---

## Local (kiosk)

**Best for:** Offline device (iPad, kiosk), no network. Form + admin, responses in IndexedDB.

```bash
FORMANT_ADMIN_PASSWORD=your-secret pnpm formant build forms/my-form.json --local
```

- Produces `forms/<name>.html` and `forms/<name>-admin.html`
- Copy both to the device (same folder for IndexedDB origin)
- Open form for kiosk, admin for export (CSV/XLSX)
- No hosting required

---

## Full reference table

| Target | Command | Response collection |
|--------|---------|---------------------|
| **Offline** | `--target offline` | Excel download |
| **Cloudflare** | `--target cloudflare` | D1 + dashboard |
| **Vercel** | `--target vercel` | Excel download |
| **Vercel + Sheets** | `--target vercel --with-sheets` | Google Sheet (OAuth) |
| **Vercel + Postgres** | `--target vercel --with-backend` | Postgres + dashboard |
| **Local** | `pnpm formant build ... --local` | IndexedDB |
