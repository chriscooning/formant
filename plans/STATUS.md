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
| 1G | E2E Tests | **in progress** | 14/20 tests pass; 6 blocked by renderer stale-closure bug (see Issues Log) |
| 1-Skill | Claude Skill (Initial) | not started | Depends on 1F |
| 2 | Google Sheets Connector | not started | Depends on 1E-2 |
| 3A | Service Database & Middleware | not started | Depends on 1B |
| 3B | Service API Routes & Tests | not started | Depends on 3A + 1F |
| 4 | Multi-Destination & Webhooks | not started | Depends on 1E-2 + 3B |

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
| 2026-02-14 | 1F | **React 19 UMD CDN URLs 404.** `template.ts` uses `unpkg.com/react@19/umd/...` but React 19 removed UMD builds entirely. Generated HTML forms load no React, nothing renders. | E2E global-setup.ts patches URLs to React 18 UMD as workaround. **Needs permanent fix in `packages/html-builder/src/template.ts`** — pin to React 18, use esm.sh+importmap, or switch to inline bundled React. |
| 2026-02-14 | 1D | **Choice/Rating/Scale/YesNo stale-closure auto-advance bug.** See detailed description below. | **Needs fix in renderer.** Blocks 6 E2E tests. |

### Detailed Bug: Stale Closure Auto-Advance (Phase 1D)

**Affected files:**
- `packages/renderer/src/questions/Choice.tsx` (confirmed)
- Likely also `Rating.tsx`, `Scale.tsx`, `YesNo.tsx` (same pattern)

**Symptom:** When a user clicks/selects an option on a required choice field, the form does NOT advance to the next question. Instead it silently fails or shows a validation error ("X is required") even though the option was visually selected.

**Root cause — stale closure in setTimeout:**

In `Choice.tsx`, the `handleSelect` function (line 30-44) does two things:
1. `onChange(option)` — tells the parent `Formant` component to update state (`setAnswer`)
2. `setTimeout(() => { onNext() }, 300)` — fires auto-advance after a delay

The problem is that `onNext` inside the timeout closure is captured from the **current render**, BEFORE `onChange` triggers a re-render. The call chain is:

```
onNext (captured at render N)
  → goNext (depends on state from render N)
    → state.answers[fieldId] === undefined  ← still empty!
      → validateField(field, undefined) → "X is required" → return false
```

After `onChange`, React re-renders (render N+1) with the answer in state, creating a new `goNext` that would pass validation. But the timeout already captured the old `onNext` from render N.

**Why it only affects required fields:** For optional fields, `validateField(field, undefined)` returns `null` (no error), so the stale `goNext` still advances. For required fields, it returns an error string, so `goNext` aborts.

**Second stale closure (keyboard handler):** The `useEffect` at line 53 registers a `keydown` handler that calls `handleSelect`. Its dependency array is `[choiceField.options, choiceField.allowOther]` — it does NOT include `handleSelect`, `onChange`, or `onNext`. Since options don't change after mount, the keyboard handler permanently captures the `handleSelect` from the first render, which in turn captures the first render's `onNext`.

**Suggested fixes (pick one):**
1. Use a `useRef` to hold the latest `onNext` and read `ref.current` inside the timeout
2. Use `useCallback` with proper deps for `handleSelect` and include it in the keyboard handler's dep array
3. Use `flushSync` around `onChange` to force synchronous state commit before the timeout

**E2E test workaround attempted:** Click/key-select the option, then `waitForTimeout(200)` + `page.keyboard.press("Enter")` to invoke the global keyboard handler (which IS properly re-registered). Works for some components but still fails for branching tests and keyboard nav tests for rating/scale/yes-no.

**Tests blocked (6 of 20 non-skipped):**
- `branching.spec.ts` — all 3 tests (positive branch, negative branch, back navigation)
- `keyboard.spec.ts` — Y/N keys, number keys for rating, number keys for scale

**Tests passing (14 of 20 non-skipped):**
- `formant.spec.ts` — 2/2 (happy path, skip optional)
- `keyboard.spec.ts` — 3/6 (Enter advances, letter keys select choice, Backspace goes back)
- `validation.spec.ts` — 5/5 (all validation error state tests)
- `theme.spec.ts` — 4/4 (dark/light mode, toggle, readable text)

**Tests skipped (4):**
- `submit.spec.ts` — 4 stubs (deferred to Phase 4)
