# Typeform-Like Workspace — Hosted Admin Experience

**Date:** 2026-07-04
**Context:** The respondent experience is already Typeform-like (one question at a time, keyboard nav, dark/light). The admin side is not: form creation only happens via CLI/AI-in-editor, and the hosted UI (`responses-dashboard.html`) is a per-form, read-only page. This plan closes that gap: a hosted workspace where a user can sign in with their API key, see all their forms, create and edit forms in the browser with a live preview, publish, and view results — a Typeform-like experience across the board.

**Design thesis:** Keep Formant's ethos. The workspace is a single self-contained HTML page (like the forms themselves), served by the existing Worker/Vercel service. AI-generated schemas stay the primary creation path — the workspace makes them viewable, editable, and publishable in the browser; it does not replace the editor flow.

---

## Architectural unlock

`buildFormHTML` (packages/html-builder/src/build.ts) bundles the renderer into an IIFE that is **schema-independent**: the schema is injected separately as `window.__FORMANT_SCHEMA__`, and the entry code never varies. Therefore:

- The renderer runtime can be **prebuilt once** as a static artifact (`formant-runtime.js`).
- "Building" a form = injecting schema JSON into a static HTML shell — **no esbuild needed at runtime**.
- The Worker can assemble form HTML server-side, and the workspace can render a **live preview** in the browser by loading the same runtime with an in-memory schema.

This removes the only technical reason form creation was CLI-bound.

## Auth model

Reuse the existing API-key scheme (Bearer token, SHA-256 hash stored per form as `api_key_hash`). A "workspace" = all forms sharing one API key hash. No user accounts, no sessions: the workspace page asks for the API key once and keeps it in `localStorage`. Matches `requireAuth()` in packages/service/src/middleware/auth.ts.

---

## Phase Summary

| Phase  | Description                                              | Status                                                                                                                |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **W1** | API: list / get / update forms                           | **complete**                                                                                                          |
| **W2** | Prebuilt renderer runtime artifact + form shell template | **complete**                                                                                                          |
| **W3** | Workspace shell: login, forms list (served at `/admin`)  | **complete**                                                                                                          |
| **W4** | Create & edit: schema editor + live preview              | **complete**                                                                                                          |
| **W5** | Publish & share: save, live URL, copy link               | **complete** (embed snippet deferred to W7 polish)                                                                    |
| **W6** | Results tab: fold responses-dashboard into the workspace | **complete**                                                                                                          |
| **W7** | Vercel parity + polish (dark/light, keyboard nav)        | **complete** (Vercel serves /admin via the shared app; standalone responses-dashboard.html kept for existing deploys) |

MVP path: **W1 → W2 → W3 → W5** (list + create-from-JSON/template + publish). W4's visual editor and W6 can follow.

---

## Phase W1 — API: list / get / update forms

The endpoints any workspace UI needs. All auth-required, owner-scoped via `api_key_hash`.

- `GET /api/forms` — list forms for the caller's key hash. Returns id, title, created/updated, view_count, submit_count (no html/schema — keep it light).
- `GET /api/forms/:id` — full form: schema JSON + metadata (still no html; the form page itself is `/f/:id`).
- `PUT /api/forms/:id` — update `html`, `schema`, or both; refreshes `title` from schema; 403 if not owner (same pattern as DELETE).

**Files:**

- `packages/service/src/db/interface.ts` — add `listFormsByApiKeyHash`, `updateForm` to `DbAdapter`.
- `packages/service/src/db/queries.ts` + `d1-adapter.ts` — D1 implementations.
- `packages/service/src/routes/forms.ts` — the three routes.
- `packages/service-vercel/src/db/postgres.ts` — Postgres implementations.
- Tests: `packages/service/__tests__/forms.test.ts` pattern; update `service-vercel/__tests__/memory-adapter.ts`.

**Acceptance:** list returns only caller's forms; get/put enforce ownership (404/403); PUT updates schema_json + title + updated_at; all existing tests still pass.

## Phase W2 — Prebuilt renderer runtime

Split `buildFormHTML` into (a) a reusable runtime bundle and (b) schema injection.

- `pnpm build:runtime` → `packages/html-builder/dist/formant-runtime.js` (the exact IIFE buildFormHTML produces today) + `form-shell.html` (template with `{{SCHEMA_JSON}}` slot).
- `buildFormHTML` keeps working as-is (CLI path unchanged); new export `assembleFormHTML(schema, runtimeJs)` does pure string assembly — usable in Workers and browsers.
- Deploy scripts upload the runtime artifact alongside the worker (as a static asset or inlined constant module).

**Acceptance:** `assembleFormHTML(schema)` output is functionally identical to `buildFormHTML(schema)`; e2e suite passes against assembled output.

## Phase W3 — Workspace shell

Single self-contained `workspace.html` template (lives with the other templates in `.cursor/skills/formant/templates/`, same vanilla-JS style as responses-dashboard.html), served by the worker at `GET /admin`.

- API-key login screen → key stored in localStorage, validated by hitting `GET /api/forms`.
- Forms list: title, response count, views, created date; click through to detail. Empty state points at creation flow.
- Served route: `packages/service/src/routes/admin.ts` returning the template with `{{WORKER_URL}}` substituted (same placeholder pattern the dashboard uses).

## Phase W4 — Create & edit with live preview

Typeform-like editor, scoped deliberately below "full drag-and-drop builder":

- **Create paths:** template gallery (bake-sale, NPS, feedback schemas), paste AI-generated JSON, or duplicate an existing form.
- **Edit:** left panel = field list (add/remove/reorder, edit title/type/required/options via forms, not raw JSON — with a raw JSON escape hatch); right panel = live preview iframe running the W2 runtime with the in-memory schema, updating on change.
- Validation via `@formant/core`'s `validateSchema` compiled into the workspace bundle (or a `POST /api/validate` endpoint if bundle size is a concern).

## Phase W5 — Publish & share

- Save = `POST /api/forms` (new) or `PUT /api/forms/:id` (existing), with HTML assembled worker-side from the stored runtime (W2) so the browser never uploads HTML.
- After publish: live URL (`/f/:id`), copy-link button, iframe embed snippet, QR code (tiny inline generator).
- Draft vs published: defer; v1 saves are live immediately (matches current deploy behavior).

## Phase W6 — Results inside the workspace

Fold the existing `responses-dashboard.html` capabilities into a "Results" tab on the form detail page: responses table, analytics (7/14/30d), CSV/XLSX export, Connect Google Sheet. The dashboard template already talks to the same API — this is mostly a refactor to share markup/JS between the standalone dashboard and the workspace tab. Keep the standalone per-form dashboard working (deploy scripts reference it).

## Phase W7 — Vercel parity + polish

- Serve `/admin` from `packages/service-vercel` too (same template, Postgres adapter).
- Dark/light mode + keyboard navigation in the workspace, reusing the renderer's visual tokens so admin and respondent sides feel like one product.
- Docs: `docs/workspace.md`, README section.

---

## Non-goals (v1)

- User accounts / multi-user workspaces / roles — API key **is** the identity.
- Drag-and-drop canvas editor, logic-jump visual editor — schema JSON (AI-authored) remains the source of truth; the editor covers common edits.
- Billing, versioning, response editing.

## Risks / notes

- **Worker bundle size:** runtime artifact is ~60 KB minified next to the worker — fine for Cloudflare (1 MB limit) but keep the runtime external to the worker script if it grows (KV/static assets).
- **CORS:** already global-permissive in the service; workspace served same-origin anyway.
- **CDN dependency:** forms load React from unpkg. Restricted networks (and this dev container) block it. Worth folding the existing `--inline` mode into the runtime artifact story in W2 so hosted forms can opt into fully self-contained output.
