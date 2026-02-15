# Local Form + Admin Panel (Kiosk Mode)

> Forms that run on a device (e.g. iPad) without network. Responses stored in IndexedDB. Admin panel reads from IndexedDB, exports CSV/XLSX, protected by password from `.env`.

**Use case**: Drop a folder on an iPad, open the form, people submit and see "Thank you" (no download). Admin opens admin panel, enters password, exports responses.

---

## Phase Overview

| Phase | Description | Prerequisites |
|-------|-------------|---------------|
| **5A** | Local submit destination (IndexedDB) | 1E-1, 1E-2 |
| **5B** | Admin panel (local mode) | 5A |
| **5C** | Build integration (--local, password) | 5B |

---

# Phase 5A — Local Submit Destination

## Goal

Add a `local` submit destination that stores responses in IndexedDB. No Excel download. User sees ending screen only.

## Prerequisites

- Phase 1E-1 complete (submit handlers)
- Phase 1E-2 complete (Formant component)

## Implementation

### 1. Core Types

**File**: [`packages/core/src/types.ts`](packages/core/src/types.ts)

Add:

```ts
export interface LocalDestination {
  type: "local";
}

export type SubmitDestination =
  | SheetsDestination
  | WebhookDestination
  | ServiceDestination
  | ExcelDestination
  | LocalDestination;
```

### 2. Validation

**File**: [`packages/core/src/validate.ts`](packages/core/src/validate.ts)

In `validateDestination`, add:

```ts
case "local":
  // No config required
  break;
```

### 3. Local Submit Module

**File**: `packages/renderer/src/submit/local.ts` (create)

```ts
import type { FormResponse } from "@formant/core";

const DB_NAME = "formant_local";
const STORE_NAME = "responses";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: ["formId", "id"] });
      }
    };
  });
}

export async function saveToLocal(formId: string, response: FormResponse): Promise<void> {
  const id = response.responseId ?? crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record = {
    formId,
    id,
    submittedAt: response.submittedAt,
    answers: response.answers,
    metadata: response.metadata ?? null,
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getAllFromLocal(formId: string): Promise<FormResponse[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const all = (req.result as Array<{ formId: string; id: string; submittedAt: string; answers: Record<string, unknown>; metadata: unknown }>)
        .filter((r) => r.formId === formId)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
        .map((r) => ({
          formId: r.formId,
          responseId: r.id,
          status: "completed" as const,
          submittedAt: r.submittedAt,
          answers: r.answers,
          metadata: r.metadata,
        }));
      resolve(all);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}
```

### 4. Submit Handler

**File**: [`packages/renderer/src/submit/handler.ts`](packages/renderer/src/submit/handler.ts)

- Import `saveToLocal` from `./local`
- Add case:

```ts
case "local":
  await saveToLocal(schema.id, response);
  return { destination: "local", success: true };
```

### 5. Tests

**File**: `packages/renderer/__tests__/submit.test.ts`

Add test: when destination is `{ type: "local" }`, `saveToLocal` is called, no Excel download. Mock IndexedDB if needed (e.g. `fake-indexeddb` or skip in Node — submit tests may run in jsdom which has no IndexedDB). Consider a unit test for `local.ts` that uses `fake-indexeddb` or run renderer submit tests in a browser env.

**Pragmatic**: Add a simple test that a schema with `local` destination doesn't throw. Full IndexedDB test may require `fake-indexeddb` package or E2E.

## Verification

```bash
pnpm --filter @formant/core exec tsc --noEmit
pnpm --filter @formant/renderer exec tsc --noEmit
pnpm --filter @formant/renderer test
```

Manual: Build a form with `destinations: [{ type: "local" }]`, submit, check IndexedDB in DevTools.

## Files Changed

| Action | File |
|--------|------|
| Modify | `packages/core/src/types.ts` |
| Modify | `packages/core/src/validate.ts` |
| Create | `packages/renderer/src/submit/local.ts` |
| Modify | `packages/renderer/src/submit/handler.ts` |
| Modify | `packages/renderer/__tests__/submit.test.ts` |

---

# Phase 5B — Admin Panel (Local Mode)

## Goal

Create an admin panel that reads responses from IndexedDB, displays them in a table, and exports CSV/XLSX. Reuse the Cloudflare dashboard UI. Password gate (hash from build, compared at runtime).

## Prerequisites

- Phase 5A complete

## Implementation

### 1. Unified Dashboard Template

**File**: [`.cursor/skills/formant/templates/responses-dashboard.html`](.cursor/skills/formant/templates/responses-dashboard.html)

Refactor to support two modes via placeholders:

- `{{MODE}}` — `"cloudflare"` or `"local"`
- `{{WORKER_URL}}` — empty when local
- `{{FORM_ID}}`, `{{FORM_TITLE}}`, `{{SCHEMA_JSON}}` — same as now
- `{{ADMIN_PASSWORD_HASH}}` — hex SHA-256 hash, only for local (empty when cloudflare)

**Local mode behavior**:
- Hide API key section (`.auth` when `MODE === "local"`)
- "Load responses" → call `getAllFromLocal(FORM_ID)` (inline the IndexedDB read logic, or assume a global)
- Before showing data: show password prompt. Hash input with `crypto.subtle.digest('SHA-256', ...)`, compare to `ADMIN_PASSWORD_HASH`. Store "unlocked" in sessionStorage for the session.
- Export CSV: generate client-side (RFC 4180, same column logic as service's csv.ts)
- Export XLSX: use SheetJS (add script tag when local mode — CDN or inline)

**CSV generation**: Port the logic from `packages/service/src/utils/csv.ts` to vanilla JS. Use `extractInputFields`-style column derivation from schema, `normaliseValue` for cells.

**XLSX**: Add `<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js">` when local. Generate workbook client-side from responses array.

### 2. Password Hashing (Build Time)

Build will pass `ADMIN_PASSWORD_HASH`. At runtime:

```js
async function verifyPassword(input, storedHash) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  return hex === storedHash;
}
```

### 3. Standalone Admin Template (Alternative)

If refactoring the existing dashboard is messy, create a new template:

**File**: `.cursor/skills/formant/templates/admin-local.html`

- Same structure as responses-dashboard (table, export buttons)
- No API key
- Placeholders: `{{FORM_ID}}`, `{{FORM_TITLE}}`, `{{SCHEMA_JSON}}`, `{{ADMIN_PASSWORD_HASH}}`
- Load from IndexedDB, password gate, CSV/XLSX export

### 4. IndexedDB Origin Note

For `file://`, form and admin must be in the same folder to share IndexedDB. Document this. Output: `form.html` and `admin.html` in same directory.

## Verification

- Generate admin-local.html with placeholder values
- Open in browser (file:// or local server)
- Add test data to IndexedDB manually, or use a form with local destination
- Verify password gate, table render, CSV export, XLSX export

## Files Changed

| Action | File |
|--------|------|
| Modify or Create | `responses-dashboard.html` (refactor) or `admin-local.html` (new) |
| — | CSV/XLSX generation inline in template |

---

# Phase 5C — Build Integration

## Goal

CLI `--local` flag. Build outputs form.html + admin.html. Admin password from `FORMANT_ADMIN_PASSWORD` env. Schema gets `local` destination when --local.

## Prerequisites

- Phase 5B complete

## Implementation

### 1. CLI

**File**: [`packages/html-builder/src/cli.ts`](packages/html-builder/src/cli.ts)

- Add `--local` to build command
- Add `--admin-password <p>` or read `process.env.FORMANT_ADMIN_PASSWORD`
- When `--local`:
  - If schema has no `local` in destinations, add `{ type: "local" }` (or require user to add it — recommend auto-add)
  - Require admin password: error if missing
  - Call `buildLocalForm()` or similar

### 2. Build Logic

**File**: `packages/html-builder/src/buildLocal.ts` (create) or extend `build.ts`

- `buildFormHTML(schema, { local: true })` — build form with local destination
- `buildAdminHTML(schema, adminPasswordHash)` — render admin-local template with placeholders
- Output: `forms/<name>.html` (form), `forms/<name>-admin.html` (admin)

### 3. Password Hash

```ts
import { createHash } from "node:crypto";
const hash = createHash("sha256").update(password).digest("hex");
```

### 4. Deploy Script

**File**: `scripts/deploy-local.sh` (create) or extend `deploy-offline.sh`

- For `--target local`: build with --local, output to folder, open form (or just print paths)
- Or: `pnpm formant build forms/feedback.json --local` produces the files; deploy-local just copies to a target folder

### 5. Skill Update

**File**: [`.cursor/skills/formant/SKILL.md`](.cursor/skills/formant/SKILL.md)

- Add "Local" to deploy options table
- Document: `pnpm formant build forms/<name>.json --local` (requires `FORMANT_ADMIN_PASSWORD` in .env)
- Output: `forms/<name>.html` + `forms/<name>-admin.html`; copy both to device; open form for kiosk, admin for export

### 6. .env

Document in README or skill: create `.env` with `FORMANT_ADMIN_PASSWORD=your-secret`. Use `dotenv` in CLI or document manual `export FORMANT_ADMIN_PASSWORD=...` before build.

## Verification

```bash
export FORMANT_ADMIN_PASSWORD=test123
pnpm formant build forms/simple-form.json --local
```

- Check `forms/simple-form.html` and `forms/simple-form-admin.html` exist
- Open form, submit, verify IndexedDB has data
- Open admin, enter `test123`, verify table and export

## Files Changed

| Action | File |
|--------|------|
| Modify | `packages/html-builder/src/cli.ts` |
| Create | `packages/html-builder/src/buildLocal.ts` (or extend build.ts) |
| Create | `scripts/deploy-local.sh` (optional) |
| Modify | `.cursor/skills/formant/SKILL.md` |
| Modify | `plans/STATUS.md` — add 5A, 5B, 5C rows |

---

## Execution Order

```
5A → 5B → 5C
```

## Open Decisions

1. **Single file vs two files**: Plan uses two files (form + admin). Single file with `?admin=1` is possible but more complex.
2. **XLSX in admin**: Use SheetJS CDN in admin page. CSV is always available.
3. **dotenv**: Add `dotenv` to html-builder if not present, or document manual env export.
