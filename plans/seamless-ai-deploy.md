# Seamless AI-First Deploy

**Date:** 2026-02-15  
**Status:** Plan  
**Context:** Make deploy flows seamless for Cursor/Claude users. One request → form built and deployed with minimal manual steps.

---

## Goal

When a user says "make me a form that does X and deploy to Vercel" (or similar), the AI should:

1. Generate the schema
2. Build the form (and admin when needed)
3. Deploy everything required in one flow
4. Return a working URL and next steps

No "now run this, then run that, then configure Google Cloud." The AI orchestrates the full flow.

---

## Target User Flows

| User says | AI does | Result |
|-----------|---------|--------|
| "Deploy to Vercel" (Excel only) | Build form, deploy to Vercel | Form URL, Excel download on submit |
| "Deploy to Vercel with admin" | Build with `--local`, deploy form + admin to Vercel | Form URL, admin URL, IndexedDB responses |
| "Deploy to Vercel with Google Sheets" | Deploy Worker first, build with `FORMANT_API_URL`, deploy form + admin to Vercel | Form URL, admin URL, Connect Google Sheet works |
| "Deploy to Cloudflare" | Deploy Worker + form | Form URL, dashboard, D1 storage |

---

## Current State

| Flow | What works | Gap |
|------|------------|-----|
| Vercel | Form only, Excel | No admin; no Connect Google Sheet |
| Vercel + Sheets | — | Manual: deploy Worker, build with FORMANT_API_URL, deploy both to Vercel |
| Cloudflare | Worker + form | Works; dashboard is local file |

---

## Proposed Changes

### 1. New deploy flag: `--with-admin`

When deploying to Vercel, optionally include the admin panel.

- **CLI:** `pnpm deploy forms/x.html --target vercel --with-admin`
- **Behavior:** Before deploy, build with `--local` (or use pre-built admin if exists). Deploy both form and admin.
- **Vercel structure:** `index.html` (form), `admin.html` (admin) — or `form.html` + `admin.html` for clarity

### 2. New deploy flag: `--with-sheets`

When deploying to Vercel with Connect Google Sheet:

- **CLI:** `pnpm deploy forms/x.html --target vercel --with-sheets`
- **Behavior:**
  1. Deploy Worker to Cloudflare (or use `WORKER_URL` if set)
  2. Build form + admin with `FORMANT_API_URL` = Worker URL, `--local`
  3. Deploy form + admin to Vercel
  4. Print: Form URL, Admin URL, "Open admin and click Connect Google Sheet"

### 3. Vercel deploy script: support multiple files

- Accept optional admin HTML path or auto-detect `*-admin.html`
- Copy both form and admin to deploy dir
- Route structure: form at `/` or `/form`, admin at `/admin` (or `/simple-form-admin.html` for same-origin IndexedDB)

### 4. Skill updates

- **Response collection:** Add "Connect Google Sheet (one-click OAuth)" — requires Worker + admin
- **Deploy logic:** When user wants Vercel + Google Sheets → use `--target vercel --with-sheets`
- **Deploy logic:** When user wants Vercel + admin (view responses) → use `--target vercel --with-admin`
- **Explicit instructions:** "For Vercel + Connect Google Sheet: deploy Worker first, build with FORMANT_API_URL, deploy form + admin. Use `--with-sheets` if available."

### 5. Deploy script orchestration

- `deploy.sh` parses `--with-admin` and `--with-sheets`
- Forwards to `deploy-vercel.sh` with flags
- `deploy-vercel.sh` when `--with-sheets`:
  - Calls `deploy-cloudflare.sh` (or `WORKER_URL` check)
  - Gets Worker URL
  - Builds form + admin with `FORMANT_API_URL`
  - Deploys both to Vercel

---

## Implementation Phases

### Phase A: Vercel deploy with admin (no Worker)

**Scope:** `--with-admin` for Vercel. Form + admin, IndexedDB responses.

**Tasks:**
1. Add `--with-admin` to `deploy.sh` arg parsing
2. Update `deploy-vercel.sh` to accept admin HTML (or build it)
3. When `--with-admin`: ensure form + admin exist, copy both to deploy dir
4. Vercel routing: form at `/`, admin at `/admin.html` (or similar)
5. Update skill: "For Vercel + admin, use `--with-admin`"

**Files:** `scripts/deploy.sh`, `scripts/deploy-vercel.sh`, `.cursor/skills/formant/SKILL.md`

### Phase B: Vercel deploy with Connect Google Sheet

**Scope:** `--with-sheets` for Vercel. Worker + form + admin, Connect Google Sheet works.

**Tasks:**
1. Add `--with-sheets` to `deploy.sh`
2. When `--with-sheets`: run Cloudflare deploy first (or require `WORKER_URL`)
3. Parse Worker URL from deploy output
4. Build form + admin with `FORMANT_API_URL`, `FORMANT_ADMIN_PASSWORD`
5. Deploy form + admin to Vercel
6. Update skill: "For Vercel + Google Sheets, use `--with-sheets`"
7. Document: User must add Vercel URL to Google Cloud OAuth (or provide post-deploy instructions)

**Files:** `scripts/deploy.sh`, `scripts/deploy-vercel.sh`, `scripts/deploy-cloudflare.sh`, `.cursor/skills/formant/SKILL.md`, `docs/connect-google-sheet-local.md` (add production section)

### Phase C: Skill polish

**Scope:** AI-first workflow clarity.

**Tasks:**
1. Add "Connect Google Sheet" to response collection options in skill
2. Deploy decision tree: "If user wants X, use command Y"
3. Post-deploy instructions: "Add your Vercel URL to Google Cloud Authorized JavaScript origins"
4. Optional: `pnpm deploy` with no target shows "Do you want admin? (y/n)" and "Connect Google Sheet? (y/n)" for smarter defaults

---

## File Structure (Vercel deploy with admin/sheets)

```
DEPLOY_DIR/
├── index.html          # Form (or form.html)
├── admin.html          # Admin panel (same origin for IndexedDB)
├── vercel.json
```

For clean URLs, consider:
- `/` → form
- `/admin` → admin (via vercel.json rewrite or admin.html)

---

## Prerequisites & Edge Cases

| Case | Handling |
|------|----------|
| Worker already deployed | `WORKER_URL` env → skip Cloudflare deploy, use existing |
| No Cloudflare login | Deploy fails; print "Run `wrangler login` first" |
| No Google OAuth | Connect Google Sheet returns 503; admin shows "not configured" |
| Schema has no `local` dest | For `--with-admin` or `--with-sheets`, ensure schema gets `local` (buildLocal does this) |
| Admin password | `FORMANT_ADMIN_PASSWORD` env or `--admin-password`; required for `--local` build |

---

## Testing

1. **Phase A:** `pnpm deploy forms/simple-form.html --target vercel --with-admin` → form + admin on Vercel, submit, view in admin
2. **Phase B:** `pnpm deploy forms/simple-form.html --target vercel --with-sheets` → Worker + form + admin, Connect Google Sheet works
3. **Skill:** "Make a feedback form and deploy to Vercel with Google Sheets" → AI runs correct command

---

## Documentation Updates

- `README.md`: Document `--with-admin` and `--with-sheets`
- `docs/connect-google-sheet-local.md`: Add "Production (Vercel)" section — add Vercel URL to Google Cloud
- `docs/PRODUCT.md`: "One-command deploy for Vercel + Connect Google Sheet"

---

## Out of Scope (for this plan)

- Google Cloud OAuth setup automation (user must configure once)
- `WORKER_URL` persistence (user sets env or we parse from previous deploy)
- Vercel project linking / reuse (each deploy may create new project)
