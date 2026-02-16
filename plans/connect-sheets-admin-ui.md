# Connect Google Sheet — Admin UI Improvements

**Date:** 2026-02-15  
**Context:** Improve Connect Google Sheet UX in admin/dashboard for both Vercel and Cloudflare. Always show the option; when not configured, show "How to set up" with link to docs. No credential pasting in the admin (recommended approach).

---

## Goal

1. **Always show** "Connect to Google Sheet" in admin and dashboard
2. **When not configured:** Show "How to set up" with link to step-by-step documentation
3. **When configured:** Show Connect button (or Connected state)
4. **No credential pasting** — users set secrets via platform CLI (wrangler/vercel)
5. **Apply to both** Vercel (admin-local, responses-dashboard) and Cloudflare (responses-dashboard)

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | Backend: Add `GET /api/connect-sheets/status` endpoint |
| **2** | admin-local.html: Show "How to set up" when not configured |
| **3** | responses-dashboard.html: Add Connect section (Vercel + Postgres, Cloudflare) |
| **4** | docs/connect-google-sheet-local.md: Add Cloudflare + Vercel Postgres production sections |
| **5** | Deploy scripts: Deploy dashboard for Connect to work (optional / Phase 2) |

---

## Phase 1 — Backend: Status Endpoint

### Goal

Add a lightweight endpoint so the admin/dashboard can check if Connect Google Sheet is configured without triggering OAuth.

### Implementation

**File:** `packages/service/src/routes/connect-sheets.ts`

Add:

```ts
// GET /api/connect-sheets/status
connectSheetsApp.get("/api/connect-sheets/status", (c) => {
  const configured = !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET);
  return c.json({ configured });
});
```

- Returns `200 { configured: true }` when both env vars are set
- Returns `200 { configured: false }` when not (do not use 503 — we want a clean check)

**Files to modify:**
- `packages/service/src/routes/connect-sheets.ts`
- `packages/service-vercel` uses the same `@formant/service` app — no change needed; it already passes `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from env

### Verification

```bash
# Without secrets: returns { configured: false }
# With secrets in .dev.vars: returns { configured: true }
curl http://localhost:8787/api/connect-sheets/status
```

---

## Phase 2 — admin-local.html: "How to set up" when not configured

### Goal

When `FORMANT_API_URL` is set but the backend returns `configured: false`, show "How to set up" with link to docs instead of hiding the section or showing a generic error.

### Current behavior

- If `!FORMANT_API_URL`: hide section
- If `file://`: show error "Run npx serve ."
- Otherwise: show Connect button or Connected state
- On init POST 503: `showError("Connect failed: ...")` — user sees error, no guidance

### New behavior

1. **No API URL:** Hide section (unchanged)
2. **file://:** Show "Connect requires serving over HTTP. Run `npx serve .` in this folder." (unchanged)
3. **On load:** Fetch `GET {FORMANT_API_URL}/api/connect-sheets/status`
4. **If `configured: false`:** Show:
   - "Connect to Google Sheet"
   - "How to set up: Configure OAuth credentials in Google Cloud, then set secrets via your deployment platform."
   - Link: `docs/connect-google-sheet-local.md` (or a relative path the build can resolve — e.g. `https://github.com/.../blob/main/docs/connect-google-sheet-local.md` or a placeholder the build replaces)
   - **No Connect button** until configured
5. **If `configured: true`:** Show Connect button or Connected state (unchanged)
6. **On fetch error:** Fall back to showing "How to set up" (assume not configured)

### Implementation notes

- The docs link: admin-local is built with `buildLocal.ts`. We could add a placeholder `{{CONNECT_SHEETS_DOCS_URL}}` or hardcode a path. For local dev, a relative path like `../docs/connect-google-sheet-local.md` won't work if admin is served from a different origin. Best: use a constant like `https://github.com/chriscooning/formant/blob/main/docs/connect-google-sheet-local.md` or make it a build-time placeholder.
- For simplicity, use a build-time placeholder `{{CONNECT_SHEETS_DOCS_URL}}` defaulting to the repo docs path. The html-builder can pass it when building admin.

**File:** `.cursor/skills/formant/templates/admin-local.html`

**File:** `packages/html-builder/src/buildLocal.ts` — add optional `connectSheetsDocsUrl` param, default to repo URL or relative path.

### Verification

1. Build admin with API URL but backend has no secrets → see "How to set up" + link
2. Build admin with API URL, backend has secrets → see Connect button
3. Connect succeeds → see Connected + View in Google Sheet

---

## Phase 3 — responses-dashboard.html: Add Connect section

### Goal

Add Connect Google Sheet section to the dashboard used by Cloudflare and Vercel + Postgres. Same logic: status check, "How to set up" when not configured, Connect button when configured.

### Current state

- `responses-dashboard.html` has no Connect section
- Uses `WORKER_URL` (API base URL)
- Dashboard is a local file — user opens it, pastes API key, loads responses

### Implementation

1. Add a Connect section in the HTML (similar structure to admin-local)
2. On load (after auth or in parallel): fetch `GET {WORKER_URL}/api/connect-sheets/status`
3. **If `configured: false`:** Show "Connect to Google Sheet" + "How to set up" + docs link
4. **If `configured: true`:** Show Connect button; on click, same flow as admin-local (POST init, redirect to Google, callback)
5. **Connected state:** Store in IndexedDB (same key `formant_sheets_config` / `formant_sheets_url_{formId}`). Reuse logic from admin-local.

### OAuth redirect constraint

Google OAuth requires an HTTPS redirect URI. The dashboard is typically opened as `file://` or `http://localhost:...`. For Connect to work when the dashboard is served locally, `http://localhost:PORT/dashboard.html` is valid. For production, the dashboard must be deployed so it has an HTTPS URL.

**Options:**
- **A)** Add Connect section; when opened from `file://`, show "Connect requires the dashboard to be served over HTTPS. Deploy the dashboard or run `npx serve forms` and open from localhost."
- **B)** Deploy the dashboard as part of Cloudflare/Vercel deploy (Phase 5)

For Phase 3, implement **A** — show the section, but when `location.protocol === "file:"` and user clicks Connect, show the same message. When served over HTTP/HTTPS, the flow works.

### Docs link

Use same approach as admin-local. The template has `{{WORKER_URL}}`, `{{FORM_ID}}`, etc. Add `{{CONNECT_SHEETS_DOCS_URL}}` or hardcode. The dashboard is generated by deploy scripts — we can pass the docs URL when generating.

**File:** `.cursor/skills/formant/templates/responses-dashboard.html`

**Files that generate the dashboard:**
- `scripts/deploy-vercel.sh` (for --with-backend)
- `scripts/deploy-cloudflare.sh`

Add placeholder replacement for docs URL when generating.

### Verification

1. Open dashboard from file:// → Connect section shows "How to set up" or "Connect requires HTTPS" when file
2. Serve dashboard, backend not configured → "How to set up" + link
3. Serve dashboard, backend configured → Connect button works
4. Connect succeeds → Connected + View in Google Sheet

---

## Phase 4 — Documentation: Cloudflare + Vercel Postgres production setup

### Goal

Extend `docs/connect-google-sheet-local.md` with production setup for:
- **Cloudflare** (full deploy — Worker + D1)
- **Vercel + Postgres** (service-vercel)

### Current docs

- Local setup (Steps 1–7)
- Production: Vercel + Sheets only (uses Cloudflare Worker for API)

### Add sections

**Cloudflare (full deploy):**

1. Deploy with `pnpm formant deploy forms/<name>.html --target cloudflare`
2. Set secrets: `cd packages/service && pnpm exec wrangler secret put GOOGLE_CLIENT_ID` (and GOOGLE_CLIENT_SECRET)
3. Add to Google Cloud OAuth client:
   - Authorized JavaScript origins: Dashboard URL (if deployed) or `http://localhost:5500` for local dashboard
   - Authorized redirect URIs: `https://<your-worker>.workers.dev/api/connect-sheets/callback`
4. Open dashboard, paste API key, click Connect Google Sheet

**Vercel + Postgres:**

1. Deploy with `pnpm formant deploy forms/<name>.html --target vercel --with-backend`
2. Set env vars in Vercel project: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
3. Add to Google Cloud OAuth client:
   - Authorized JavaScript origins: Dashboard URL (if deployed) or `http://localhost:5500`
   - Authorized redirect URIs: `https://<your-api>.vercel.app/api/connect-sheets/callback`
4. Open dashboard, paste API key, click Connect Google Sheet

**Note:** For Connect to work, the dashboard must be served over HTTPS (or localhost). If using the local dashboard file, run `npx serve forms` and open from `http://localhost:5500/<name>-dashboard.html`. Add the dashboard URL to Authorized JavaScript origins.

**File:** `docs/connect-google-sheet-local.md`

---

## Phase 5 — Deploy dashboard for Connect (optional / future)

### Goal

For Cloudflare and Vercel + Postgres, deploy the dashboard alongside the form so users get a hosted dashboard URL. Connect then works without running `npx serve` locally.

### Scope

- **Cloudflare:** Serve dashboard from Worker (e.g. `/dashboard.html` or `/d/{formId}`) — requires adding a static route or uploading dashboard HTML to KV/R2
- **Vercel + Postgres:** Include dashboard in the static deploy; dashboard at `https://xxx.vercel.app/dashboard.html` or similar

This phase is optional for the initial implementation. Users can run `npx serve forms` and add `http://localhost:5500` to Google Cloud for local testing. Production use would benefit from deployed dashboard.

---

## Verification Checklist

```bash
# 1. Status endpoint works
curl http://localhost:8787/api/connect-sheets/status
# Expect: {"configured":true} or {"configured":false}

# 2. admin-local: not configured shows "How to set up"
# Build admin, serve, open, unlock — see "How to set up" when backend has no secrets

# 3. admin-local: configured shows Connect button
# Set .dev.vars, restart API, refresh admin — see Connect button

# 4. responses-dashboard: same behavior
# Generate dashboard, serve forms folder, open dashboard — same logic

# 5. No credential inputs anywhere
# Grep admin templates for "client" or "secret" — none for user input
```

---

## Files Changed Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `packages/service/src/routes/connect-sheets.ts` | Add GET /api/connect-sheets/status |
| 2 | `.cursor/skills/formant/templates/admin-local.html` | Status check, "How to set up" UI |
| 2 | `packages/html-builder/src/buildLocal.ts` | Add docs URL placeholder (optional) |
| 3 | `.cursor/skills/formant/templates/responses-dashboard.html` | Add Connect section |
| 3 | `scripts/deploy-vercel.sh` | Pass docs URL when generating dashboard (optional) |
| 3 | `scripts/deploy-cloudflare.sh` | Pass docs URL when generating dashboard (optional) |
| 4 | `docs/connect-google-sheet-local.md` | Add Cloudflare + Vercel Postgres sections |

---

## Out of Scope

- Credential pasting in admin (explicitly excluded)
- Automated Google Cloud setup
- Phase 5 (deploy dashboard) — can be a follow-up
