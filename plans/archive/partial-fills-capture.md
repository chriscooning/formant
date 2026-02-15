# Partial Fills Capture — Smart Session-Based Capture

> Fix how we capture partial form fills. Full submissions = 1 entry only. Partial submissions = session-based, update-in-place, with email filter.

---

## Goals

1. **Full submissions**: When a form reaches the ending screen and submits, show exactly **1 entry** (no duplicates from progressive saves).
2. **Partial submissions tab**: Capture session state up to the last field entered. Update in place when user goes back and changes answers. **Do not** capture each progressive snapshot.
3. **Filter partials**: Ability to filter by "has email" vs "no email" for partial submissions.

---

## Current State

| Area | Current Behavior | Gap |
|------|------------------|-----|
| **Local mode** | Only stores completed submissions via `saveToLocal`. No partial capture. | No partial fills at all. |
| **Service (Cloudflare)** | POST only. No `status` column. No PUT endpoint. `useAutoSave` sends PUT requests that would 404. | Progressive capture not wired up. |
| **Admin (local)** | Single table, all responses. | No tabs, no filtering. |
| **Admin (Cloudflare)** | Single table, all responses. | No tabs, no filtering. |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Form Session (browser)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  sessionId: UUID (generated on first load, persisted in sessionStorage) │
│  On first answer → create/upsert partial (status: in_progress)           │
│  On answer change / question advance → UPDATE same record               │
│  On submit → UPDATE to completed OR create new completed (see below)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ┌───────────────┐               ┌───────────────┐
            │  Local (IDB)  │               │   Service     │
            │  key: [formId,│               │  key: id +    │
            │   sessionId]  │               │  status col   │
            └───────────────┘               └───────────────┘
```

### Deduplication Rule (Full Submissions)

- **If auto-save created an `in_progress` record** for this session → **UPDATE** it to `completed`. Do **not** create a second record.
- **If no auto-save** (e.g. local-only, or user completed in one shot) → **CREATE** new `completed` record.

Result: Each completed form = exactly 1 row.

---

## Phase 1: Data Model & Storage

### 1a. Local Mode — IndexedDB Schema Update

**File**: `packages/renderer/src/submit/local.ts`

- **DB version bump** to 2 (migration).
- **Key path change**: `["formId", "sessionId"]` instead of `["formId", "id"]`.
  - `sessionId` = session identifier (see 1c).
  - For completed-only records (legacy or no-partial forms), use a synthetic `sessionId` = `responseId` or `completed-${id}` so we don't break existing data.
- **New fields** on each record:
  - `status`: `"in_progress" | "completed"`
  - `sessionId`: string (primary for partials)
  - `lastFieldId`: string | null (from metadata)
  - `updatedAt`: string (ISO timestamp) — for "last activity" display

**Migration**: On upgrade, for existing records without `sessionId`, set `sessionId = id` and `status = "completed"`. This preserves existing completed responses.

### 1b. Local Mode — New Functions

- `savePartialToLocal(formId, sessionId, response)` — upsert by `[formId, sessionId]`. Sets `status: "in_progress"`.
- `completePartialToLocal(formId, sessionId, response)` — update existing partial to `status: "completed"`, or insert if no partial existed (user submitted without ever triggering partial save).
- `getCompletedFromLocal(formId)` — returns only `status === "completed"`.
- `getPartialsFromLocal(formId)` — returns only `status === "in_progress"`, sorted by `updatedAt` desc.

### 1c. Session ID

**File**: `packages/renderer/src/utils/sessionId.ts` (new)

```ts
const SESSION_KEY = "formant_session_id";

export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}
```

- One session per browser tab. New tab = new session.
- Persists across page refresh within same tab.

### 1d. Service — D1 Schema Update

**File**: `packages/service/src/db/schema.sql`

Add migration (new file `schema-migration-status.sql` or append to schema):

```sql
-- Add status column (default for new rows)
ALTER TABLE responses ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';

-- Backfill: existing rows are completed
UPDATE responses SET status = 'completed' WHERE status IS NULL OR status = '';

-- Add session_id for partials (nullable for legacy completed-only)
ALTER TABLE responses ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_responses_status ON responses(status);
CREATE INDEX IF NOT EXISTS idx_responses_session_id ON responses(session_id);
```

**Note**: SQLite `ALTER TABLE ADD COLUMN` doesn't support `DEFAULT` for existing rows in some versions. Adjust: add column nullable, backfill, then add NOT NULL if needed.

**File**: `packages/service/src/db/queries.ts`

- `ResponseRow`: add `status`, `session_id`.
- `insertResponse`: accept `status`, `sessionId`.
- `updateResponse`: new function — update answers, metadata, status, `updated_at` by id. Reject if `status` already `"completed"` (no overwriting completed).
- `getResponsesByFormId`: add `status?: "in_progress" | "completed" | "all"` filter.
- `getPartialsByFormId`: convenience for `status: "in_progress"`.

### 1e. Service — PUT Endpoint

**File**: `packages/service/src/routes/responses.ts`

- `PUT /api/responses/:formId/:responseId` — public, no auth.
  - Body: `{ answers, metadata?, status? }`
  - If existing row has `status === "completed"` → 409 Conflict.
  - Otherwise update row, return 200.

- `POST /api/responses/:formId` — extend:
  - Accept `sessionId` in body (optional).
  - If `status === "in_progress"` and `sessionId` provided: upsert by `(form_id, session_id)` if we add unique constraint, or check for existing partial with same session and update. Simpler: always create new on POST, use PUT for updates. So:
    - **POST** = create new (either in_progress or completed). Return `responseId` in body.
    - **PUT** = update existing by id.

- **Idempotency for partials**: use `sessionId` to find existing in_progress for this form+session. If found, PUT to that id. If not, POST to create. This logic lives in the **client** (useAutoSave), not the server. Server just does POST/PUT.

---

## Phase 2: Client Logic

### 2a. useAutoSave — Session-Based Upsert

**File**: `packages/renderer/src/hooks/useAutoSave.ts`

- Import `getSessionId`.
- On first interaction: POST with `{ answers, metadata, status: "in_progress", sessionId }`. Server creates record, returns `responseId`. Store in ref.
- On subsequent updates: PUT to `responseId` with `{ answers, metadata, status: "in_progress" }`.
- **Do not** POST again. One POST per session, then only PUTs until completion.

**Service API contract**:
- POST returns `{ responseId, submitted_at }`.
- Optionally: POST could accept `sessionId` and return existing `responseId` if an in_progress with that session exists (upsert). That would require server-side "find by session" — more complex. Simpler: client always POSTs once, gets id, then PUTs. No session lookup on server.

### 2b. Local Mode — useLocalPartialSave (new hook)

**File**: `packages/renderer/src/hooks/useLocalPartialSave.ts` (new)

- Similar to useAutoSave but targets IndexedDB.
- Enabled when `local` destination exists and no `service` destination (or we could run both; but for local-only forms).
- On first answer: `savePartialToLocal(formId, sessionId, { status: "in_progress", answers, metadata })`.
- On answer change / advance: `savePartialToLocal` (upsert).
- Debounced on typing (e.g. 2–3 seconds).
- `markCompleted`: call `completePartialToLocal` — either update existing partial or insert completed (if user never triggered partial).

### 2c. Submit Handler — Deduplication

**File**: `packages/renderer/src/submit/handler.ts`

For **service** destination:
- When submitting, if `autoSave.responseId` exists → use `submitToService` with `responseId` and `status: "completed"` so the service **updates** the existing row instead of creating a new one.
- `submitToService` must support PUT when `responseId` is provided.

**File**: `packages/renderer/src/submit/service.ts`

- If `responseId` provided: `PUT /api/responses/:formId/:responseId` with full response body including `status: "completed"`.
- If not: `POST /api/responses/:formId` (current behavior).

For **local** destination:
- When submitting, call `completePartialToLocal(formId, sessionId, response)`. This updates the partial to completed, or inserts completed if no partial existed.

### 2d. Formant.tsx — Wire Up

- Pass `responseId` from `autoSave` into `submitResponses` when calling service.
- For local: ensure `useLocalPartialSave` is used when local dest exists, and `markCompleted` on submit calls `completePartialToLocal`.

---

## Phase 3: Admin UI

### 3a. Tabs: Full Submissions | Partial Submissions

**Files**: 
- `forms/simple-form-admin.html` (local)
- `.cursor/skills/formant/templates/responses-dashboard.html` (Cloudflare)
- `.cursor/skills/formant/templates/admin-local.html` (template for local)

- Add tab bar: "Full submissions" | "Partial submissions".
- Default: "Full submissions".
- Each tab loads its own data:
  - Full: `getCompletedFromLocal` / `GET .../api/responses/:formId?status=completed`
  - Partial: `getPartialsFromLocal` / `GET .../api/responses/:formId?status=in_progress`

### 3b. Partial Tab — Email Filter

- Add filter dropdown or toggle: "All" | "With email" | "Without email".
- **Email detection**: From schema, find first field with `type === "email"`. Use its `id` to read `answers[fieldId]`.
- "With email": `answers[emailFieldId]` is non-empty string.
- "Without email": `answers[emailFieldId]` is empty or missing.

### 3c. Partial Tab — Display

- Columns: same as full (from schema), plus "Last activity" (updatedAt) and optionally "Last field" (lastFieldId).
- Sort by last activity descending by default.

---

## Phase 4: Edge Cases

| Scenario | Behavior |
|----------|----------|
| User completes form in one shot, no partial save triggered | Create single `completed` record. No partial. |
| User starts, saves partial, then completes | Update partial to `completed`. One record. |
| User starts, abandons (closes tab) | Partial remains `in_progress`. Shows in Partial tab. |
| User goes back and edits Q2 after reaching Q5 | Partial updates in place. Same record. |
| Multiple tabs | Each tab has own sessionId. Each gets own partial. Correct. |
| Local + Service both configured | Both get partial saves. Service: useAutoSave. Local: useLocalPartialSave. On submit: update both. |

---

## File Summary

| File | Action |
|------|--------|
| `packages/renderer/src/utils/sessionId.ts` | Create |
| `packages/renderer/src/submit/local.ts` | Modify — schema v2, status, sessionId, new functions |
| `packages/renderer/src/hooks/useLocalPartialSave.ts` | Create |
| `packages/renderer/src/hooks/useAutoSave.ts` | Modify — sessionId, ensure single POST then PUTs |
| `packages/renderer/src/submit/handler.ts` | Modify — pass responseId to service, call completePartial for local |
| `packages/renderer/src/submit/service.ts` | Modify — support PUT when responseId provided |
| `packages/renderer/src/Formant.tsx` | Modify — wire useLocalPartialSave, pass responseId to submit |
| `packages/service/src/db/schema.sql` | Modify — add status, session_id, indexes |
| `packages/service/src/db/queries.ts` | Modify — updateResponse, status filter |
| `packages/service/src/routes/responses.ts` | Modify — PUT endpoint, POST accept sessionId |
| `forms/simple-form-admin.html` | Modify — tabs, email filter |
| `.cursor/skills/formant/templates/admin-local.html` | Modify — tabs, email filter |
| `.cursor/skills/formant/templates/responses-dashboard.html` | Modify — tabs, email filter |

---

## Verification

1. **Local mode**: Build form with `--local`, fill partially, close tab. Reopen admin, see partial in Partial tab. Filter by email. Complete form, see only in Full tab.
2. **Service mode**: Deploy to Cloudflare, fill partially, verify PUT requests. Complete, verify single row.
3. **Backfill**: Existing IndexedDB data still loads in Full tab after migration.
4. **Tests**: Unit tests for `getSessionId`, `completePartialToLocal`, `updateResponse`, PUT endpoint.

## Migration for Existing Cloudflare Deployments

If you have an existing D1 database, run the migration before deploying:

```bash
cd packages/service && wrangler d1 execute formant-db --remote --file=src/db/migrations/001_add_status_session.sql
```

---

## Email Field Detection (Shared Utility)

Used by admin UI for filtering partials. Add to `packages/renderer` or inline in admin templates:

```ts
function getEmailFieldId(schema: FormSchema): string | null {
  const field = schema.fields?.find((f) => f.type === "email");
  return field?.id ?? null;
}

function hasEmail(answers: Record<string, unknown>, emailFieldId: string | null): boolean {
  if (!emailFieldId) return false;
  const val = answers[emailFieldId];
  return typeof val === "string" && val.trim().length > 0;
}
```

---

## Open Decisions

1. **Local + Service**: When both destinations exist, do we run both partial save hooks? Yes — each destination is independent.
2. **Session lifetime**: sessionStorage clears when tab closes. Partials from closed tabs remain in DB. Consider "stale" partials (e.g. older than 7 days) — future: optional cleanup.
3. **Email field heuristic**: Use first `type: "email"` field. If form has multiple email fields, we use the first. Document this.
