# Formant

Self-contained form generation and hosting. Forms are single HTML files that work anywhere.

## Tech Stack

- **TypeScript** — strict mode across all packages
- **React 19** — functional components for form rendering
- **Vitest** — unit and integration testing
- **Playwright** — end-to-end browser testing
- **esbuild** — bundles forms into single HTML files
- **Hono** — lightweight API framework (Cloudflare Workers)
- **Cloudflare D1** — SQLite database for the hosted service
- **pnpm workspaces** — monorepo package management

## Getting Started

```bash
pnpm install && pnpm dev
```

## Project Structure

```
formant/
├── packages/
│   ├── core/          # Types, validation, form engine (no React)
│   ├── renderer/      # React components for rendering forms
│   ├── html-builder/  # Bundles schema → single HTML file
│   └── service/       # Cloudflare Workers API (Hono + D1)
├── apps/
│   └── e2e/           # Playwright end-to-end tests
├── skill/             # Claude skill for form generation
├── scripts/           # Utility scripts (Google Sheets connector, etc.)
└── plans/             # Phase plans and build status
```

## License

MIT — see [LICENSE](./LICENSE) for details.
