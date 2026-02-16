# Future Polish

Ideas for later — not blocking anything, just worth doing when the time is right.

## Skills Directory / Public Appeal

- [ ] **GitHub topics** — Add `claude-skill`, `claude-code`, `anthropic`, `form-builder` (gear icon next to About)
- [ ] **Demo URL in About** — Add live form URL to GitHub repo About section
- [ ] **SKILL.md version** — Add `version: "1.0.0"` to root SKILL.md frontmatter for directory compatibility
- [ ] **README GIF** — 10–15 sec form flow: welcome → 2–3 questions → ending, show dark/light mode
- [ ] **"Try it" demo link** — Deploy bake-sale form, add URL to README
- [ ] **Example schemas** — Add 1–2 more (NPS, feedback) alongside bake-sale

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

## Skill & Developer / IT Admin Appeal

Ideas to make Formant a skill most developers and IT admins would want in their Cursor/Claude toolbox.

### Additions

- [ ] **Template library** — Pre-built schemas: "Use the NPS template", "Employee feedback form", "IT ticket request", "Equipment checkout", "Incident report", "Access request", "Contact form"
- [ ] **IT admin use cases** — Call out in skill: helpdesk/ticket forms, equipment checkout, access requests, incident reporting, internal feedback
- [ ] **Integration examples** — Zapier/Make webhook examples, Slack notification on submit, Airtable destination, email-to-list, Notion sync
- [x] **Pre-fill via URL params** — `?name=John&email=john@example.com` for links from emails/internal tools (implemented)
- [ ] **Embed codes** — iframe snippet, React component export, "Copy embed code" for existing sites
- [ ] **Security** — Password-protected forms, optional CAPTCHA, GDPR-friendly defaults
- [ ] **Simpler happy path** — "80% use case" in skill: Excel or Sheets or webhook, Vercel or Cloudflare, 3–5 questions

### Simplifications

- [ ] **Response destinations** — Group by "no backend" vs "backend"; default to Excel + webhook; move Apps Script Sheets to "advanced"
- [ ] **Deploy matrix** — Shorter "recommended" path; decision tree: "Need server-side storage? → Cloudflare or Vercel Postgres"
- [ ] **Schema reference** — Minimal "start here" schema; link to full reference for power users

### Positioning

- [ ] **Skill description** — "Build production-ready forms in seconds: feedback, surveys, tickets, onboarding. Single HTML file, no backend required. Deploy to Vercel or Cloudflare. Excel, Google Sheets, webhooks."
- [ ] **Keywords** — form builder, survey, feedback form, IT ticket, internal tool, Typeform alternative, no-code form, self-hosted form
- [ ] **Quick-win prompts** — "Create an NPS survey", "IT equipment checkout form", "Customer feedback form with 5-star rating", "Contact form that posts to a webhook"

---

## Other ideas

- [ ] **Cloudflare isolated DB mode** — `--target cloudflare --isolated` spins up a new D1 + Worker per form. Full isolation, clean deletion. See `plans/cloudflare-isolated-db-mode.md`. D1 free tier: 5 DBs.
- [ ] **Agent use improvements** — Input ids, aria-labels, schema on DOM, direct API docs. See `plans/agent-use-improvements.md`.
- [ ] **Share feedback with Formant** — Dedicated feedback form (README or docs) for users to share experience, feature requests, bugs. Transparent, opt-in.
- [ ] Web playground — paste a schema, see the form live (no install needed)
- [ ] `formant publish` — one command to push updates to an already-deployed form
- [ ] Template gallery — pre-built schemas for common use cases (NPS, contact form, event RSVP, etc.)
