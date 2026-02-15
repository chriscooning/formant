---
name: formant
description: Generate interactive HTML forms from natural language. Use when the user wants to create a form, survey, questionnaire, registration page, or feedback form. Also use when mentioning Formant, form schemas, or form building.
---

# Formant — Build Forms from Natural Language

Generate beautiful, one-question-at-a-time HTML forms. Forms are self-contained single HTML files with keyboard navigation, dark/light mode, smooth transitions, and multiple submit destinations.

## End-to-End Workflow

1. **Ask** what the user wants to collect **before** generating the schema:
   - **Questions and branching logic** — what to ask, in what order, any conditional flows
   - **Response collection** — where should responses go?
     - **Excel download** (default, client-side) — works everywhere, no setup
     - **Google Sheets** — requires `scripts/setup-sheets.sh`
     - **Webhook** — POST to a URL (Zapier, Slack, custom API)
     - **Cloudflare D1** — requires Cloudflare deploy for server-side storage
     - Always include Excel as a fallback unless the user explicitly opts out.
2. **Generate** a valid FormSchema JSON
3. **Save** to `forms/<name>.json`
4. **Build** by running:
   ```bash
   pnpm formant build forms/<name>.json -o forms/<name>.html
   ```
   This produces both `forms/<name>.html` and `forms/<name>.json` (schema copy).
5. **Ask** the user: "How would you like to host this form?" — offline, Vercel, or Cloudflare.
   - **Offline** — open in browser or email the HTML file
   - **Vercel** — shareable public URL, no server needed
   - **Cloudflare** — hosting + built-in D1 response collection (recommended if they chose Cloudflare for responses)
   - Hosting is separate from response collection: Excel and Sheets work on all targets. If they chose Cloudflare D1 for responses, recommend Cloudflare deploy.

## Deploy Options

| Target | Best For | Response Collection | Command |
|--------|----------|---------------------|---------|
| **Offline** | Testing, internal use, email the HTML file | Excel download on submit | `pnpm deploy <form.html> --target offline` |
| **Local** | Kiosk mode, iPad, no network | IndexedDB (form + admin panel) | `pnpm formant build forms/<name>.json --local` |
| **Vercel** | Shareable public URL, no server-side storage needed | Excel download (or add Google Sheets) | `pnpm deploy <form.html> --target vercel` |
| **Cloudflare** | Production: hosting + response DB in one place | Built-in D1 database + API + XLSX/CSV export | `pnpm deploy <form.html> --target cloudflare` |

- **Offline**: Opens the form in the default browser. Responses download as Excel on submit. No hosting needed.
- **Local**: Build with `--local` produces `forms/<name>.html` (form) and `forms/<name>-admin.html` (admin panel). Requires `FORMANT_ADMIN_PASSWORD` in env or `--admin-password <p>`. Form stores responses in IndexedDB; admin reads from IndexedDB, password gate, CSV/XLSX export. Copy both files to the device (same folder for IndexedDB origin). Open form for kiosk, admin for export.
- **Vercel**: Deploys as a static site with a public URL. Optionally set up Google Sheets for response collection (the script walks through it).
- **Cloudflare**: Deploys a Cloudflare Worker with D1 database. Forms are uploaded via API, responses are collected server-side, and XLSX/CSV export endpoints are available. A local dashboard is created at `forms/<name>-dashboard.html` — open it, paste your API key, and view or export responses (CSV or XLSX). First-time setup creates the database and runs migrations automatically.

Run `pnpm deploy <form.html>` without `--target` for an interactive menu.

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
| Local (IndexedDB) | `{ "type": "local" }` | Kiosk mode. Use `pnpm formant build --local` for form + admin. |
| Google Sheets | `{ "type": "sheets", "url": "..." }` | Requires `scripts/setup-sheets.sh` |
| Webhook | `{ "type": "webhook", "url": "..." }` | POST JSON to any URL |
| Cloudflare D1 | `{ "type": "service", ... }` | Requires Cloudflare deploy |

**Rule:** Always include Excel in `submit.destinations` unless the user explicitly opts out. Multiple destinations fire in parallel.

**Example:** *"I'll need a few details before building. What questions do you want to ask, and where should responses go — Excel download, Google Sheets, a webhook URL, or Cloudflare D1? I'll include Excel as a fallback unless you prefer otherwise."*

## Submit Destinations

Multiple destinations fire in parallel. Always include `excel` as a fallback (except for local/kiosk mode).

| Type | Required Fields | Notes |
|------|-----------------|-------|
| `excel` | -- | Client-side XLSX download. Optional `filename`. |
| `local` | -- | IndexedDB storage. Use with `--local` build for form + admin. |
| `sheets` | `url` | Google Apps Script web app URL |
| `webhook` | `url` | POST JSON. Optional `headers`. Retries once on 5xx. |
| `service` | `formId` | Formant hosting service. Optional `endpoint`. |

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
7. `submit.destinations` includes at least `{ "type": "excel" }`
8. Use descriptive IDs (`"satisfaction"` not `"q3"`)
9. Don't use `required: true` on `welcome`, `statement`, or `ending`

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
pnpm deploy <form.html>

# Deploy (skip menu)
pnpm deploy <form.html> --target offline      # open in browser
pnpm deploy <form.html> --target vercel       # deploy to Vercel
pnpm deploy <form.html> --target cloudflare   # deploy to Cloudflare Workers

# Local/kiosk: build produces form.html + form-admin.html
export FORMANT_ADMIN_PASSWORD=your-secret
pnpm formant build forms/<name>.json --local

# Google Sheets setup (standalone)
bash scripts/setup-sheets.sh
```

## Full Schema Reference

For complete field property tables, branching rules, submit destination details, theme configuration, and worked examples, see [schema-reference.md](schema-reference.md).
