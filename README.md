# Formant

Generate beautiful, self-contained HTML forms from natural language. Clone the repo, open it in Cursor, and describe what you want. The AI generates the schema, builds a single HTML file, and helps you deploy.

Forms are **self-contained single HTML files** — work anywhere (email, local, hosted). No backend required; Excel download and webhooks work out of the box. Add Cloudflare or Vercel when you need server-side storage. One question at a time, dark/light mode, keyboard navigation.

## Quick Start

```bash
git clone https://github.com/chriscooning/formant.git
cd formant
bash setup.sh
cursor .
```

Setup builds a **demo form** (`forms/bake-sale.html`) that showcases every field type. Preview it:

```bash
pnpm formant deploy forms/bake-sale.html --target offline
```

Then in the Cursor chat, just say what you need:

> "I want to create a customer feedback form with a 5-star rating and a comments box"

The AI handles the rest — generates the schema, builds the HTML, and asks how you want to deploy.

## Deploy

| Goal | Command |
|------|---------|
| **Share with others** (recommended) | `pnpm formant deploy forms/my-form.html --target cloudflare` |
| **Preview locally** | `pnpm formant deploy forms/my-form.html --target offline` |
| **Vercel + Postgres** | `pnpm formant deploy forms/my-form.html --target vercel --with-backend` |

Cloudflare includes database and dashboard with one command. Vercel + Postgres needs a one-time DB setup — see [setup-vercel-postgres.md](docs/setup-vercel-postgres.md). All options: [deploy-options.md](docs/deploy-options.md).

Or run `pnpm formant deploy forms/my-form.html` for an interactive menu. Use `pnpm formant deploy` — `pnpm deploy` is pnpm's built-in command.

## Connect Google Sheet (Local)

Forms can send responses to Google Sheets via a one-click OAuth flow. To test locally:

1. Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. Configure `packages/service/.dev.vars` (see `.dev.vars.example`)
3. Run the API, build with `--local`, and serve the forms folder

**Full guide:** [docs/connect-google-sheet-local.md](docs/connect-google-sheet-local.md)

## Docs

| Topic | File |
|-------|------|
| Deploy options (all targets) | [docs/deploy-options.md](docs/deploy-options.md) |
| Vercel + Postgres setup | [docs/setup-vercel-postgres.md](docs/setup-vercel-postgres.md) |
| Cloudflare D1 (when deploy fails) | [docs/setup-cloudflare-d1.md](docs/setup-cloudflare-d1.md) |
| Connect Google Sheet | [docs/connect-google-sheet-local.md](docs/connect-google-sheet-local.md) |
| Contributing | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Manual CLI Usage

```bash
pnpm formant build schema.json -o forms/my-form.html   # build from JSON schema
pnpm formant preview schema.json                        # build + open in browser
pnpm formant deploy forms/my-form.html                  # deploy (interactive menu)
```

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
├── packages/
│   ├── core/          # Types, validation, form engine (no React)
│   ├── renderer/      # React components for rendering forms
│   ├── html-builder/  # Bundles schema → single HTML file + CLI
│   ├── service/         # Cloudflare Workers API (Hono + D1)
│   └── service-vercel/  # Vercel Edge API (Hono + Postgres) — same interface as service
├── apps/
│   └── e2e/           # Playwright end-to-end tests
├── forms/             # Built forms (JSON schemas tracked, HTML gitignored)
├── scripts/           # Deploy scripts and Google Sheets connector
└── .cursor/
    ├── rules/         # Agent conventions (auto-applied)
    └── skills/        # Cursor skill for form generation
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for code standards and PR expectations.

## License

MIT — see [LICENSE](./LICENSE) for details.
