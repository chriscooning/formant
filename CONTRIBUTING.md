# Contributing to Formant

We welcome contributions, but we're strict about quality. We want thoughtful, human work — not AI-generated slop.

## Tech Stack

- **TypeScript** — strict mode across all packages
- **React 18** — functional components for form rendering
- **esbuild** — bundles forms into single HTML files
- **Hono** — lightweight API framework (Cloudflare Workers)
- **Cloudflare D1** — SQLite database for hosted response collection (Cloudflare)
- **Vercel Postgres** — Postgres for hosted response collection (Vercel + --with-backend)
- **Vitest** + **Playwright** — unit and E2E testing
- **pnpm workspaces** — monorepo package management

## Project Structure

```
formant/
├── SKILL.md           # Root skill (Claude Code, skills directories)
├── packages/
│   ├── core/          # Types, validation, form engine (no React)
│   ├── renderer/      # React components for rendering forms
│   ├── html-builder/  # Bundles schema → single HTML file + CLI
│   ├── service/       # Cloudflare Workers API (Hono + D1)
│   └── service-vercel/  # Vercel Edge API (Hono + Postgres) — same interface as service
├── apps/
│   └── e2e/           # Playwright end-to-end tests
├── forms/             # Built forms (JSON schemas tracked, HTML gitignored)
├── scripts/           # Deploy scripts and Google Sheets connector
└── .cursor/
    ├── rules/         # Agent conventions (auto-applied)
    └── skills/        # Cursor skill for form generation
```

## Before You Start

1. **Read the codebase** — Understand what you're changing. Don't blindly apply patterns from other projects.
2. **Check plans** — See `plans/STATUS.md` and `plans/` for context. If you're implementing a phase, follow the plan.
3. **One thing at a time** — Small, focused PRs. Don't bundle unrelated changes.

## Code Standards

Follow the conventions in [.cursor/rules/formant.mdc](.cursor/rules/formant.mdc):

- TypeScript strict mode, no `any`
- All colors via CSS custom properties `var(--ff-*)`
- Immutable state — return new objects, never mutate
- Functional React components, named exports
- Tests colocated in `__tests__/` within each package

## Verification (run before opening a PR)

```bash
pnpm -r exec tsc --noEmit
pnpm test
pnpm lint
```

If you changed core, run the full test suite to catch regressions.

## What We Don't Want

- **AI slop** — Generic, templated code. Verbose comments that restate the obvious. Over-engineered abstractions.
- **Scope creep** — Fixing unrelated issues, "while I was here" changes.
- **Blind refactors** — "Improving" code without understanding why it exists.
- **Missing tests** — Every phase plan has test requirements. Don't skip them.

## What We Do Want

- **Clear intent** — Code that does one thing well. Comments that explain *why*, not *what*.
- **Minimal changes** — The smallest diff that achieves the goal.
- **Tests that matter** — Tests that would catch real bugs, not coverage theater.

## PR Expectations

- Descriptive title and summary
- Link to the plan or issue if applicable
- Verification checklist passed
- No force-pushes after review starts

## Questions?

Open a discussion or issue. We'd rather clarify upfront than reject a PR.
