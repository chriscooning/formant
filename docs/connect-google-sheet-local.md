# Connect Google Sheet — Local Setup Guide

This guide walks you through testing the **Connect Google Sheet** feature locally. Users can click a button in the admin panel, authorize with Google, and form responses will flow automatically to a new Google Sheet.

## Overview

| Port | Service | Purpose |
|------|---------|---------|
| **5500** | Static file server (`npx serve`) | Serves the form and admin HTML |
| **8787** | Formant API (`pnpm dev`) | Backend API, OAuth callback, sheet creation |

The admin panel and form must be served over HTTP (not `file://`) so OAuth redirects and IndexedDB work correctly.

---

## Prerequisites

- Node.js and pnpm
- A Google account
- The Formant monorepo cloned and dependencies installed (`pnpm install`)

---

## Step 1: Google Cloud Console Setup

### 1.1 Create or select a project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project or select an existing one

### 1.2 Enable required APIs

1. Go to **APIs & Services** → **Enabled APIs & services**
2. Click **+ ENABLE APIS AND SERVICES**
3. Enable:
   - **Google Sheets API**
   - **Google Drive API**
   - **Apps Script API**

### 1.3 Configure OAuth consent screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (for personal Gmail) or **Internal** (Google Workspace only)
3. Fill in required fields:
   - **App name:** Formant (or your choice)
   - **User support email:** your email
   - **Developer contact:** your email
4. If **Publishing status** is **Testing**:
   - Scroll to **Test users**
   - Click **+ ADD USERS**
   - Add the exact email you'll use to sign in (e.g. `you@gmail.com`)
   - **Important:** Use the same email you see at [myaccount.google.com](https://myaccount.google.com). Some accounts (e.g. child accounts) may not be eligible as test users.
5. Click **Save**

### 1.4 Create OAuth credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. **Application type:** Web application
4. **Name:** Formant Connect (or your choice)
5. **Authorized JavaScript origins:** Add `http://localhost:5500`
6. **Authorized redirect URIs:** Add `http://localhost:8787/api/connect-sheets/callback`
   - Use port **8788** if that's where your Wrangler dev server runs (check the terminal output)
7. Click **Create**
8. Copy the **Client ID** and **Client secret** — you'll need these in the next step

---

## Step 2: Configure local credentials

1. Copy the example file:
   ```bash
   cp packages/service/.dev.vars.example packages/service/.dev.vars
   ```

2. Edit `packages/service/.dev.vars` and replace the placeholders with your real credentials:
   ```
   GOOGLE_CLIENT_ID=123456789012-xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
   ```

   - No quotes, no spaces around `=`
   - Use the exact values from Google Cloud Console
   - **Do not commit `.dev.vars`** — it's in `.gitignore`

---

## Step 3: Apply database schema

The Connect Google Sheet flow uses an `oauth_sessions` table. Apply the schema to your local D1 database:

```bash
cd packages/service && pnpm db:migrate:local
```

Run this once per local database, or after resetting `.wrangler/state`.

---

## Step 4: Start the Formant API

In a terminal:

```bash
cd packages/service && pnpm dev
```

You should see:
```
Ready on http://localhost:8787
```

Note the port (8787 or 8788). You'll need it for the build step.

**Restart the server** after any changes to `.dev.vars` — Wrangler only reads it at startup.

---

## Step 5: Build form and admin

Build with the API URL and admin password:

```bash
FORMANT_API_URL=http://localhost:8787 FORMANT_ADMIN_PASSWORD=test123 pnpm formant build forms/simple-form.json --local
```

- Use **8788** if that's your API port
- Change `test123` if you prefer a different admin password
- This produces `forms/simple-form.html` and `forms/simple-form-admin.html`

---

## Step 6: Serve the forms folder

In a **second terminal**:

```bash
cd forms && npx serve . -p 5500
```

---

## Step 7: Test the flow

1. Open **http://localhost:5500/simple-form-admin.html**
2. Unlock with password `test123` (or whatever you set)
3. Click **Connect Google Sheet**
4. Sign in with Google and authorize
5. You should be redirected back with "Connected" and a "View in Google Sheet" link
6. Open **http://localhost:5500/simple-form.html**, fill it out, and submit
7. Check your Google Sheet — the response should appear

---

## Quick reference

| Terminal | Command |
|----------|---------|
| 1 (API) | `cd packages/service && pnpm dev` |
| 2 (Static) | `cd forms && npx serve . -p 5500` |

| URL | Purpose |
|-----|---------|
| http://localhost:5500/simple-form-admin.html | Admin panel |
| http://localhost:5500/simple-form.html | Form |
| http://localhost:8787 | Formant API (backend only, no HTML) |

---

## Troubleshooting

### "Connect Google Sheet is not configured" (503)

- `.dev.vars` is missing or has placeholder values
- Restart the dev server after editing `.dev.vars`

### "The OAuth client was not found" / Error 401: invalid_client

- **Placeholder credentials:** Ensure `.dev.vars` has your real Client ID and Secret, not `your-client-id.apps.googleusercontent.com`
- **File not saved:** Save `.dev.vars` before starting the server
- **Wrong project:** Confirm the OAuth client exists in the project shown in the Cloud Console top bar

### "Access blocked" / Error 403: access_denied

- **Test user:** Your sign-in email must be in **OAuth consent screen** → **Test users**
- **User type:** If set to **Internal**, only Google Workspace users in your org can sign in. Use **External** for personal Gmail.
- **Ineligible account:** Some accounts (e.g. child accounts) can't be test users. Try a different Google account.

### "admin.html not found" / 404

- The API (port 8787) doesn't serve HTML — it's backend only
- Use **http://localhost:5500/simple-form-admin.html** (the static server), not port 8787

### Internal Server Error on Connect

- Run `pnpm db:migrate:local` in `packages/service` — the `oauth_sessions` table may be missing

### redirect_uri_mismatch

- The redirect URI in Google Cloud must **exactly** match: `http://localhost:8787/api/connect-sheets/callback`
- Check for typos, wrong port, or trailing slash

---

## Production (Vercel + Connect Google Sheet)

Deploy form + admin to Vercel with Connect Google Sheet in one command:

```bash
FORMANT_ADMIN_PASSWORD=your-secret pnpm formant deploy forms/<name>.html --target vercel --with-sheets
```

This deploys the Cloudflare Worker (API) first, then builds form + admin with `FORMANT_API_URL`, then deploys both to Vercel.

**After deploy:**

1. Add your production URLs to the OAuth client in [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → your OAuth client:
   - **Authorized JavaScript origins:** Your admin URL (e.g. `https://formant-form-xxx.vercel.app`)
   - **Authorized redirect URIs:** `https://<your-worker>.workers.dev/api/connect-sheets/callback`

2. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as secrets in Cloudflare:
   ```bash
   cd packages/service && pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```

3. Open your admin URL, unlock, and click **Connect Google Sheet**.

---

## Production — Cloudflare (full deploy)

For a full Cloudflare deploy (Worker + D1):

1. Deploy with:
   ```bash
   pnpm formant deploy forms/<name>.html --target cloudflare
   ```

2. Set secrets:
   ```bash
   cd packages/service && pnpm exec wrangler secret put GOOGLE_CLIENT_ID
   pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
   ```

3. Add to Google Cloud OAuth client (APIs & Services → Credentials → your OAuth client):
   - **Authorized JavaScript origins:** Dashboard URL (if deployed) or `http://localhost:5500` for local dashboard
   - **Authorized redirect URIs:** `https://<your-worker>.workers.dev/api/connect-sheets/callback`

4. Open the dashboard (`forms/<name>-dashboard.html`), paste API key, and click **Connect Google Sheet**.

---

## Production — Vercel + Postgres

For Vercel with Postgres backend:

1. Deploy with:
   ```bash
   pnpm formant deploy forms/<name>.html --target vercel --with-backend
   ```

2. Set env vars in the Vercel project: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

3. Add to Google Cloud OAuth client:
   - **Authorized JavaScript origins:** Dashboard URL (if deployed) or `http://localhost:5500`
   - **Authorized redirect URIs:** `https://<your-api>.vercel.app/api/connect-sheets/callback`

4. Open the dashboard (`forms/<name>-dashboard.html`), paste API key, and click **Connect Google Sheet**.

---

**Note:** For Connect to work, the dashboard must be served over HTTPS (or localhost). If using the local dashboard file, run `npx serve forms` and open from `http://localhost:5500/<name>-dashboard.html`. Add the dashboard URL to **Authorized JavaScript origins** in Google Cloud.
