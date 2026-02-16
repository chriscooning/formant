---
name: formant
description: Generate interactive HTML forms from natural language. Use when the user wants to create a form, survey, questionnaire, registration page, or feedback form. Also use when mentioning Formant, form schemas, or form building.
---

> **Role:** Cursor IDE skill. Used when Formant skill is active. Focus: deploy workflow, decision trees, quick reference. When deploy options change, update this file. Schema changes: also update `skill/SKILL.md`.

# Formant — Build Forms from Natural Language

Generate beautiful, one-question-at-a-time HTML forms. Forms are self-contained single HTML files with keyboard navigation, dark/light mode, smooth transitions, and multiple submit destinations.

## End-to-End Workflow

1. **Ask** what the user wants to collect **before** generating the schema:
   - **Questions and branching logic** — what to ask, in what order, any conditional flows
   - **Branding / theme** — *"Do you have a website URL I should match for colors and fonts?"* If they provide a URL, fetch it, extract the primary/accent color and font family, and add a `theme` block to the schema. Use `theme: { accent, accentHover?, defaultMode: "auto" }`.
   - **Response collection** — where should responses go?
    - **Excel download** (default, client-side) — works everywhere, no setup
    - **Connect Google Sheet** (one-click OAuth) — requires Worker + admin; use `--with-sheets` for Vercel
    - **Google Sheets** (Apps Script) — requires `scripts/setup-sheets.sh`
    - **Webhook** — POST to a URL (Zapier, Slack, custom API)
    - **Cloudflare D1** — requires Cloudflare deploy for server-side storage
    - **Vercel Postgres** — requires Vercel deploy with `service-vercel`; server-side storage + API key
    - **Local (IndexedDB)** — form + admin; use `pnpm formant build --local` for kiosk
    - Always include Excel as a fallback unless the user explicitly opts out.
2. **Generate** a valid FormSchema JSON
3. **Save** to `forms/<name>.json`
4. **Build** by running:
   ```bash
   pnpm formant build forms/<name>.json -o forms/<name>.html
   ```
   This produces both `forms/<name>.html` and `forms/<name>.json` (schema copy).
5. **Ask** the user: "How would you like to host this form?"
   - **Share with others** — Cloudflare (recommended — one command, database included). Vercel requires manual Postgres setup.
   - **Preview / test** — Offline or preview
   - **Special needs** — Vercel + Sheets (Google Sheets), Local (kiosk)
   - Hosting is separate from response collection: Excel and Sheets work on all targets.

## Deploy Options

### Recommended

**Share with others:** `pnpm formant deploy <form.html> --target cloudflare` — one command, database included, no setup. Vercel + Postgres also supported but requires adding a database first (see `docs/setup-vercel-postgres.md`).

**Preview / test locally:** `pnpm formant deploy <form.html> --target offline` or `pnpm formant preview <schema.json>`.

### Full reference

| Target | Best For | Response Collection | Command |
|--------|----------|---------------------|---------|
| **Offline** | Testing, internal use, email the file | Excel download on submit | `pnpm formant deploy <form.html> --target offline` |
| **Local** | Kiosk mode, iPad, no network | IndexedDB (form + admin panel) | `pnpm formant build forms/<name>.json --local` |
| **Cloudflare** | Production: one command, no setup | D1 + dashboard | `pnpm formant deploy <form.html> --target cloudflare` |
| **Vercel** | Shareable public URL, no server-side storage | Excel download (or add Google Sheets) | `pnpm formant deploy <form.html> --target vercel` |
| **Vercel + Sheets** | Connect Google Sheet (one-click OAuth) | Worker + form + admin | `pnpm formant deploy <form.html> --target vercel --with-sheets` |
| **Vercel + Postgres** | Production: Vercel + server-side storage | Postgres + dashboard | `pnpm formant deploy <form.html> --target vercel --with-backend` |

**Deploy decision tree:** Share with others → Cloudflare (recommended). "Deploy to Vercel" → Recommend Cloudflare first; if they insist, use `--target vercel --with-backend` and point to `docs/setup-vercel-postgres.md`. Test locally → Offline or preview. Google Sheets → `--with-sheets`. Kiosk/offline → `--local`.

**When user says "deploy to Vercel":** Recommend Cloudflare first: *"For the smoothest experience, I recommend Cloudflare — one command, database included. Shall I use that?"* If they agree → `--target cloudflare`. If they insist → `--target vercel --with-backend`, and tell them: *"Vercel requires adding a database first. See docs/setup-vercel-postgres.md for the 3 steps. Run deploy again after completing them."*

**When Cloudflare deploy fails (D1 creation):** The script shows wrangler output and next steps. Suggest: run `cd packages/service && pnpm exec wrangler login` if needed; enable Workers at the Cloudflare dashboard; or create the D1 database manually and add `database_id` to `packages/service/wrangler.toml`. See `docs/setup-cloudflare-d1.md`.

**Use `pnpm formant deploy`** (not `pnpm deploy` — that's pnpm's built-in). Run without `--target` for an interactive menu. See `docs/deploy-options.md` for full details.

## Field Type Cheat Sheet

| Type | Purpose | Key Properties |
|------|---------|----------------|
| `welcome` | Opening screen | `buttonText` |
| `text` | Single-line text | `placeholder`, `minLength`, `maxLength`, `pattern` |
| `email` | Email input | `placeholder` (auto-validates format) |
| `number` | Numeric input | `placeholder`, `min`, `max`, `step` |
| `phone` | Phone number | `placeholder` (loose validation) |
| `url` | URL input | `placeholder` |
| `textarea` | Multi-line text | `placeholder`, `minLength`, `maxLength`, `rows` |
| `choice` | Single select cards | `options[]`, `allowOther` (auto-advances, A-Z keys) |
| `multi_choice` | Multi select cards | `options[]`, `minSelections`, `maxSelections` |
| `rating` | Star rating | `max` (1-10), `labels` |
| `scale` | Numeric scale (NPS) | `min`, `max` (required), `minLabel`, `maxLabel` |
| `yes_no` | Binary choice | `yesLabel`, `noLabel` (Y/N keys, auto-advances) |
| `date` | Date picker | `minDate`, `maxDate` (ISO format) |
| `dropdown` | Dropdown select | `options[]`, `searchable` (use for 8+ options) |
| `statement` | Info screen, no input | `buttonText` |
| `ending` | Final screen | `showSummary`, `redirectUrl`, `redirectLabel` |

## Schema Structure (Minimal)

```json
{
  "id": "form-id",
  "title": "Form Title",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Hello!", "buttonText": "Start" },
    { "id": "name", "type": "text", "title": "Your name?", "required": true },
    { "id": "end", "type": "ending", "title": "Thanks!" }
  ],
  "submit": { "destinations": [{ "type": "excel" }] },
  "theme": { "accent": "#6c5ce7", "defaultMode": "auto" }
}
```

## Response Collection

**Ask before generating the schema.** Do not default to Excel without asking. Explicitly ask: *"Where should responses go?"*

| Option | Schema mapping | Notes |
|--------|----------------|-------|
| Excel download | `{ "type": "excel" }` | Client-side XLSX. Works on all hosting targets. |
| CSV download | `{ "type": "csv" }` | Client-side CSV. Lighter than Excel, good for dev. |
| Local (IndexedDB) | `{ "type": "local" }` | Kiosk mode. Use `pnpm formant build --local` for form + admin. |
| Connect Google Sheet | `{ "type": "local" }` + Worker + admin | One-click OAuth. Use `pnpm formant deploy --target vercel --with-sheets`. |
| Google Sheets (Apps Script) | `{ "type": "sheets", "url": "..." }` | Requires `scripts/setup-sheets.sh` |
| Webhook | `{ "type": "webhook", "url": "..." }` | POST JSON to any URL |
| Cloudflare D1 | `{ "type": "service", "formId": "...", "endpoint": "..." }` | Requires Cloudflare deploy |
| Vercel Postgres | `{ "type": "service", "formId": "...", "endpoint": "https://your-api.vercel.app" }` | Deploy `service-vercel`; `POSTGRES_URL` required |

**Rule:** Always include Excel or CSV in `submit.destinations` unless the user explicitly opts out. Multiple destinations fire in parallel.

**Example:** *"I'll need a few details before building. What questions do you want to ask? Do you have a website URL I should match for branding? And where should responses go — Excel download, Google Sheets, a webhook URL, or Cloudflare D1? I'll include Excel as a fallback unless you prefer otherwise."*

## Submit Destinations

Multiple destinations fire in parallel. Always include `excel` or `csv` as a fallback (except for local/kiosk mode).

- **allowSubmitterDownload** (optional): When `false`, hides the "Download Responses" button on the thank-you screen. Use for kiosk/local forms where the admin exports from the admin panel. Default: `true`. Set automatically to `false` when building with `--local`.

| Type | Required Fields | Notes |
|------|-----------------|-------|
| `excel` | -- | Client-side XLSX download. Optional `filename`. |
| `csv` | -- | Client-side CSV download. Optional `filename`. Lighter, good for dev. |
| `local` | -- | IndexedDB storage. Use with `--local` build for form + admin. |
| `sheets` | `url` | Google Apps Script web app URL |
| `webhook` | `url` | POST JSON. Optional `headers`. Retries once on 5xx. |
| `service` | `formId` | Formant hosting service. Optional `endpoint` (Cloudflare Workers or Vercel Postgres API URL). |

## Branching

Any field can have a `next` property:

- **Unconditional:** `"next": "field-id"` -- always jump to that field
- **Conditional:** `"next": { "Happy": "praise", "Unhappy": "complaint", "default": "end" }` -- branch on answer value

All branches must eventually reach the `ending` field.

## Validation Checklist (verify before saving)

1. Every `id` is unique
2. At least one field exists
3. Exactly one `ending` field, reachable from all paths
4. All `next` targets reference valid field `id`s
5. `choice` and `dropdown` have non-empty `options`
6. `scale` has both `min` and `max`
7. `submit.destinations` includes at least `{ "type": "excel" }` or `{ "type": "csv" }`
8. Use descriptive IDs (`"satisfaction"` not `"q3"`)
9. Don't use `required: true` on `welcome`, `statement`, or `ending`

## Prefill via URL params

Forms accept pre-filled values from URL query params. Param names match field IDs.

Example: `https://example.com/form.html?name=John&email=john@example.com` — the `name` and `email` fields will be pre-filled when the user reaches them. Useful for links from emails, internal tools, or CRM systems.

## Design Guidelines

- Start with `welcome`, end with `ending`
- Write conversational titles: "What's your email?" not "Email Address:"
- Use `choice` for 2-7 options, `dropdown` for 8+
- Use `statement` to break up long forms
- Keep forms focused: 5-12 questions ideal
- Add `subtitle` for context, `placeholder` for text inputs

## CLI Reference

```bash
# Build
pnpm formant build <schema.json> [-o output.html] [--no-minify] [--inline]
pnpm formant build forms/<name>.json --local  # form + admin, requires FORMANT_ADMIN_PASSWORD
pnpm formant preview <schema.json>   # build + open in browser

# Deploy (interactive menu)
pnpm formant deploy <form.html>

# Deploy (skip menu)
pnpm formant deploy <form.html> --target offline      # open in browser
pnpm formant deploy <form.html> --target cloudflare   # deploy to Cloudflare (recommended, one command)
pnpm formant deploy <form.html> --target vercel       # deploy to Vercel
pnpm formant deploy <form.html> --target vercel --with-sheets  # Worker + form + admin, Connect Google Sheet

# Local/kiosk: build produces form.html + form-admin.html
export FORMANT_ADMIN_PASSWORD=your-secret
pnpm formant build forms/<name>.json --local

# Google Sheets setup (standalone)
bash scripts/setup-sheets.sh
```

## Full Schema Reference

For complete field property tables, branching rules, submit destination details, theme configuration, and worked examples, see [schema-reference.md](schema-reference.md).
