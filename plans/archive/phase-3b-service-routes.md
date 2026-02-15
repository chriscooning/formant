# Phase 3B — Service API Routes & Tests

## Goal

Implement all Hono API routes for the Formant hosting service: form CRUD, response collection (including auto-save/progressive capture), Excel export, and form serving. Full test coverage with miniflare.

## Prerequisites

- Phase 3A complete (DB schema, middleware, query helpers, Hono skeleton)
- Phase 1F complete (HTML builder — needed for form creation flow verification)
- `@formant/core` types importable

## Dependency Graph Position

```
Phase 3A ──► ► Phase 3B ◄ ──► Phase 4 (multi-destination)
Phase 1F ──►
```

---

## Implementation Spec

### API Routes Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/forms` | Bearer token | Create/host a form |
| GET | `/f/:id` | Public | Serve form HTML |
| POST | `/api/responses/:formId` | Public | Create a response (initial or complete) |
| PUT | `/api/responses/:formId/:responseId` | Public | Update a response (auto-save) |
| GET | `/api/responses/:formId` | Bearer token | List responses |
| GET | `/api/responses/:formId/xlsx` | Bearer token | Export responses as Excel |
| DELETE | `/api/forms/:id` | Bearer token | Delete a form + responses |

### 1. Forms Routes (`packages/service/src/routes/forms.ts`)

```typescript
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { insertForm, getFormById, getFormHtml, incrementViewCount, deleteForm } from "../db/queries";
import { generateFormId } from "../utils/id";
import { validateSchema } from "@formant/core";
```

**POST `/api/forms`** — Create a form

```
Auth: Required (Bearer token)
Body: {
  html: string,         // The complete HTML string
  schema: FormSchema     // The schema JSON (stored for inspection)
}

Handler:
1. Apply authMiddleware
2. Parse and validate request body
3. Validate schema with validateSchema() — return 400 if invalid
4. Generate form ID (nanoid 12 chars)
5. Hash the API key (from auth middleware context)
6. Insert into forms table: id, title (from schema), html, schema_json, api_key_hash
7. Return 201: { id, url: "/f/{id}", created_at }
```

**GET `/f/:id`** — Serve form HTML

```
Auth: None (public)

Handler:
1. Get form HTML by ID
2. If not found: return 404 HTML page
3. Increment view_count (fire-and-forget, don't await)
4. Return HTML with Content-Type: text/html
5. Cache: Cache-Control: public, max-age=300, stale-while-revalidate=600
```

**DELETE `/api/forms/:id`** — Delete a form

```
Auth: Required (Bearer token)

Handler:
1. Apply authMiddleware
2. Get form by ID — 404 if not found
3. Verify API key hash matches form's api_key_hash — 403 if mismatch
4. Delete form (CASCADE deletes responses)
5. Return 200: { deleted: true }
```

### 2. Response Routes (`packages/service/src/routes/responses.ts`)

**POST `/api/responses/:formId`** — Create a new response

```
Auth: None (public — forms submit from any origin)

Body: FormResponse JSON {
  formId: string,
  status: "in_progress" | "completed",
  answers: Record<string, unknown>,
  metadata?: { ... }
}

Handler:
1. Verify form exists — 404 if not
2. Generate response ID (nanoid 16 chars)
3. Insert into responses table
4. If status === "completed": increment form's submit_count
5. Return 201: { id, submitted_at }

Note: This endpoint serves BOTH initial creation (for auto-save)
and one-shot submission (for non-auto-save forms).
```

**PUT `/api/responses/:formId/:responseId`** — Update a response (auto-save)

```
Auth: None (public — auto-save from form)

Body: {
  status?: "in_progress" | "completed",
  answers?: Record<string, unknown>,
  metadata?: { ... }
}

Handler:
1. Verify form exists — 404 if not
2. Verify response exists and belongs to this form — 404 if not
3. Update the response (only provided fields)
4. Set updated_at to now
5. If status changed to "completed": increment form's submit_count
6. Return 200: { id, updated_at }

Important: If the response is already "completed", reject updates (409 Conflict).
Prevents modification after submission.
```

**GET `/api/responses/:formId`** — List responses

```
Auth: Required (Bearer token — must match form's api_key_hash)

Query params:
  - limit: number (default 100, max 1000)
  - offset: number (default 0)
  - since: ISO date string (filter submitted_at >= since)
  - status: "in_progress" | "completed" | "all" (default "all")

Handler:
1. Apply authMiddleware
2. Get form — 404 if not found
3. Verify API key hash matches — 403 if mismatch
4. Query responses with filters
5. Parse answers_json and metadata_json for each
6. Return 200: { responses: FormResponse[], total: number, formId, formTitle }
```

**GET `/api/responses/:formId/xlsx`** — Export as Excel

```
Auth: Required (Bearer token)

Handler:
1. Apply authMiddleware
2. Get form — 404 if not found, verify auth
3. Get schema from form's schema_json (for field titles)
4. Get ALL responses (no pagination)
5. Generate Excel workbook:
   - Sheet 1 "Responses": field titles as headers, one row per response
     - Include Submitted At, Duration, Status columns
     - Completed responses first, then in_progress
   - Sheet 2 "Summary":
     - Total responses, completed count, in_progress count
     - Date range (earliest to latest)
     - Average duration
6. Return binary xlsx with headers:
   - Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   - Content-Disposition: attachment; filename="{formTitle}-responses.xlsx"
```

### 3. Excel Generation (`packages/service/src/utils/xlsx.ts`)

Server-side Excel generation for the export endpoint. Use a lightweight library that works in Workers (e.g., `xlsx` or a simpler alternative that doesn't require Node.js APIs).

**Option:** If SheetJS doesn't work in Workers (it sometimes needs Node APIs), use a simpler approach: generate a CSV for MVP and add proper XLSX later.

```typescript
export function generateXlsx(
  schema: FormSchema,
  responses: ResponseRecord[]
): ArrayBuffer
```

### 4. Update Service Submit Handler in Renderer

Update `packages/renderer/src/submit/service.ts` to support both creation and update:

```typescript
export async function submitToService(
  formId: string,
  endpoint: string,
  response: FormResponse,
  responseId?: string  // If provided, update existing (auto-save)
): Promise<{ id: string }> {
  const url = responseId
    ? `${endpoint}/api/responses/${formId}/${responseId}`
    : `${endpoint}/api/responses/${formId}`;
  
  const method = responseId ? "PUT" : "POST";
  
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  });
  
  if (!res.ok) {
    throw new Error(`Service responded with ${res.status}`);
  }
  
  return res.json();
}
```

### 5. Update Skill for Deployment

Add to `skill/SKILL.md`:

```markdown
## Hosting & Deployment

After generating a form, you can offer:
"Want me to deploy this? I'll give you a live URL."

Deployment requires an API key (any string — recommend UUID v4).

The form will be live at: formant.dev/f/{id}
(or whatever the configured domain is)

Deployed forms automatically collect responses (tagged as service destination).
The form creator can retrieve responses using their API key.

Example config with service destination:
\`\`\`json
{
  "submit": {
    "destinations": [
      { "type": "service", "formId": "WILL_BE_SET", "endpoint": "https://formant.dev" },
      { "type": "excel" }
    ]
  }
}
\`\`\`
```

---

## Tests

### `packages/service/__tests__/forms.test.ts`

Using `@cloudflare/vitest-pool-workers` with miniflare D1 bindings:

```
Setup: Run schema.sql to create tables before each test.

test: "POST /api/forms — creates form and returns ID"
  - POST with valid HTML + schema + Bearer token
  - Verify 201 response with id and url
  - GET the form HTML — verify it matches

test: "POST /api/forms — rejects without auth"
  - POST without Authorization header
  - Verify 401

test: "GET /f/:id — serves form HTML"
  - Create a form
  - GET /f/{id}
  - Verify Content-Type: text/html
  - Verify body is the form HTML

test: "GET /f/:id — 404 for nonexistent"
  - GET /f/nonexistent
  - Verify 404

test: "GET /f/:id — increments view count"
  - Create a form, GET it twice
  - Verify view_count is 2

test: "DELETE /api/forms/:id — deletes form and responses"
  - Create form, submit a response
  - DELETE with correct API key
  - GET form → 404
  - GET responses → 404 or empty

test: "DELETE /api/forms/:id — rejects wrong API key"
  - Create form with key A
  - DELETE with key B → 403
```

### `packages/service/__tests__/responses.test.ts`

```
test: "POST /api/responses/:formId — creates response"
  - Create a form
  - POST response with status "completed"
  - Verify 201 with id

test: "POST /api/responses/:formId — 404 for nonexistent form"
  - POST to nonexistent form ID
  - Verify 404

test: "PUT /api/responses/:formId/:responseId — updates response (auto-save)"
  - Create form, create response with status "in_progress"
  - PUT with updated answers
  - GET responses — verify answers are updated

test: "PUT /api/responses/:formId/:responseId — rejects update to completed response"
  - Create form, create response with status "completed"
  - PUT with new answers
  - Verify 409 Conflict

test: "PUT /api/responses/:formId/:responseId — complete a response"
  - Create form, create response with status "in_progress"
  - PUT with status "completed"
  - Verify submit_count incremented on form

test: "GET /api/responses/:formId — lists responses with auth"
  - Create form, submit 3 responses
  - GET with correct API key
  - Verify returns array of 3

test: "GET /api/responses/:formId — rejects without auth"
  - GET without Authorization
  - Verify 401

test: "GET /api/responses/:formId — filters by status"
  - Create 2 completed + 1 in_progress responses
  - GET with status=completed → 2 results
  - GET with status=in_progress → 1 result

test: "GET /api/responses/:formId/xlsx — returns Excel file"
  - Create form, submit responses
  - GET xlsx with auth
  - Verify Content-Type is xlsx mime type
  - Verify Content-Disposition has filename

test: "CORS — null origin allowed"
  - POST response with Origin: null header
  - Verify Access-Control-Allow-Origin in response

test: "CORS — preflight OPTIONS"
  - Send OPTIONS to /api/responses/:formId
  - Verify 204 with correct CORS headers
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/service/src/routes/forms.ts` | Replace placeholder with routes |
| `packages/service/src/routes/responses.ts` | Replace placeholder with routes |
| `packages/service/src/routes/export.ts` | Replace placeholder with xlsx export route |
| `packages/service/src/utils/xlsx.ts` | Replace placeholder with xlsx generation |
| `packages/service/src/index.ts` | Add route registrations to Hono app |
| `packages/service/__tests__/forms.test.ts` | Replace placeholder with tests |
| `packages/service/__tests__/responses.test.ts` | Replace placeholder with tests |
| `packages/renderer/src/submit/service.ts` | Update to support PUT for auto-save |
| `skill/SKILL.md` | Add deployment section |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/service exec tsc --noEmit

# All service tests pass
pnpm --filter @formant/service test

# Local dev server starts
pnpm --filter @formant/service dev
# (wrangler dev — requires wrangler login or local mode)
```

- All 6+ API endpoints work correctly
- Auto-save flow: POST to create → PUT to update → PUT to complete
- Completed responses cannot be modified (409)
- CORS handles null origin and preflight
- Auth middleware protects management endpoints
- Public endpoints (form serving, response submission) require no auth
- Export endpoint generates downloadable file
- All tests pass using miniflare D1 bindings
- `wrangler deploy` succeeds when configured with a real D1 database

## Open Questions

None — all decisions resolved for this segment.
