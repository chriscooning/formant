# Formant

Generate beautiful, self-contained HTML forms from natural language.

**[Product & features →](docs/PRODUCT.md)**

Describe what you want to collect, and Formant builds a single HTML file with keyboard navigation, dark/light mode, smooth transitions, and multiple response destinations.

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

## Deploy Options

### Share with others (production)

| Option | Command |
|--------|---------|
| **Vercel + Postgres** | `pnpm formant deploy forms/my-form.html --target vercel --with-backend` |
| **Cloudflare** | `pnpm formant deploy forms/my-form.html --target cloudflare` |

Both give you a shareable URL, server-side storage, dashboard, and CSV/XLSX export.

**Minimal setup:** Cloudflare or Vercel account + CLI login. For Vercel + Postgres, run `vercel postgres create` once in the project; migrations run on deploy. See [plans/deploy-vercel-conventions.md](plans/deploy-vercel-conventions.md).

### Preview / test locally

| Option | Command |
|--------|---------|
| **Local preview** | `pnpm formant deploy forms/my-form.html --target offline` |
| **Build + open** | `pnpm formant preview forms/my-form.json` |

### Other options

Vercel (plain), Vercel + Sheets, and Local (kiosk) are still supported. See [docs/deploy-options.md](docs/deploy-options.md) for details.

---

Or run `pnpm formant deploy forms/my-form.html` for an interactive menu. Use `pnpm formant deploy` — `pnpm deploy` is pnpm's built-in workspace deploy command.

**Vercel (non-interactive / CI):** Non-interactive deploys require `script` (Debian/Ubuntu: `apt install bsdutils`). For CI, set `VERCEL_ORG_ID` or `VERCEL_SCOPE` to skip scope detection.

## Connect Google Sheet (Local)

Forms can send responses to Google Sheets via a one-click OAuth flow. To test locally:

1. Set up OAuth credentials in [Google Cloud Console](https://console.cloud.google.com)
2. Configure `packages/service/.dev.vars` (see `.dev.vars.example`)
3. Run the API, build with `--local`, and serve the forms folder

**Full guide:** [docs/connect-google-sheet-local.md](docs/connect-google-sheet-local.md)

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
