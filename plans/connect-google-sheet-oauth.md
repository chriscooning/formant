# Connect Google Sheet — One-Click OAuth Flow

**Date:** 2026-02-14  
**Status:** Plan only — not yet implemented  
**Context:** Allow admins to connect a Google Sheet for form response collection with a single OAuth click. No manual setup script, no schema editing.

---

## Goal

User clicks "Connect Google Sheet" → authorizes with Google → sheet is created (or selected) with correct headers, Apps Script is deployed, and form submissions flow automatically.

**Key property:** The sheet and Apps Script are created under the **user's Google account** (via OAuth), not the platform's.

---

## Architecture Overview

```
┌─────────────────┐     OAuth      ┌──────────────────┐     Token + Sheet ID     ┌─────────────────┐
│  Admin Panel    │ ──────────────► │  Google          │                         │  Formant API    │
│  (static HTML)  │                 │  (user signs in) │                         │  (backend)      │
└────────┬────────┘                 └──────────────────┘                         └────────┬────────┘
         │                                                                                 │
         │ Store URL in IndexedDB                                                          │ Creates Apps Script
         │                                                                                 │ Deploys as web app
         ▼                                                                                 │ Returns web app URL
┌─────────────────┐                                                                        │
│  Form           │ ◄───────────────────────────────────────────────────────────────────────┘
│  (static HTML)  │   Reads Sheets URL from IndexedDB at submit time, adds to destinations
└─────────────────┘
```

- **Centralized backend:** Formant hosts an API that creates/deploys Apps Script. End users configure nothing.
- **Same-origin:** Form and admin share origin (e.g. Vercel deployment), so they share IndexedDB for the Sheets URL.

---

## Prerequisites

### 1. Google Cloud Console (one-time, platform maintainer)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable APIs:
   - Google Sheets API
   - Google Drive API
   - Apps Script API
3. Create OAuth 2.0 credentials:
   - **Application type:** Web application
   - **Authorized JavaScript origins:** Admin URL(s), e.g. `https://formant-form.vercel.app`, `http://localhost:5500`
   - **Authorized redirect URIs:** Add both:
     - Admin: `https://formant-form.vercel.app/admin.html`, `http://localhost:5500/admin.html`
     - Backend callback: `https://<your-worker-url>/api/connect-sheets/callback`, `http://localhost:8787/api/connect-sheets/callback` (for local dev)
4. Copy **Client ID** and **Client Secret**
5. Set secrets: `wrangler secret put GOOGLE_CLIENT_ID` and `wrangler secret put GOOGLE_CLIENT_SECRET`

### 2. Backend Environment Variables

The Formant API backend needs:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

---

## Implementation Phases

### Phase 1: Backend API — Create & Deploy Apps Script

**Goal:** One endpoint that receives an OAuth token and Sheet ID, creates/deploys Apps Script, returns the web app URL.

**Placement:** Add to `packages/service` (Cloudflare Workers) — new route group, same deployment as existing forms/responses/export API.

**Request:**

```
POST /api/connect-sheets
Content-Type: application/json

{
  "accessToken": "ya29.xxx",   // From OAuth (user's token)
  "spreadsheetId": "1abc..."
}
```

**Backend flow:**

1. Validate request
2. Use `accessToken` to call Apps Script API (on behalf of user):
   - Create new Apps Script project
   - Add script content (from `scripts/apps-script/sheets-connector.gs` — **see note below**)
   - Create deployment (Web app, Execute as: Me, Who has access: Anyone)
3. Return web app URL:

```json
{
  "url": "https://script.google.com/macros/s/AKfycbx.../exec",
  "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1abc.../edit"
}
```

**Apps Script variant:** The existing `sheets-connector.gs` uses `SpreadsheetApp.getActiveSpreadsheet()` — that assumes a **container-bound** script. The Apps Script API creates **standalone** projects. We need a variant that uses `SpreadsheetApp.openById(spreadsheetId)`. Options:

- **A)** Create `sheets-connector-standalone.gs` with `SPREADSHEET_ID` as a constant (injected at deploy time)
- **B)** Modify the backend to inject `spreadsheetId` into the script content before deployment

**Reference:** [Apps Script API](https://developers.google.com/apps-script/api/reference/rest), [Sheets API](https://developers.google.com/sheets/api/reference/rest)

---

### Phase 2: Admin Panel — OAuth Flow

**Goal:** "Connect Google Sheet" button that runs OAuth, creates sheet (or picks existing), calls backend, stores URL.

**Files to modify:**

- `.cursor/skills/formant/templates/admin-local.html`
- `packages/html-builder/src/buildLocal.ts` — add `{{FORMANT_API_URL}}` placeholder

**OAuth flow (auth code + PKCE, backend-owned):**

1. User clicks "Connect Google Sheet"
2. Admin POSTs to backend: `POST /api/connect-sheets/init` with `{ redirect_uri, state, form_id, schema }` — schema needed for sheet headers
3. Backend stores schema temporarily (KV/cookie), returns auth URL
4. Admin redirects user to backend: `GET /api/connect-sheets/oauth?state=...` — backend returns 302 to Google (Client ID never in HTML)
5. User authorizes; Google redirects to backend callback with `code`
6. Backend exchanges code for token, creates sheet via Sheets API (with headers from stored schema), creates Apps Script, deploys
7. Backend redirects to admin `redirect_uri` with `url` and `spreadsheetUrl` in fragment
8. Admin stores in IndexedDB: `formant_sheets_url_{formId}` → `{ url, spreadsheetUrl, connectedAt }`
9. Show success: "Connected. View responses: [Open Sheet]"

**UI:** Add a "Connect Google Sheet" section in the admin (visible when unlocked). Show connection status and "View in Google Sheet" link when connected.

**Config:** Build-time placeholder `{{FORMANT_API_URL}}`. If empty, hide or disable Connect section. Backend owns OAuth — no Client ID in admin.

---

### Phase 3: Form — Dynamic Sheets Destination

**Goal:** At submit time, form checks IndexedDB for a stored Sheets URL and adds it to destinations if present.

**Files to modify:**

- `packages/renderer/src/submit/handler.ts`
- **Create:** `packages/renderer/src/utils/sheetsStorage.ts` — `getStoredSheetsUrl`, `setStoredSheetsUrl` (setter used by admin; getter used by form)

**Logic:**

```ts
// Before submit, merge dynamic destinations
const storedSheets = await getStoredSheetsUrl(schema.id);
const baseDestinations = schema.submit?.destinations ?? [];
const sheetsDest = storedSheets?.url
  ? { type: "sheets" as const, url: storedSheets.url }
  : null;
const destinations = sheetsDest
  ? [...baseDestinations.filter(d => d.type !== "sheets"), sheetsDest]
  : baseDestinations;
// Use merged destinations for submit
```

**IndexedDB key:** `formant_sheets_url_{formId}` — per-form storage so multiple forms can each have their own sheet.

**Precedence:** Stored URL overrides any `sheets` destination in the schema (Connect flow takes precedence).

---

### Phase 4: Create Sheet with Headers

**Goal:** When creating a new sheet, populate the first row with form field titles.

**Location:** Backend (during OAuth callback, using user's token from code exchange)

**Flow:**

1. Create spreadsheet: `POST https://sheets.googleapis.com/v4/spreadsheets` with `{ properties: { title: "Form Responses" } }`
2. Get `spreadsheetId` from response
3. Build header row to match `flattenForSheets` output:
   - Field titles (or IDs) for each input field
   - Metadata: `_formId`, `_submittedAt`, `_duration`, `_completionRate`
4. Update sheet: `PUT https://sheets.googleapis.com/v4/spreadsheets/{id}/values/Sheet1!A1:Z1` with `{ values: [[...headers]] }`

**Reference:** `flattenForSheets` in `packages/renderer/src/submit/sheets.ts` — uses `field.title || field.id`; metadata keys prefixed with `_`.

---

### Phase 5: Optional — Connect to Existing Sheet

**Goal:** Let user pick an existing Google Sheet instead of creating a new one.

**Approach:** Use [Google Picker API](https://developers.google.com/picker) to select a spreadsheet. Extract `id` from the picked file. Then call backend with that `spreadsheetId`.

**Note:** The Apps Script must use `SpreadsheetApp.openById(spreadsheetId)` — same as Phase 1 variant. No extra backend changes.

---

## File Summary

| File | Action |
|------|--------|
| `packages/service/src/routes/connect-sheets.ts` | **Create** — backend route group |
| `scripts/apps-script/sheets-connector-standalone.gs` | **Create** — variant using `openById(spreadsheetId)` |
| `scripts/apps-script/sheets-connector.gs` | **Reuse** — original for manual setup; standalone variant for OAuth flow |
| `.cursor/skills/formant/templates/admin-local.html` | **Modify** — add Connect UI, OAuth, IndexedDB write |
| `packages/html-builder/src/buildLocal.ts` | **Modify** — inject `{{FORMANT_API_URL}}` |
| `packages/renderer/src/submit/handler.ts` | **Modify** — read stored URL, merge into destinations |
| `packages/renderer/src/utils/sheetsStorage.ts` | **Create** — `getStoredSheetsUrl`, `setStoredSheetsUrl` |

---

## Security Considerations

- **OAuth token:** Passed to backend over HTTPS. Backend uses it only for Apps Script API calls, then discards. Prefer short-lived tokens; consider refresh token if needed.
- **Client ID:** Safe to expose in admin (browser). Client Secret must stay server-side only.
- **CORS:** Backend must allow requests from admin origin.
- **IndexedDB:** Per-origin. Only the same site can read the stored URL. No secrets stored — just the web app URL (which is semi-public; anyone with it can POST to the sheet).

---

## Testing Checklist

- [ ] OAuth popup opens, user authorizes, token received
- [ ] New sheet created with correct headers
- [ ] Backend creates Apps Script, returns URL
- [ ] URL stored in IndexedDB
- [ ] Form submit includes sheets destination when URL stored
- [ ] Response appears in the user's Google Sheet
- [ ] "View in Google Sheet" link works
- [ ] Disconnect / reconnect flow (optional, out of scope for initial)

---

## Out of Scope (Future)

- Disconnect flow (clear stored URL)
- Multiple sheets per form
- Sheet picker for existing sheets (Phase 5)
- Self-hosted backend with user-provided Google credentials

---

## Dependencies

- Formant backend (API) must be deployed and configured with Google env vars
- Admin and form must be same-origin (or use a shared storage mechanism)
- Existing `submitToSheets` and `flattenForSheets` in renderer

---

## References

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Apps Script API](https://developers.google.com/apps-script/api/reference/rest)
- [Sheets API](https://developers.google.com/sheets/api/reference/rest)
- [Google Picker API](https://developers.google.com/picker) (for Phase 5)
- Existing: `scripts/apps-script/sheets-connector.gs`, `packages/renderer/src/submit/sheets.ts`

---

## Decisions (resolved)

| Decision | Choice | Notes |
|----------|--------|------|
| **API placement** | Add to `packages/service` | Same Cloudflare Worker as forms/responses/export. One deploy. *(B would mean a second Worker with its own URL and deploy step.)* |
| **OAuth flow** | Auth code + PKCE | Backend exchanges code for token. More secure, no token in URL. |
| **Same-origin (local)** | Document + detect `file://` | Document that Connect requires serving over HTTP. When origin is `file://`, show: "Connect requires serving over HTTP. Run `npx serve .` in this folder." |
| **API URL config** | Build-time `{{FORMANT_API_URL}}` | If empty, hide/disable Connect UI. Matches existing placeholder pattern. |
| **Google Client ID** | Backend owns OAuth start | Admin redirects to `GET /api/connect-sheets/oauth?redirect_uri=...`. Backend builds auth URL; Client ID never in HTML. |
| **IndexedDB key** | `formant_sheets_url_{formId}` | Per-form storage. Multiple forms on same deployment can each have their own sheet. |
| **Disconnect flow** | Out of scope | Future: clear IndexedDB key; no backend change. |
