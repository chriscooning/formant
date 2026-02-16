# Developer Onboarding & Documentation Plan

**Date:** 2026-02-15  
**Context:** Prepare the repo for sharing with other developers. Address gaps identified in README, deploy help, and project structure.

---

## Goal

Make the repo discoverable and understandable for new developers. Ensure the Vercel + Postgres backend option is documented and the project structure reflects the full codebase.

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | README: add Vercel + Postgres to deploy table |
| **2** | README: update project structure to include service-vercel |
| **3** | deploy.sh: add --with-backend to Vercel options in --help |
| **4** | Vercel Postgres note + build-first reminder in setup.sh |
| **5** | README: add Vercel Postgres to Tech Stack |

---

## Phase 1 — README Deploy Table

### Current

The deploy table lists Offline, Vercel, Vercel+admin, Vercel+Sheets, Cloudflare. The **Vercel + Postgres** option (server-side storage, same API as Cloudflare) is missing.

### Change

Add a row to the Deploy Options table:

| Target | Best For | Command |
|--------|----------|---------|
| ... | ... | ... |
| **Vercel + Postgres** | Production: Vercel hosting + server-side storage | `pnpm formant deploy forms/my-form.html --target vercel --with-backend` |

**File:** `README.md`

**Note:** Requires Vercel Postgres (`vercel postgres create`). See `plans/deploy-vercel-conventions.md` for API URLs and env setup.

---

## Phase 2 — README Project Structure

### Current

```
packages/
  service/       # Cloudflare Workers API (Hono + D1)
```

### Change

Add `service-vercel/` and clarify service:

```
packages/
  service/         # Cloudflare Workers API (Hono + D1)
  service-vercel/  # Vercel Edge API (Hono + Postgres) — same interface as service
```

**File:** `README.md`

---

## Phase 3 — deploy.sh --help

### Current

Vercel options in help output:
- `--with-admin`
- `--with-sheets`
- `--admin-password`

### Change

Add `--with-backend`:

```
  Vercel options:
    --with-admin       Include admin panel (form + admin, IndexedDB responses)
    --with-sheets      Deploy Worker first, then form + admin with Connect Google Sheet
    --with-backend     Deploy Vercel API + Postgres, upload form, generate dashboard
    --admin-password   Admin password for --with-admin (or FORMANT_ADMIN_PASSWORD env)
```

**File:** `scripts/deploy.sh`

---

## Phase 4 — Vercel Postgres Note + Build-First Reminder

### 4a. Vercel Postgres note (README)

Add a one-line note under the Vercel + Postgres row or in the Vercel (non-interactive) paragraph:

> **Vercel + Postgres:** Requires `vercel postgres create` and migrations. See `plans/deploy-vercel-conventions.md`.

**File:** `README.md`

### 4b. Build-first reminder (setup.sh)

The `forms/*.html` files are gitignored. New clones have JSON schemas but no built HTML. Update setup.sh output to make this explicit:

**Current output:**
```
  Or build manually:
    pnpm formant build forms/simple-form.json -o forms/simple-form.html
```

**Change:** Add a line before or after to clarify that HTML must be built first:

```
  Forms are built from JSON. Build before opening:
    pnpm formant build forms/simple-form.json -o forms/simple-form.html
```

Or keep the existing "Or build manually" and add: "HTML files are gitignored — build from JSON first."

**File:** `scripts/setup.sh` (or `setup.sh` at repo root)

---

## Phase 5 — README Tech Stack

### Current

Tech stack lists Cloudflare D1 but not Vercel Postgres:

```
- Cloudflare D1 — SQLite database for hosted response collection
```

### Change

Add Vercel Postgres so developers know both backend options:

```
- Cloudflare D1 — SQLite database for hosted response collection (Cloudflare)
- Vercel Postgres — Postgres for hosted response collection (Vercel + --with-backend)
```

Or a single line if preferred:

```
- Cloudflare D1 / Vercel Postgres — hosted response collection (Cloudflare or Vercel)
```

**File:** `README.md`

---

## Verification Checklist

```bash
# 1. README has Vercel + Postgres in deploy table
grep -A1 "Vercel + Postgres" README.md

# 2. README project structure includes service-vercel
grep "service-vercel" README.md

# 3. deploy help shows --with-backend
pnpm formant deploy forms/simple-form.html --help | grep with-backend

# 4. setup.sh mentions build-first
grep -i "build" setup.sh

# 5. README tech stack mentions Vercel Postgres
grep -i "vercel postgres" README.md
```

---

## Out of Scope (Future)

- **CONTRIBUTING.md** — Test commands, local dev workflow, PR expectations
