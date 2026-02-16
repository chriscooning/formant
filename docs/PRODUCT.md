# Formant — Product & Developer Experience

## For Developers

### AI-Native

- **Cursor / Claude compatible** — Describe what you want in chat, get a working form
- **Claude Skill** — Formant teaches AI how to generate valid schemas and deploy
- **Natural language to form** — "I want a customer feedback form with a 5-star rating" → done

### One-Command Deploy

- **Vercel + Connect Google Sheet** — `pnpm formant deploy --target vercel --with-sheets` deploys Worker, form, and admin in one flow
- **Vercel + admin** — `--with-admin` for form + admin panel, IndexedDB responses

### One-Click Google Sheets

- **OAuth flow** — No clasp, no manual setup, no copying URLs
- **One setup, unlimited forms** — Configure Google Cloud once, connect as many forms as you want
- **Per-form sheets** — Each form gets its own sheet and Apps Script automatically
- **Developer ergonomics** — Spin up forms, connect to Sheets, ship

### Self-Contained & Portable

- **Single HTML file** — Forms work anywhere: email, local, hosted
- **No backend required** — Excel download, webhooks, or optional Cloudflare/Vercel
- **Offline-first** — IndexedDB for local/kiosk mode

### Modern Stack

- **TypeScript strict mode** — Across all packages
- **React 18** — Functional components, CDN-bundled
- **Cloudflare Workers + D1** — Edge-first when you need it
- **pnpm workspaces** — Monorepo, fast installs

## For End Users

- **Conversational form** — One question at a time, smooth transitions
- **Dark/light mode** — System detection + manual toggle
- **Keyboard navigation** — Power users love it
- **Multiple destinations** — Excel, Sheets, webhook, Cloudflare — or all at once
