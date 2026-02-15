# Unified Deploy System: Offline / Vercel / Cloudflare

Replace the current single-target `deploy-vercel.sh` with a deploy system supporting three targets: offline HTML (local file), Vercel (static hosting + optional Sheets), and Cloudflare (full-stack hosting with built-in response collection). Update the CLI and Cursor skill to present these as first-class options.

## Architecture

```
pnpm deploy forms/my-form.html
        |
        v
  "How do you want to deploy?"
        |
   +---------+-----------+
   |         |           |
   v         v           v
Offline    Vercel    Cloudflare
(open      (static   (Worker +
browser)   hosting)   D1 db)
   |         |           |
   |    +----+----+      |
   |    |         |      |
   |  Sheets?   Done     |
   |  (clasp)            |
   v         v           v
 Done      Done       POST form
                     -> live URL
```

## Phase 1: Deploy scripts (5 files)

### 1a. `scripts/deploy.sh` — Entry point and menu

- Takes `<form.html>` as first arg, optional `--target offline|vercel|cloudflare` to skip menu
- If no `--target`, prompts interactively with the three options
- Dispatches to the appropriate script

### 1b. `scripts/deploy-offline.sh` — Trivial

- Verify HTML file exists
- Print absolute path
- Open in default browser (`xdg-open` / `open`)
- Print note: "Responses will download as Excel when the form is submitted."

### 1c. `scripts/deploy-vercel.sh` — Rewrite of existing

1. Check if `vercel` CLI is available (prompt to install via `npm i -g vercel` if not)
2. Check if logged in (`vercel whoami`), run `vercel login` if not
3. Deploy HTML (temp dir, copy as index.html, `vercel --yes`)
4. Print live URL
5. Ask: "Set up Google Sheets for response collection? (y/N)"
   - If yes → run `scripts/setup-sheets.sh`
   - If no → remind them Excel download is the fallback

### 1d. `scripts/deploy-cloudflare.sh` — New, handles first-time + subsequent

1. **Check wrangler**: Use `pnpm --filter @formant/service exec wrangler` (already a devDep)
2. **Check auth**: `wrangler whoami`. If not logged in → `wrangler login` (opens browser once)
3. **Check D1 database**: Read `packages/service/wrangler.toml`. If `database_id` is empty:
   - Run `wrangler d1 create formant-db`
   - Parse `database_id` from output
   - Patch into `wrangler.toml`
   - Run migration: `wrangler d1 execute formant-db --remote --file=src/db/schema.sql`
4. **Deploy Worker**: `wrangler deploy` from `packages/service/`
   - Capture Worker URL from output
5. **Generate API key**: `uuidgen` or `openssl rand -hex 16`
6. **POST the form**: `curl -X POST <worker-url>/api/forms` with:
   - `Authorization: Bearer <api-key>`
   - Body: `{ "html": "<file contents>", "schema": <companion .json> }`
   - Schema JSON auto-detected from `<name>.json` next to `<name>.html`
7. **Print results**: Live URL, API key, management commands

### 1e. `scripts/setup-sheets.sh` — clasp-assisted Sheets setup

1. Check if `clasp` available (`npx @google/clasp --version`), install if needed
2. Check login (`npx @google/clasp login --status`), run `clasp login` if not
3. Ask for Google Sheet URL (or offer to create new one)
4. Create Apps Script project: `clasp create --type sheets --parentId <sheet-id>`
5. Copy `scripts/apps-script/sheets-connector.gs` into clasp project dir, `clasp push`
6. Deploy: `clasp deploy --description "Formant connector"`
7. Print authorization instructions (user must visit URL once to approve — unavoidable Google requirement)
8. Test endpoint with GET request to confirm it's working
9. Print the Apps Script URL for the form schema

## Phase 2: CLI updates

### 2a. Auto-copy schema JSON alongside HTML on build

In `packages/html-builder/src/cli.ts`, after writing the HTML:

```typescript
const schemaOutPath = outPath.replace(/\.html$/, ".json");
fs.copyFileSync(resolved, schemaOutPath);
```

This way `forms/feedback.html` always has `forms/feedback.json` next to it.

### 2b. Add `deploy` command to CLI

```
formant deploy <form.html> [--target offline|vercel|cloudflare]
```

Delegates to `scripts/deploy.sh` with args forwarded.

## Phase 3: Update Cursor skill

Update `.cursor/skills/formant/SKILL.md`:

1. Replace "Deploy to Vercel" with a deploy decision point
2. Add **Deploy Options** section:
   - **Offline**: just want to try the form, internal use, email the HTML
   - **Vercel**: shareable public URL, no server-side storage needed
   - **Cloudflare**: hosting + response collection in one place (recommended for production)
3. Update CLI Reference with `deploy` command
4. Add guidance: after building, ask user "How would you like to use this form?"

## Phase 4: Update root package.json

Change deploy script to route through CLI:

```json
"deploy": "tsx packages/html-builder/src/cli.ts deploy"
```

## Verification

1. `pnpm formant build apps/e2e/fixtures/simple-form.json -o forms/simple-form.html` produces both `.html` and `.json`
2. `pnpm deploy forms/simple-form.html --target offline` opens in browser
3. `pnpm deploy forms/simple-form.html --target vercel` deploys (requires `vercel login`)
4. `pnpm deploy forms/simple-form.html --target cloudflare` walks through setup (requires `wrangler login`)
5. TypeScript clean: `pnpm --filter @formant/html-builder exec tsc --noEmit`
6. Tests pass: `pnpm test -- --run` and `pnpm test:e2e`

## File Summary

| File | Action |
|------|--------|
| `scripts/deploy.sh` | New — menu entry point |
| `scripts/deploy-offline.sh` | New — open locally |
| `scripts/deploy-vercel.sh` | Rewrite — add auth checks, Sheets prompt |
| `scripts/deploy-cloudflare.sh` | New — full first-time + subsequent CF deploy |
| `scripts/setup-sheets.sh` | New — clasp-assisted Sheets connector setup |
| `packages/html-builder/src/cli.ts` | Edit — add `deploy` command, copy schema on build |
| `.cursor/skills/formant/SKILL.md` | Edit — 3 deploy options, updated workflow |
| `package.json` | Edit — update deploy script |

## Risk: clasp authorization

Google Apps Script web app deployments via `clasp deploy` still require the user to visit the URL and click "Authorize" in the browser once. The `setup-sheets.sh` script should print the URL clearly and walk them through it. This is the one unavoidable manual step.
