# Contributing to Formant

We welcome contributions, but we're strict about quality. We want thoughtful, human work — not AI-generated slop.

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
