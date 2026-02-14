# Phase 3A — Service Database & Middleware

## Goal

Build the infrastructure layer of the Cloudflare Worker service: D1 database schema, CORS middleware, auth middleware, typed query helpers, and Hono app skeleton.

## Prerequisites

- Phase 1B complete (`@formant/core` types — specifically `FormSchema`, `FormResponse`, `ResponseStatus`)
- `packages/service/` has placeholder files, wrangler.toml, and dependencies installed

## Dependency Graph Position

```
Phase 1B ──► ► Phase 3A ◄ ──► Phase 3B (service routes)
```

**Parallelism:** Phase 3A can start as soon as Phase 1B is complete. It runs in parallel with Phases 1C through 1F.

---

## Implementation Spec

### 1. Database Schema (`packages/service/src/db/schema.sql`)

```sql
-- Formant Service — D1 Database Schema

-- Forms table: stores the generated HTML and metadata
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,                     -- nanoid, 12 chars
  title TEXT,
  html TEXT NOT NULL,                      -- The complete HTML string
  schema_json TEXT NOT NULL,               -- The FormSchema JSON (for inspection/export)
  api_key_hash TEXT,                       -- SHA-256 of creator's API key
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  view_count INTEGER DEFAULT 0,
  submit_count INTEGER DEFAULT 0
);

-- Responses table: stores individual form submissions
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,                     -- nanoid, 16 chars
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',  -- 'in_progress' or 'completed'
  answers_json TEXT NOT NULL,              -- The answers object as JSON
  metadata_json TEXT,                      -- User agent, duration, lastFieldId, etc.
  submitted_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
```

**Key changes from original plan:**
- Added `status` column (`'in_progress'` | `'completed'`) for progressive capture
- Added `updated_at` column on responses (for auto-save tracking)
- Added `ON DELETE CASCADE` on form_id foreign key
- Added index on `status` column

### 2. Typed Query Helpers (`packages/service/src/db/queries.ts`)

```typescript
import type { FormSchema, FormResponse } from "@formant/core";

// D1 database type from Cloudflare Workers
type D1Database = any; // Use actual @cloudflare/workers-types in implementation

// ─── Form Queries ───

export interface FormRecord {
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

export async function insertForm(
  db: D1Database,
  form: { id: string; title?: string; html: string; schemaJson: string; apiKeyHash?: string }
): Promise<void>

export async function getFormById(db: D1Database, id: string): Promise<FormRecord | null>

export async function getFormHtml(db: D1Database, id: string): Promise<string | null>

export async function incrementViewCount(db: D1Database, id: string): Promise<void>

export async function incrementSubmitCount(db: D1Database, id: string): Promise<void>

export async function deleteForm(db: D1Database, id: string): Promise<void>
// Also deletes responses via CASCADE

// ─── Response Queries ───

export interface ResponseRecord {
  id: string;
  form_id: string;
  status: string;
  answers_json: string;
  metadata_json: string | null;
  submitted_at: string;
  updated_at: string;
}

export async function insertResponse(
  db: D1Database,
  response: {
    id: string;
    formId: string;
    status: string;
    answersJson: string;
    metadataJson?: string;
  }
): Promise<void>

export async function updateResponse(
  db: D1Database,
  id: string,
  update: {
    status?: string;
    answersJson?: string;
    metadataJson?: string;
  }
): Promise<void>
// Used by auto-save (PUT endpoint)

export async function getResponseById(db: D1Database, id: string): Promise<ResponseRecord | null>

export async function getResponsesByFormId(
  db: D1Database,
  formId: string,
  options?: { limit?: number; offset?: number; since?: string; status?: string }
): Promise<{ responses: ResponseRecord[]; total: number }>
// Default limit: 100
// 'since' filters by submitted_at >= since
// 'status' filters by status column

export async function getResponseCount(db: D1Database, formId: string): Promise<number>
```

All queries use parameterized statements (D1's `prepare().bind()`) to prevent SQL injection.

### 3. CORS Middleware (`packages/service/src/middleware/cors.ts`)

Critical for forms opened from file:// (null origin), email clients, and Claude artifacts.

```typescript
import { Context, Next } from "hono";

export function corsMiddleware() {
  return async (c: Context, next: Next) => {
    const origin = c.req.header("Origin");
    
    // Allow all origins including null (from file:// and data: URIs)
    // For public endpoints (form serving, response submission),
    // any origin must be allowed
    const allowOrigin = origin || "*";
    
    // Handle preflight OPTIONS
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400", // Cache preflight for 24h
        },
      });
    }
    
    await next();
    
    // Add CORS headers to all responses
    c.res.headers.set("Access-Control-Allow-Origin", allowOrigin);
    c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    c.res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  };
}
```

**Key points:**
- Must handle `Origin: null` (sent by local HTML files opened with file://)
- Must handle missing Origin header
- Preflight (OPTIONS) must return 204 with correct headers
- All responses get CORS headers, not just specific routes
- Auth is handled separately — CORS allows the request through, auth validates it

### 4. Auth Middleware (`packages/service/src/middleware/auth.ts`)

Simple API key authentication. No user accounts, no sessions.

```typescript
import { Context, Next } from "hono";

export function authMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }
    
    const apiKey = authHeader.slice(7); // Remove "Bearer "
    
    if (!apiKey) {
      return c.json({ error: "Empty API key" }, 401);
    }
    
    // Hash the key for comparison against stored hashes
    const keyHash = await hashApiKey(apiKey);
    
    // Store on context for route handlers to use
    c.set("apiKeyHash", keyHash);
    c.set("apiKey", apiKey); // Raw key needed for form creation
    
    await next();
  };
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Helper: verify a key matches a stored hash
export async function verifyApiKey(key: string, storedHash: string): Promise<boolean> {
  const keyHash = await hashApiKey(key);
  return keyHash === storedHash;
}
```

**Design:**
- No user registration — the API key IS the identity
- Users generate their own keys (any string, recommend UUID v4)
- On form creation: hash the key, store the hash with the form
- On management endpoints: hash the provided key, compare against stored hash
- Uses Web Crypto API (`crypto.subtle.digest`) — available in Workers runtime

### 5. ID Generation (`packages/service/src/utils/id.ts`)

```typescript
import { nanoid } from "nanoid";

export function generateFormId(): string {
  return nanoid(12); // 12-char form IDs
}

export function generateResponseId(): string {
  return nanoid(16); // 16-char response IDs
}
```

### 6. Hono App Skeleton (`packages/service/src/index.ts`)

```typescript
import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Global middleware
app.use("*", corsMiddleware());

// Routes will be added in Phase 3B
// app.route("/api/forms", formsRouter);
// app.route("/api/responses", responsesRouter);
// app.route("/f", servingRouter);

export default app;
```

### 7. Vitest Config for Workers

Create `packages/service/vitest.config.ts`:
```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: {
          configPath: "./wrangler.toml",
        },
      },
    },
  },
});
```

This uses miniflare under the hood to simulate the Workers runtime with real D1 bindings.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/service/src/db/schema.sql` | Replace placeholder with full schema |
| `packages/service/src/db/queries.ts` | Replace placeholder with typed query helpers |
| `packages/service/src/middleware/cors.ts` | Replace placeholder with CORS middleware |
| `packages/service/src/middleware/auth.ts` | Replace placeholder with auth middleware |
| `packages/service/src/utils/id.ts` | Replace placeholder with ID generators |
| `packages/service/src/index.ts` | Replace placeholder with Hono app skeleton |
| `packages/service/vitest.config.ts` | **NEW** — Workers vitest config |
| `packages/service/wrangler.toml` | Verify config is correct |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/service exec tsc --noEmit

# D1 schema is valid SQL (can be tested with sqlite3 or in miniflare)
# Verify by running schema against a local SQLite:
sqlite3 :memory: < packages/service/src/db/schema.sql

# Vitest with workers pool can initialize
pnpm --filter @formant/service test
```

- D1 schema creates forms and responses tables with all columns and indexes
- `status` column exists on responses table with default `'in_progress'`
- CORS middleware handles null origin and preflight OPTIONS
- Auth middleware validates Bearer tokens and hashes with SHA-256
- Query helpers are typed and use parameterized statements
- Hono app skeleton starts without errors
- `@cloudflare/vitest-pool-workers` is configured

## Open Questions

None — all decisions resolved for this segment.
