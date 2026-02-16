# Formant — Product & Developer Experience

Formant turns natural language into deployable forms. Clone the repo, open it in Cursor, and describe what you want. The AI generates the schema, builds a single HTML file, and helps you deploy.

## Build

Describe your form in chat — "I want a customer feedback form with a 5-star rating and comments" — and Formant produces a valid schema. The built-in skill teaches the AI how to generate schemas, build HTML, and choose the right deploy path. No form builder UI, no config files. Just conversation.

Forms are **self-contained single HTML files**. They work anywhere: email, local, hosted. No backend required — Excel download and webhooks work out of the box. Add Cloudflare or Vercel when you need server-side storage.

## Deploy

- **Share with others** — Vercel + Postgres or Cloudflare. Shareable URL, server-side storage, dashboard, CSV/XLSX export.
- **Preview locally** — Offline mode opens the form in your browser; responses download as Excel or CSV.
- **Google Sheets** — One-click OAuth. Deploy with `--with-sheets`, connect in the admin panel. No clasp, no manual setup.
- **Kiosk / offline** — Build with `--local` for form + admin; copy to device, no network needed.

## For People Filling Out Forms

One question at a time, smooth transitions. Dark/light mode (system or manual). Keyboard navigation. Responses can go to Excel, Sheets, webhooks, or your backend — or all at once.
