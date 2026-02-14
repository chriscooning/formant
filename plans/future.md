# Future Polish

Ideas for later — not blocking anything, just worth doing when the time is right.

## npm create formant

Publish a `create-formant` (or similar) package so users can scaffold a new project without cloning the monorepo:

```bash
npm create formant my-project
cd my-project
cursor .
```

The scaffolder would:
1. Create a directory with `package.json`, the Cursor skill/rules files, and an example schema
2. Install the formant CLI as a dependency
3. Print "Open in Cursor and describe what you want"

**Blocker:** `formant` is taken on npm. Options: `create-formant-app`, `@formant-dev/create`, or wait and see if the name frees up.

**When to do this:** Once strangers are using the repo and the clone-the-whole-monorepo step feels like unnecessary friction.

## Other ideas

- [ ] Web playground — paste a schema, see the form live (no install needed)
- [ ] `formant publish` — one command to push updates to an already-deployed form
- [ ] Template gallery — pre-built schemas for common use cases (NPS, contact form, event RSVP, etc.)
