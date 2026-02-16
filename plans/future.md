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

## Skill & Developer / IT Admin Appeal

Ideas to make Formant a skill most developers and IT admins would want in their Cursor/Claude toolbox.

### Additions

- [ ] **Template library** — Pre-built schemas: "Use the NPS template", "Employee feedback form", "IT ticket request", "Equipment checkout", "Incident report", "Access request", "Contact form"
- [ ] **IT admin use cases** — Call out in skill: helpdesk/ticket forms, equipment checkout, access requests, incident reporting, internal feedback
- [ ] **Integration examples** — Zapier/Make webhook examples, Slack notification on submit, Airtable destination, email-to-list, Notion sync
- [ ] **Pre-fill via URL params** — `?name=John&email=john@example.com` for links from emails/internal tools
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

- [ ] **Share feedback with Formant** — Dedicated feedback form (README or docs) for users to share experience, feature requests, bugs. Transparent, opt-in.
- [ ] Web playground — paste a schema, see the form live (no install needed)
- [ ] `formant publish` — one command to push updates to an already-deployed form
- [ ] Template gallery — pre-built schemas for common use cases (NPS, contact form, event RSVP, etc.)
