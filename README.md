# Formant

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Generate beautiful, self-contained HTML forms from natural language. Clone the repo, open it in Cursor, and describe what you want. The AI generates the schema, builds a single HTML file, and helps you deploy.

Forms are **self-contained single HTML files** — work anywhere (email, local, hosted). No backend required, webhooks work out of the box. Add Cloudflare or Vercel when you need server-side storage, link responses into a Google sheet to share with others. 

Respondents answer one question at a time, dark/light mode, keyboard navigation. Exactly like that one form builder you used to know 😉 Now AI-native and built for the agentic era.

## Quick Start

```bash
git clone https://github.com/chriscooning/formant.git
cd formant
bash setup.sh
cursor .
```

Setup builds a **demo form** (`forms/bake-sale.html`). Preview it:

```bash
pnpm formant deploy forms/bake-sale.html --target offline
```

Then in Cursor chat, try one of these prompts. The AI generates the schema, builds the HTML, and asks how you want to deploy.

- "I want a customer feedback form with a 5-star rating and a comment box"
- "Create an NPS survey (0–10 scale) with an optional follow-up question"
- "I need a form that matches my site's branding" (provide URL when asked)

## Deploy

| Goal | Command |
|------|---------|
| **Share with others** (recommended) | `pnpm formant deploy forms/my-form.html --target cloudflare` |
| **Preview locally** | `pnpm formant deploy forms/my-form.html --target offline` |
| **Vercel + Postgres** | `pnpm formant deploy forms/my-form.html --target vercel --with-backend` |

Cloudflare includes database and dashboard with one command.
Vercel + Postgres needs a one-time DB setup — see [setup-vercel-postgres](docs/setup-vercel-postgres.md).

All options: [docs/deploy-options](docs/deploy-options.md).

Run `pnpm formant deploy forms/my-form.html` for an interactive menu. Use `pnpm formant deploy` — `pnpm deploy` is pnpm's built-in.

## Skill (Cursor / Claude Code)

The skill is in `.cursor/skills/formant/`.

**Cursor:** Open the repo in Cursor — skill is auto-available.

**Claude Code:** Copy the skill to your Claude Code skills directory, or use the root `SKILL.md`. Run from the project directory so `pnpm formant build` works.

## Docs

| Topic | File |
|-------|------|
| Deploy options (all targets) | [docs/deploy-options](docs/deploy-options.md) |
| Vercel + Postgres setup | [docs/setup-vercel-postgres](docs/setup-vercel-postgres.md) |
| Cloudflare D1 (when deploy fails) | [docs/setup-cloudflare-d1](docs/setup-cloudflare-d1.md) |
| Connect Google Sheet | [docs/connect-google-sheet-local](docs/connect-google-sheet-local.md) |
| Contributing | [CONTRIBUTING](CONTRIBUTING.md) |

## Manual CLI

```bash
pnpm formant build schema.json -o forms/my-form.html   # build from JSON schema
pnpm formant preview schema.json                        # build + open in browser
pnpm formant deploy forms/my-form.html                  # deploy (interactive menu)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for code standards, tech stack, and project structure.

## License

MIT — see [LICENSE](./LICENSE) for details.
