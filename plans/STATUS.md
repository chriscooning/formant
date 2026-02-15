# Formant — Build Status

Track which phases are complete. Each agent session should read this first and update it when done.

## Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1A | Project Scaffolding | **complete** | All packages scaffolded, tsc passes, vitest runs |
| 1B | Core Types, Validation, Engine | **complete** | 138 tests pass, tsc clean |
| 1C | Renderer Hooks & Shared Components | **complete** | 3 hooks + 5 shared components, tsc clean |
| 1D | Question Components | **complete** | 13 components + registry, tsc clean, all FieldTypes mapped |
| 1E-1 | Styles & Submit Handlers | **complete** | All 22 CSS sections in styles.ts, 5 submit handlers (handler, sheets, webhook, service, excel+csv), tsc clean |
| 1E-2 | Main Component & Auto-Save | **complete** | Formant component, useAutoSave hook, entry point, 13 tests pass, tsc clean |
| 1F | HTML Builder | **complete** | 12 tests pass, tsc clean, smoke test generates 46KB HTML |
| 1G | E2E Tests | **complete** | 20/20 non-skipped tests pass; 4 submit stubs skipped (Phase 4) |
| 1-Skill | Claude Skill (Initial) | **complete** | SKILL.md + product-feedback example (JSON + 49KB HTML), tsc clean, no regressions |
| 2 | Google Sheets Connector | **complete** | Apps Script + SETUP.md, hardened sheets.ts (field titles, arrays, truncation, booleans), skill updated, 23 submit tests pass, tsc clean |
| 3A | Service Database & Middleware | **complete** | 18 tests pass, tsc clean, D1 schema + queries + CORS + auth middleware + Hono skeleton |
| 3B | Service API Routes & Tests | **complete** | 35 new tests (53 total service), tsc clean, all 6 endpoints, XLSX export, skill deployment docs |
| 4 | Multi-Destination & Webhooks | **complete** | 8 E2E submit tests + 6 webhook unit tests, tsc clean, 28/28 E2E pass, 186 unit tests pass |
| 5A | Local Submit Destination | **complete** | IndexedDB storage, no Excel download, saveToLocal + getAllFromLocal |
| 5B | Admin Panel (Local Mode) | **complete** | admin-local.html template, password gate, CSV/XLSX, verify script |
| 5C | Build Integration (--local) | **complete** | CLI --local, admin password from env, form + admin output |
| 6 | Partial Fills Capture | **complete** | Session-based partials, Full/Partial tabs, email filter, deduplication |
| 7 | Dashboard Analytics | **complete** | Chart (views + submissions), big numbers, 7/14/30 day range, highest dropoff; local admin partial analytics |
| 8A | Shared API layer + DB abstraction | **complete** | DbAdapter interface, D1Adapter, routes use adapter |
| 8B | Vercel adapter + Postgres | **pending** | Depends on 8A |
| 8C | Deploy script + form integration | **pending** | Depends on 8B |
| 8D | Testing parity + documentation | **pending** | Depends on 8C |
| 9 | Connect Google Sheet OAuth | **complete** | Backend routes, admin UI, sheetsStorage, submit handler. Prereqs: GCP OAuth + secrets |

## Execution Order

Sequential (what you must build in order):
```
1A → 1B → 1C → 1D → 1E-1 → 1E-2 → 1F → 1G
```

Parallel opportunities (can start once their dependency is met):
```
3A can start after 1B (parallel with 1C-1F)
2 can start after 1E-2 (parallel with 1F/1G)
1-Skill can start after 1F (parallel with 1G)
3B can start after 3A + 1F
4 can start after 1E-2 + 3B
5A can start after 1E-2
5B can start after 5A
5C can start after 5B
8A can start after 3A + 3B + 7
8B → 8C → 8D (sequential, Vercel backend)
9 can start after 5B + 3B (admin panel + service API)
```

## Issues Log

Record any issues found during implementation that affect other phases.

| Date | Phase | Issue | Resolution |
|------|-------|-------|------------|
| 2026-02-14 | 1A | pnpm needed corepack enable (not pre-installed) | Resolved by running `corepack enable pnpm` |
| 2026-02-14 | 1A | vitest `test.workspace` deprecated in v3, renamed to `test.projects` | Updated vitest.config.ts to use `projects` |
| 2026-02-14 | 1A | e2e playwright.config.ts needed tsconfig.json + typescript devDep (not in plan) | Added both; simplified config to avoid `process.env` references |
| 2026-02-14 | 1A | esbuild/workerd/sharp need build script approval in pnpm 10 | Added `pnpm.onlyBuiltDependencies` to root package.json |
| 2026-02-14 | 1A | No eslint.config.js in project root — `pnpm lint` fails on eslint step | Pre-existing; not blocking. Needs eslint flat config added. |
| 2026-02-14 | 1B | core package had no vitest.config.ts — root projects config caused path resolution error | Added `packages/core/vitest.config.ts` |
| 2026-02-14 | 1F | esbuild 0.27 removed plugin support from `buildSync()` — plan's plugin approach doesn't work | Used `banner` + `external` instead of esbuild plugin to map React/ReactDOM to CDN globals |
| 2026-02-14 | 1F | html-builder tsconfig `rootDir: "./src"` blocked importing `formantStyles` from renderer | Removed `rootDir` from tsconfig (not needed with `noEmit: true`) |
| 2026-02-14 | 1F | html-builder was missing `@types/node` — `node:path`, `node:fs` etc. failed to resolve | Added `@types/node` as devDependency |
| 2026-02-14 | 1F | **React 19 UMD CDN URLs 404.** `template.ts` uses `unpkg.com/react@19/umd/...` but React 19 removed UMD builds entirely. Generated HTML forms load no React, nothing renders. | **Resolved.** Pinned CDN URLs to React 18 UMD in `template.ts`. Removed `CDN_PATCHES` workaround from `global-setup.ts`. Updated `build.test.ts` assertions to match. |
| 2026-02-14 | 1D | **Choice/Rating/Scale/YesNo stale-closure auto-advance bug.** See detailed description below. | **Resolved.** Added `onNextRef` pattern (useRef for latest `onNext`) in all four components. Fixed `useCallback`/dep arrays for keyboard handler in `Choice.tsx`. |
| 2026-02-14 | 1B | **yes_no validator rejected booleans.** Validator expected string labels ("Yes"/"No") but YesNo component stores booleans. Blocked Y/N keyboard test. | **Resolved.** Updated `validate.ts` to accept `true`/`false` as valid yes_no values alongside string labels. |
| 2026-02-14 | 1G | **Branching test selector ambiguity.** `selectChoice("Unsatisfied")` matched both "Unsatisfied" and "Very unsatisfied" due to substring `hasText` matching. | **Resolved.** Changed to exact regex match on `.ff-choice-label` text in `branching.spec.ts`. |
| 2026-02-14 | 1F | **ESM `__dirname` not defined in cli.ts.** `packages/html-builder/src/cli.ts` used `__dirname` which is undefined in ES module scope. Deploy case failed. | **Resolved.** Added `fileURLToPath` import and `__filename`/`__dirname` polyfill at top of file. |
| 2026-02-14 | Deploy | **Vercel CLI v50+ non-TTY deploy fails silently.** `scripts/deploy-vercel.sh` returns JSON `action_required` blob instead of deploying when run from non-interactive environments. | **Resolved.** Replaced with pty-based deploy: removed non-TTY guard, use `script` to fake TTY for scope, lowercase deploy dir (`formant-form`), VERCEL_ORG_ID/VERCEL_SCOPE for CI. |

### Resolved: __dirname in ESM cli.ts

`packages/html-builder/src/cli.ts` used `__dirname` which is undefined in ES module scope. The `deploy` case relied on `__dirname` to resolve the path to `scripts/deploy.sh`. **Fixed** by adding `fileURLToPath` polyfill at the top of the file:

```ts
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### Resolved: Vercel CLI v50+ non-TTY deploy

`scripts/deploy-vercel.sh` fails silently when run in non-interactive environments (CI, subprocess, Cursor agent shell) due to Vercel CLI v50+ requiring interactive scope selection. Instead of deploying, it returns a JSON `"action_required"` blob. **Fixed** by removing the non-TTY guard and implementing a pty-based deploy: when the first deploy fails with `missing_scope`, parse the scope slug from the JSON and retry inside `script -q -c "..."` so the CLI gets a pseudo-TTY and accepts `--scope`. Deploy dir is now `formant-form` (lowercase) to avoid project name rejection. For CI, set `VERCEL_ORG_ID` or `VERCEL_SCOPE` to skip scope detection. Requires `script` (bsdutils) for non-interactive deploys.

### Resolved: Stale Closure Auto-Advance (Phase 1D) + yes_no Validator + Branching Selector

All three issues resolved. **20/20 non-skipped E2E tests pass** (4 submit stubs skipped for Phase 4).

**Fixes applied:**
1. **Stale closure** (Choice, Rating, Scale, YesNo): Added `onNextRef = useRef(onNext)` pattern — ref updated every render, `ref.current` read inside setTimeout. Choice.tsx also got `useCallback` for `handleSelect` and fixed keyboard effect dep array.
2. **yes_no validator** (`core/validate.ts`): Updated to accept `true`/`false` booleans in addition to string labels. The YesNo component stores booleans but the validator only accepted strings.
3. **CDN URLs** (`html-builder/template.ts`): Pinned to React 18 UMD. Removed `CDN_PATCHES` workaround from `e2e/global-setup.ts`.
4. **Branching selector** (`branching.spec.ts`): Changed `hasText` to exact regex match on `.ff-choice-label` to avoid "Unsatisfied" matching "Very unsatisfied".
