# Cloudflare Isolated DB Mode

**Date:** 2026-02-16  
**Status:** Future plan  
**Context:** Optional `--isolated` flag for Cloudflare deploy that spins up a new D1 database (and Worker) per form. Use case: compliance, clean deletion, per-client isolation for agencies.

---

## Goal

When deploying with `--target cloudflare --isolated`, create a **dedicated Worker + D1 database** for that form only. No shared database. Each form gets full isolation.

---

## Current vs Isolated

| Aspect | Current (shared) | Isolated |
|--------|------------------|----------|
| D1 databases | One (`formant-db`) per account | One per form |
| Worker | One (`formant`) serves all forms | One per form (`formant-{formId}`) |
| URL | `formant.workers.dev/f/{formId}` | `formant-{formId}.workers.dev/f/{formId}` |
| Delete form + data | Delete form row; responses remain in shared DB | Delete Worker + D1 = full wipe |
| D1 free tier | 1 DB covers many forms | N forms = N DBs (limit: 5 DBs on free) |

---

## Architecture

**One Worker per form.** Cloudflare bindings are fixed at deploy time, so we can't dynamically route to different DBs from a single Worker. The clean approach: deploy a separate Worker with its own D1 binding for each form.

**Flow:**
1. Generate form ID and API key (before deploy)
2. Create D1 database: `wrangler d1 create formant-{formId}`
3. Generate `wrangler.toml` with `name = "formant-{formId}"`, `database_name = "formant-{formId}"`, `database_id = <new-id>`
4. Run migration on the new DB
5. Deploy Worker with `wrangler deploy --config <generated-toml>`
6. POST form to the new Worker's `/api/forms` (with `id: formId` in body so it uses our pre-chosen ID)
7. Output live URL, API key, dashboard

---

## Implementation Plan

### Phase 1 — deploy-cloudflare.sh: --isolated flag

**Parse `--isolated`** in deploy.sh and pass to deploy-cloudflare.sh.

**When `--isolated` is set:**
1. Generate form ID and API key first (before any deploy)
2. Create D1: `$WRANGLER d1 create formant-${FORM_ID}` (unique name per form)
3. Parse database_id from create output (handle "already exists" — unlikely with unique name)
4. Write temp wrangler.toml:
   ```toml
   name = "formant-${FORM_ID}"
   main = "src/worker.ts"
   compatibility_date = "2024-12-01"
   compatibility_flags = ["nodejs_compat"]

   [[d1_databases]]
   binding = "DB"
   database_name = "formant-${FORM_ID}"
   database_id = "${DB_ID}"
   ```
5. Run migration: `wrangler d1 execute formant-${FORM_ID} --remote --file=schema.sql` (with temp config)
6. Deploy Worker: `wrangler deploy --config <temp-toml> --yes` from packages/service
7. POST form to `https://formant-${FORM_ID}.workers.dev/api/forms` with `Authorization: Bearer ${API_KEY}`, body `{ html, schema, id: FORM_ID }`
8. Generate dashboard with the Worker URL
9. Clean up temp wrangler.toml

**Do not modify** the main `packages/service/wrangler.toml` — isolated mode uses a generated config only.

### Phase 2 — Worker name constraints

Cloudflare workers.dev subdomains: `{name}.{subdomain}.workers.dev`. The name must be valid (alphanumeric, hyphens). Form IDs are nanoid (12 chars, alphanumeric). `formant-{formId}` should work.

**Edge case:** If a form ID starts with a number or has invalid chars, sanitize: use `formant-${FORM_ID}` and ensure it matches `[a-zA-Z0-9_-]+`. Nanoid is already alphanumeric.

### Phase 3 — Skill and docs

**Skill:** Add to deploy options: "For full data isolation per form: `--target cloudflare --isolated`. Creates a dedicated Worker + D1 per form. Note: D1 free tier limits databases."

**docs/deploy-options.md:** Add section for isolated mode. Clarify: use when you need per-form isolation or clean deletion. Each form consumes one D1 database (free tier: 5 DBs).

**docs/setup-cloudflare-d1.md:** Add "Isolated mode" section — when to use it, D1 limits.

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/deploy.sh` | Parse `--isolated`, pass to deploy-cloudflare.sh |
| `scripts/deploy-cloudflare.sh` | Implement isolated flow (generate form ID first, create DB, temp wrangler, deploy, upload) |
| `.cursor/skills/formant/SKILL.md` | Document `--isolated` |
| `docs/deploy-options.md` | Add isolated mode section |
| `docs/setup-cloudflare-d1.md` | Add isolated mode notes |

---

## Out of Scope

- **Vercel isolated mode** — Different architecture (Postgres); would need separate DB per form. Lower priority.
- **Migrating existing forms** — No migration path from shared to isolated. User would redeploy.
- **Aggregated dashboard across isolated forms** — Each form still has its own dashboard; no cross-form view.

---

## Verification

```bash
# Isolated deploy
pnpm formant deploy forms/bake-sale.html --target cloudflare --isolated

# Expect:
# - New D1: formant-{formId}
# - New Worker: formant-{formId}.workers.dev
# - Form at https://formant-{formId}.workers.dev/f/{formId}
# - Dashboard generated
# - Main wrangler.toml unchanged
```

---

## D1 Free Tier Consideration

Cloudflare D1 free tier: 5 databases per account. Isolated mode uses one DB per form. Users with many forms will hit the limit. Document this clearly. Shared mode remains the default for this reason.
