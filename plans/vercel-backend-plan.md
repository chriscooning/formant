# Vercel Backend Plan — For Master Repo

**Date:** 2026-02-14  
**Context:** Standalone implementation plan for adding a Vercel backend with the same interface as Cloudflare.

---

## Goal

Add a Vercel backend that provides the **same API interface** as the Cloudflare service: form hosting, response collection, XLSX/CSV export, and dashboard. Vercel deploy should support server-side response storage with API key auth, matching Cloudflare's capabilities.

---

## Architecture Decisions

### Performance: Edge for Parity with Cloudflare

| Aspect | Cloudflare Workers | Vercel Serverless (Node) | Vercel Edge |
|--------|--------------------|---------------------------|-------------|
| Cold start | ~0–5 ms | ~100–500 ms | ~0–50 ms |
| Runtime | V8 isolates | Node.js containers | Deno/Edge Runtime |

**Decision:** Use **Vercel Edge Functions** for the API so cold starts match Cloudflare. Node serverless would be noticeably slower.

### Database: Postgres for Schema Parity

| Option | Pros | Cons |
|--------|------|------|
| Vercel KV (Redis) | Very fast, Edge-native | No SQL, custom schema for analytics |
| **Vercel Postgres** | Same SQL schema as D1, shared logic | Slightly higher latency |
| Turso (SQLite) | Edge SQLite, closest to D1 | External service |

**Decision:** Use **Vercel Postgres**. Same schema as D1 where possible; shared query logic; HTTP driver works from Edge. Revisit KV if Postgres latency is problematic.

### Same Interface

Both backends expose identical endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/forms` | Bearer token | Create form |
| GET | `/f/:id` | Public | Serve form HTML |
| POST | `/api/responses/:formId` | Public | Submit response |
| PUT | `/api/responses/:formId/:responseId` | Public | Update response (auto-save) |
| GET | `/api/responses/:formId` | Bearer token | List responses |
| GET | `/api/responses/:formId/analytics` | Bearer token | Analytics |
| GET | `/api/responses/:formId/xlsx` | Bearer token | Export XLSX |
| GET | `/api/responses/:formId/csv` | Bearer token | Export CSV |
| DELETE | `/api/forms/:id` | Bearer token | Delete form |

Form schema `submit.destinations` uses `{ "type": "service", "formId": "...", "endpoint": "..." }` for both platforms.

---

## Phase Summary

| Phase | Description | Prerequisites |
|-------|-------------|---------------|
| **8A** | Shared API layer + DB abstraction | Phases 3A, 3B, 7 complete |
| **8B** | Vercel adapter + Postgres | Phase 8A |
| **8C** | Deploy script + form integration | Phase 8B |
| **8D** | Testing parity + documentation | Phase 8C |

---

## Phase 8A — Shared API Layer + DB Abstraction

### Goal

Extract platform-agnostic logic from `packages/service/` so routes can run against either D1 (Cloudflare) or Postgres (Vercel). Introduce a database abstraction interface.

### 1. Database Interface (`packages/service/src/db/interface.ts`)

Define an interface that both D1 and Postgres implement:

```typescript
// packages/service/src/db/interface.ts

export interface FormRow {
  id: string;
  title: string | null;
  html: string;
  schema_json: string;
  api_key_hash: string | null;
  created_at: string;
  updated_at: string;
  view_count: number;
  submit_count: number;
}

export interface ResponseRow {
  id: string;
  form_id: string;
  answers_json: string;
  metadata_json: string | null;
  submitted_at: string;
  status: string;
  session_id: string | null;
  updated_at: string | null;
}

export interface DbAdapter {
  insertForm(params: { id: string; title: string | null; html: string; schemaJson: string; apiKeyHash: string | null }): Promise<FormRow>;
  getFormById(id: string): Promise<FormRow | null>;
  incrementViewCount(id: string): Promise<void>;
  incrementViewCountDaily(formId: string): Promise<void>;
  incrementSubmitCount(id: string): Promise<void>;
  deleteForm(id: string): Promise<boolean>;
  insertResponse(params: { id: string; formId: string; answersJson: string; metadataJson: string | null; status?: string; sessionId?: string | null }): Promise<ResponseRow>;
  updateResponse(params: { id: string; formId: string; answersJson: string; metadataJson: string | null; status: string }): Promise<{ updated: boolean }>;
  getResponsesByFormId(formId: string, options?: { limit?: number; offset?: number; since?: string; status?: string }): Promise<{ responses: ResponseRow[]; total: number }>;
  getAllResponsesForExport(formId: string, options?: { status?: string }): Promise<ResponseRow[]>;
  getAnalytics(formId: string, days: 7 | 14 | 30): Promise<AnalyticsResult>;
}

export interface AnalyticsResult {
  totals: { views: number; submissions: number; completionRate: number; avgDurationSeconds: number };
  series: { date: string; views: number; submissions: number }[];
  highestDropoff: { fieldId: string; fieldTitle: string; count: number } | null;
}
```

### 2. Refactor Cloudflare Routes to Use Adapter

- Add `DbAdapter` to `AppEnv.Bindings` (or `Variables`).
- Cloudflare: pass a D1-backed adapter that wraps existing `queries.ts`.
- Routes call `c.env.db.insertForm(...)` instead of `insertForm(c.env.DB, ...)`.
- Keep `packages/service/src/db/queries.ts` as the D1 implementation; add a thin `D1Adapter` that implements `DbAdapter`.

### 3. Shared Route Logic

- Ensure route handlers use only the adapter interface.
- Auth middleware stays shared (API key hashing is pure logic).
- XLSX/CSV generation stays shared (no DB-specific code).

### 4. Tests

- Add unit tests for the adapter interface (mock adapter).
- Existing Cloudflare tests continue to pass with D1Adapter.

---

## Phase 8B — Vercel Adapter + Postgres

### Goal

Create a Vercel Edge deployment that runs the same Hono app with a Postgres-backed adapter.

### 1. Package Structure

**Option A: New package `packages/service-vercel/`**

```
packages/service-vercel/
  api/
    [[...path]].ts       # Edge catch-all → Hono
  src/
    db/
      postgres.ts        # PostgresAdapter implementing DbAdapter
      schema.sql        # Postgres migrations (same schema as D1)
    index.ts            # Hono app with Postgres bindings
  package.json
  vercel.json
  tsconfig.json
```

**Option B: Adapter inside `packages/service/`**

- Add `packages/service/vercel/` or `packages/service/src/adapters/vercel.ts`.
- Single Vercel project at repo root with `api/` pointing to service.

Recommendation: **Option A** for clearer separation; `service-vercel` depends on `@formant/service` for shared types and route logic, or shares code via a `@formant/service-core` package.

### 2. Postgres Schema

Mirror D1 schema. Use `POSTGRES_URL` or Vercel Postgres env vars. Example (Postgres syntax):

```sql
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  title TEXT,
  html TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  api_key_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  submit_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  answers_json TEXT NOT NULL,
  metadata_json TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'completed',
  session_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_views_daily (
  form_id TEXT NOT NULL,
  date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (form_id, date),
  FOREIGN KEY (form_id) REFERENCES forms(id)
);

CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_responses_submitted_at ON responses(submitted_at);
CREATE INDEX idx_responses_status ON responses(status);
CREATE INDEX idx_responses_session_id ON responses(session_id);
```

### 3. Hono + Vercel Edge

- Use `@hono/vercel` or equivalent Edge adapter.
- Export handler: `export default handle(app)`.
- Ensure no Node.js APIs (no `fs`, `path`); use Web APIs.
- XLSX library: verify it runs in Edge (no Node deps).

### 4. PostgresAdapter

- Use `@vercel/postgres` or `postgres` (postgres.js) with HTTP driver for Edge.
- Implement each `DbAdapter` method with equivalent SQL.
- Date functions: D1 uses `datetime('now')`, Postgres uses `NOW()` — normalize in adapter.

### 5. vercel.json

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "framework": null,
  "functions": {
    "api/[[...path]].ts": {
      "runtime": "edge"
    }
  }
}
```

### 6. Environment

- `POSTGRES_URL` or `POSTGRES_PRISMA_URL` (Vercel Postgres).
- No `DB` binding; adapter gets URL from `process.env` or Vercel's `@vercel/postgres`.

---

## Phase 8C — Deploy Script + Form Integration

### Goal

Update `scripts/deploy-vercel.sh` so it deploys the API (with DB), uploads the form, and outputs live URL + API key + dashboard.

### 1. Deploy Flow

1. **Deploy API first** (if not already deployed):
   - `cd packages/service-vercel` (or API dir)
   - `vercel deploy` or `vercel deploy --prod`
   - Capture `API_URL` (e.g. `https://formant-api-xxx.vercel.app`)

2. **Provision Postgres** (if first-time):
   - `vercel postgres create` or link existing
   - Run migrations

3. **Generate API key**: `uuidgen` or `openssl rand -hex 16`

4. **Upload form**: `POST $API_URL/api/forms` with `Authorization: Bearer $API_KEY`, body `{ html, schema }`

5. **Patch form HTML**: Inject `service` destination with `endpoint: $API_URL`, `formId: $FORM_ID`

6. **Deploy static form**: Same as current flow (temp dir, `formant-form`, `vercel deploy`)

7. **Generate dashboard**: `forms/<name>-dashboard.html` with `{{WORKER_URL}}` → `$API_URL`, `{{FORM_ID}}`, etc.

8. **Print output**: Live URL, API key, dashboard path, management commands

### 2. Script Structure

- Add `--backend` flag or detect: `deploy-vercel.sh --with-backend` vs static-only.
- Or: always deploy backend when `packages/service-vercel` exists; otherwise static-only.

### 3. Dashboard Template

- Reuse `responses-dashboard.html` from Cloudflare.
- Replace `{{WORKER_URL}}` with `$API_URL` (Vercel API base).
- Same placeholder structure: `{{FORM_ID}}`, `{{FORM_TITLE}}`, `{{SCHEMA_JSON}}`.

---

## Phase 8D — Testing Parity + Documentation

### Goal

Same test coverage for Cloudflare and Vercel backends. Update docs and skill.

### 1. Shared Test Suite

- Parameterized tests: run against both adapters.
- Or: abstract "backend" in tests; run same cases with D1Adapter and PostgresAdapter (in-memory or test DB).

### 2. Test Matrix

| Test | Cloudflare | Vercel |
|------|------------|--------|
| Auth (hash, verify) | ✓ | ✓ |
| POST /api/forms | ✓ | ✓ |
| GET /f/:id | ✓ | ✓ |
| POST /api/responses | ✓ | ✓ |
| PUT /api/responses (auto-save) | ✓ | ✓ |
| GET /api/responses | ✓ | ✓ |
| GET /api/responses/analytics | ✓ | ✓ |
| GET /api/responses/xlsx | ✓ | ✓ |
| GET /api/responses/csv | ✓ | ✓ |
| DELETE /api/forms | ✓ | ✓ |
| CORS | ✓ | ✓ |
| E2E submit flow | ✓ | ✓ |

### 3. Documentation

- Update SKILL.md: add Vercel to deploy options table with "Response collection: Postgres + API key".
- Add `plans/deploy-vercel-conventions.md` (mirror `deploy-cloudflare-conventions.md`).
- Document `POSTGRES_URL` and API key setup.

### 4. Open Questions

- **Vercel Postgres from Edge**: Confirm `@vercel/postgres` or `postgres` HTTP driver works in Edge.
- **Hono Edge adapter**: Verify `@hono/vercel` supports Edge runtime.
- **XLSX in Edge**: Ensure `xlsx` library runs in Deno/Edge (no Node-only deps).
- **Project layout**: Single Vercel project (API + static) vs separate API project.

---

## Verification Checklist (per phase)

```bash
# TypeScript compiles
pnpm -r exec tsc --noEmit

# Tests pass
pnpm --filter @formant/service test
pnpm --filter @formant/service-vercel test  # when added

# Lint
pnpm lint
```

---

## File Structure (Target)

```
packages/
  service/                    # Cloudflare + shared
    src/
      routes/                 # Platform-agnostic handlers
      middleware/
      db/
        interface.ts          # DbAdapter + types (NEW)
        queries.ts            # D1 implementation (existing)
        d1-adapter.ts         # D1Adapter wrapping queries (NEW)
        schema.sql            # D1 schema (existing)
  service-vercel/             # NEW: Vercel-specific
    api/
      [[...path]].ts          # Edge catch-all → Hono
    src/
      db/
        postgres.ts           # PostgresAdapter
        schema.sql            # Postgres migrations
      index.ts                # Hono app with Postgres bindings
    vercel.json
    package.json
```

---

## Dependency Graph

```
Phase 3A (D1 schema) ──┐
Phase 3B (routes) ─────┼──► Phase 8A (shared layer) ──► Phase 8B (Vercel adapter)
Phase 7 (analytics) ───┘                                      │
                                                              ▼
                                            Phase 8C (deploy script)
                                                              │
                                                              ▼
                                            Phase 8D (testing + docs)
```

---

## Summary for Agents

1. **Read this plan** before implementing.
2. **Phase 8A first**: Introduce `DbAdapter` and refactor Cloudflare service to use it. All existing tests must pass.
3. **Phase 8B**: Create `service-vercel` package with Postgres adapter and Edge deployment.
4. **Phase 8C**: Extend `deploy-vercel.sh` to deploy API, upload form, generate dashboard.
5. **Phase 8D**: Add Vercel backend tests and update documentation.
