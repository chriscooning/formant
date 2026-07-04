# Formant — Build Status

Track which phases are complete. Each agent session should read this first and update it when done.

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1A | Project Scaffolding | **complete** |
| 1B | Core Types, Validation, Engine | **complete** |
| 1C | Renderer Hooks & Shared Components | **complete** |
| 1D | Question Components | **complete** |
| 1E-1 | Styles & Submit Handlers | **complete** |
| 1E-2 | Main Component & Auto-Save | **complete** |
| 1F | HTML Builder | **complete** |
| 1G | E2E Tests | **complete** |
| 1-Skill | Claude Skill (Initial) | **complete** |
| 2 | Google Sheets Connector | **complete** |
| 3A | Service Database & Middleware | **complete** |
| 3B | Service API Routes & Tests | **complete** |
| 4 | Multi-Destination & Webhooks | **complete** |
| 5A | Local Submit Destination | **complete** |
| 5B | Admin Panel (Local Mode) | **complete** |
| 5C | Build Integration (--local) | **complete** |
| 6 | Partial Fills Capture | **complete** |
| 7 | Dashboard Analytics | **complete** |
| 8A | Shared API layer + DB abstraction | **complete** |
| 8B | Vercel adapter + Postgres | **complete** |
| 8C | Deploy script + form integration | **complete** |
| 8D | Testing parity + documentation | **complete** |
| 9 | Connect Google Sheet OAuth | **complete** |
| 10 | Seamless AI Deploy | **complete** |
| 11 | Connect Sheets Admin UI | **complete** |
| 12 | Seamless Deploy Experience | **complete** |

**Next up:** Typeform-like workspace (hosted admin: list/create/edit/publish forms in the browser) — see `plans/typeform-workspace.md`. Phase 5 (deploy dashboard) from `plans/connect-sheets-admin-ui.md` is folded into it (W3/W6).

**Future:** Cloudflare isolated DB mode — `plans/cloudflare-isolated-db-mode.md`. Agent use — `plans/agent-use-improvements.md`.

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
| 2026-02-14 | 1A | pnpm corepack, vitest projects, esbuild approval | Resolved |
| 2026-02-14 | 1F | React 19 UMD removed; esbuild plugin API changed | Pinned React 18 CDN; use banner+external |
| 2026-02-14 | 1D | Stale-closure auto-advance bug (Choice, Rating, Scale, YesNo) | onNextRef pattern |
| 2026-02-14 | 1B | yes_no validator rejected booleans | Accept true/false in validate.ts |
| 2026-02-14 | 1F | ESM __dirname undefined in cli.ts | fileURLToPath polyfill |
| 2026-02-14 | Deploy | Vercel CLI v50+ non-TTY fails silently | pty-based deploy with `script` |

**Note:** `pnpm lint` may fail (no eslint flat config). Not blocking. See archived plans for detailed fix notes.
