# Deploy Options — Full Reference

This document covers all deploy targets. For the recommended path (share with others or preview locally), see the [README](../README.md#deploy-options).

---

## Decision tree

```
Need to share with others?
├── Yes → Vercel + Postgres or Cloudflare (see README)
└── No (testing) → Offline or preview (see README)

Special needs?
├── Google Sheets (one-click OAuth) → Vercel + Sheets
├── Kiosk / offline device → Local (--local)
├── Form + admin, IndexedDB → Vercel + admin
└── Shareable URL, Excel only → Vercel (plain)
```

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

## Vercel + admin

**Best for:** Form + admin panel on Vercel, responses in IndexedDB. Single-device shared kiosk with a URL.

```bash
FORMANT_ADMIN_PASSWORD=your-secret pnpm formant deploy forms/my-form.html --target vercel --with-admin
```

- Builds form + admin with `--local`, deploys both to Vercel
- Form at `/`, admin at `/admin.html`
- Responses stored in IndexedDB (per-origin, per-browser)
- **Note:** IndexedDB is shared only when form and admin are on the same origin. For multi-user scenarios, use Vercel + Postgres or Cloudflare instead.

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
| **Vercel** | `--target vercel` | Excel download |
| **Vercel + admin** | `--target vercel --with-admin` | IndexedDB |
| **Vercel + Sheets** | `--target vercel --with-sheets` | Google Sheet (OAuth) |
| **Vercel + Postgres** | `--target vercel --with-backend` | Postgres + dashboard |
| **Cloudflare** | `--target cloudflare` | D1 + dashboard |
| **Local** | `pnpm formant build ... --local` | IndexedDB |
