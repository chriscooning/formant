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

Then in the Cursor chat, just say what you need:

> "I want to create a customer feedback form with a 5-star rating and a comments box"

The AI handles the rest — generates the schema, builds the HTML, and asks how you want to deploy.

## Deploy Options

| Target | Best For | Command |
|--------|----------|---------|
| **Offline** | Testing, internal use, email the file | `pnpm formant deploy forms/my-form.html --target offline` |
| **Vercel** | Shareable public URL | `pnpm formant deploy forms/my-form.html --target vercel` |
| **Vercel + admin** | Form + admin, IndexedDB responses | `pnpm formant deploy forms/my-form.html --target vercel --with-admin` |
| **Vercel + Sheets** | Connect Google Sheet (one-click OAuth) | `pnpm formant deploy forms/my-form.html --target vercel --with-sheets` |
| **Cloudflare** | Production: hosting + response collection | `pnpm formant deploy forms/my-form.html --target cloudflare` |

Or run `pnpm formant deploy forms/my-form.html` for an interactive menu. (Use `pnpm formant deploy` — `pnpm deploy` is a built-in pnpm command.)

**Vercel (non-interactive / CI):** Non-interactive deploys (e.g. from Cursor agent or CI) require `script` (Debian/Ubuntu: `apt install bsdutils`). For CI, set `VERCEL_ORG_ID` or `VERCEL_SCOPE` to skip scope detection.

**Note:** Use `pnpm formant deploy` — `pnpm deploy` is pnpm's built-in workspace deploy command.

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
- **Cloudflare D1** — SQLite database for hosted response collection
- **Vitest** + **Playwright** — unit and E2E testing
- **pnpm workspaces** — monorepo package management

## Project Structure

```
formant/
├── packages/
│   ├── core/          # Types, validation, form engine (no React)
│   ├── renderer/      # React components for rendering forms
│   ├── html-builder/  # Bundles schema → single HTML file + CLI
│   └── service/       # Cloudflare Workers API (Hono + D1)
├── apps/
│   └── e2e/           # Playwright end-to-end tests
├── forms/             # Built forms (JSON schemas tracked, HTML gitignored)
├── scripts/           # Deploy scripts and Google Sheets connector
└── .cursor/
    ├── rules/         # Agent conventions (auto-applied)
    └── skills/        # Cursor skill for form generation
```

## License

MIT — see [LICENSE](./LICENSE) for details.
