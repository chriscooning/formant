# Cloudflare Deploy Conventions

Conventions for `scripts/deploy-cloudflare.sh` and related tooling.

## Dashboard Generation

On successful form upload, generate `forms/<name>-dashboard.html` from the template at `.cursor/skills/formant/templates/responses-dashboard.html`. Replace placeholders:

- `{{WORKER_URL}}` — Worker base URL
- `{{FORM_ID}}` — Form ID from API response
- `{{FORM_TITLE}}` — Form title from schema
- `{{SCHEMA_JSON}}` — Schema JSON (escape `</script>` for safe embedding)

Include the dashboard path in the deploy output: `Dashboard: forms/<name>-dashboard.html (open locally, paste API key to view responses)`.

## API URLs

Management endpoints use these paths:

- List responses: `GET /api/responses/:formId`
- Export XLSX: `GET /api/responses/:formId/xlsx`
- Export CSV: `GET /api/responses/:formId/csv`
- Delete form: `DELETE /api/forms/:id`
