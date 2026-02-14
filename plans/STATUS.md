# Formant — Build Status

Track which phases are complete. Each agent session should read this first and update it when done.

## Phase Status

| Phase | Description | Status | Notes |
|-------|-------------|--------|-------|
| 1A | Project Scaffolding | **complete** | All packages scaffolded, tsc passes, vitest runs |
| 1B | Core Types, Validation, Engine | **complete** | 138 tests pass, tsc clean |
| 1C | Renderer Hooks & Shared Components | **complete** | 3 hooks + 5 shared components, tsc clean |
| 1D | Question Components | **complete** | 13 components + registry, tsc clean, all FieldTypes mapped |
| 1E-1 | Styles & Submit Handlers | not started | Depends on 1D |
| 1E-2 | Main Component & Auto-Save | not started | Depends on 1E-1 |
| 1F | HTML Builder | not started | Depends on 1E-2 |
| 1G | E2E Tests | not started | Depends on 1F |
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
