# Seamless Deploy Experience

**Date:** 2026-02-15  
**Status:** Complete  
**Context:** When a user says "make me a form that does X and deploy", it should **just work**. Default to Cloudflare — one command, database included, no manual steps.

---

## Goal

**Default to Cloudflare** so "deploy" means one command. Vercel stays supported for users who explicitly want it; they follow a simple 3-step checklist and run deploy again when ready.

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | Formant Skill — default Cloudflare, recommend when user asks for Vercel |
| **2** | Interactive deploy menu — Cloudflare first |
| **3** | docs/deploy-options.md — Cloudflare quick start |
| **4** | README — Cloudflare one-liner |
| **5** | docs/setup-vercel-postgres.md — 3-step checklist (for Vercel users) |
| **6** | deploy-vercel.sh — on form upload failure, print link to setup doc |

---

## Phase 1 — Formant Skill

### Changes to `.cursor/skills/formant/SKILL.md`

**Deploy recommendation:**
- Share with others: **Cloudflare** (recommended — one command, database included). Vercel requires manual Postgres setup.

**Deploy decision tree:**
```
User wants to share form with others?
├── No platform preference → Cloudflare
├── "Deploy to Vercel" → Recommend Cloudflare; if they insist, Vercel + --with-backend
└── "Deploy to Cloudflare" → Cloudflare
```

**When user says "deploy to Vercel":**
- Recommend Cloudflare first: *"For the smoothest experience, I recommend Cloudflare — one command, database included. Shall I use that?"*
- If they agree → `--target cloudflare`
- If they insist → `--target vercel --with-backend`, and tell them: *"Vercel requires adding a database first. See docs/setup-vercel-postgres.md for the 3 steps. Run deploy again after completing them."*

**Default deploy command (no platform specified):**
- Run `pnpm formant deploy forms/<name>.html --target cloudflare`

---

## Phase 2 — Interactive Deploy Menu

### Changes to `scripts/deploy.sh`

Reorder options:
```
1) Offline    — Open in browser, responses download as Excel
2) Cloudflare — Shareable URL + database (recommended, one command)
3) Vercel     — Shareable URL + database (create DB in Vercel UI first)
```

Choice mapping: 2 → cloudflare, 3 → vercel

---

## Phase 3 — docs/deploy-options.md

- Add quick start at top: `pnpm formant deploy form.html --target cloudflare`
- Put Cloudflare first in "Share with others"
- Note: Vercel + Postgres requires adding a database first; see `docs/setup-vercel-postgres.md`

---

## Phase 4 — README

- Put Cloudflare first in deploy table
- Add one-liner: *"Deploy with one command: `pnpm formant deploy form.html --target cloudflare` — includes database, no setup."*

---

## Phase 5 — docs/setup-vercel-postgres.md

Create minimal doc with 3-step checklist:

```
Vercel + database requires a one-time setup:

1. Create database: Vercel Dashboard → your project → Storage → Create Database → Neon (free)
2. Run migration:   cd packages/service-vercel && vercel env pull && psql "$POSTGRES_URL" -f src/db/schema.sql
3. Run deploy again: pnpm formant deploy forms/<name>.html --target vercel --with-backend
```

Add link to Vercel Storage: https://vercel.com/dashboard/stores

---

## Phase 6 — deploy-vercel.sh

On form upload failure (HTTP 5xx): print one line before exiting:

```
Form upload failed. Add a database first — see docs/setup-vercel-postgres.md
```

---

## Files Changed Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `.cursor/skills/formant/SKILL.md` | Default Cloudflare, "deploy to Vercel" handling |
| 2 | `scripts/deploy.sh` | Reorder menu |
| 3 | `docs/deploy-options.md` | Cloudflare quick start |
| 4 | `README.md` | Cloudflare one-liner |
| 5 | `docs/setup-vercel-postgres.md` | Create — 3-step checklist |
| 6 | `scripts/deploy-vercel.sh` | On form upload failure, print link to setup doc |

---

## Verification

```bash
pnpm formant deploy forms/bake-sale.html
# Menu: Offline 1, Cloudflare 2, Vercel 3

pnpm formant deploy forms/bake-sale.html --target cloudflare
# One command, live URL, no manual steps
```
