---
name: formant
description: Generate interactive HTML forms from natural language. Use when the user wants to create a form, survey, questionnaire, registration page, or feedback form. Also use when mentioning Formant, form schemas, or form building.
---

# Formant — Build Forms from Natural Language

Generate beautiful, one-question-at-a-time HTML forms. Forms are self-contained single HTML files with keyboard navigation, dark/light mode, smooth transitions, and multiple submit destinations.

## End-to-End Workflow

1. **Ask** what the user wants to collect (questions, branching, where responses go)
2. **Generate** a valid FormSchema JSON
3. **Save** to `forms/<name>.json`
4. **Build** by running:
   ```bash
   pnpm formant build forms/<name>.json -o forms/<name>.html
   ```
5. **Tell** the user the file is ready:
   - Open locally: `xdg-open forms/<name>.html` (Linux) / `open forms/<name>.html` (macOS)
   - Deploy to Vercel: `pnpm deploy forms/<name>.html`

## Field Type Cheat Sheet

| Type | Purpose | Key Properties |
|------|---------|----------------|
| `welcome` | Opening screen | `buttonText` |
| `text` | Single-line text | `placeholder`, `minLength`, `maxLength`, `pattern` |
| `email` | Email input | `placeholder` (auto-validates format) |
| `number` | Numeric input | `placeholder`, `min`, `max`, `step` |
| `phone` | Phone number | `placeholder` (loose validation) |
| `url` | URL input | `placeholder` |
| `textarea` | Multi-line text | `placeholder`, `minLength`, `maxLength`, `rows` |
| `choice` | Single select cards | `options[]`, `allowOther` (auto-advances, A-Z keys) |
| `multi_choice` | Multi select cards | `options[]`, `minSelections`, `maxSelections` |
| `rating` | Star rating | `max` (1-10), `labels` |
| `scale` | Numeric scale (NPS) | `min`, `max` (required), `minLabel`, `maxLabel` |
| `yes_no` | Binary choice | `yesLabel`, `noLabel` (Y/N keys, auto-advances) |
| `date` | Date picker | `minDate`, `maxDate` (ISO format) |
| `dropdown` | Dropdown select | `options[]`, `searchable` (use for 8+ options) |
| `statement` | Info screen, no input | `buttonText` |
| `ending` | Final screen | `showSummary`, `redirectUrl`, `redirectLabel` |

## Schema Structure (Minimal)

```json
{
  "id": "form-id",
  "title": "Form Title",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Hello!", "buttonText": "Start" },
    { "id": "name", "type": "text", "title": "Your name?", "required": true },
    { "id": "end", "type": "ending", "title": "Thanks!" }
  ],
  "submit": { "destinations": [{ "type": "excel" }] },
  "theme": { "accent": "#6c5ce7", "defaultMode": "auto" }
}
```

## Submit Destinations

Multiple destinations fire in parallel. Always include `excel` as a fallback.

| Type | Required Fields | Notes |
|------|-----------------|-------|
| `excel` | -- | Client-side XLSX download. Optional `filename`. |
| `sheets` | `url` | Google Apps Script web app URL |
| `webhook` | `url` | POST JSON. Optional `headers`. Retries once on 5xx. |
| `service` | `formId` | Formant hosting service. Optional `endpoint`. |

## Branching

Any field can have a `next` property:

- **Unconditional:** `"next": "field-id"` -- always jump to that field
- **Conditional:** `"next": { "Happy": "praise", "Unhappy": "complaint", "default": "end" }` -- branch on answer value

All branches must eventually reach the `ending` field.

## Validation Checklist (verify before saving)

1. Every `id` is unique
2. At least one field exists
3. Exactly one `ending` field, reachable from all paths
4. All `next` targets reference valid field `id`s
5. `choice` and `dropdown` have non-empty `options`
6. `scale` has both `min` and `max`
7. `submit.destinations` includes at least `{ "type": "excel" }`
8. Use descriptive IDs (`"satisfaction"` not `"q3"`)
9. Don't use `required: true` on `welcome`, `statement`, or `ending`

## Design Guidelines

- Start with `welcome`, end with `ending`
- Write conversational titles: "What's your email?" not "Email Address:"
- Use `choice` for 2-7 options, `dropdown` for 8+
- Use `statement` to break up long forms
- Keep forms focused: 5-12 questions ideal
- Add `subtitle` for context, `placeholder` for text inputs

## CLI Reference

```bash
pnpm formant build <schema.json> [-o output.html] [--no-minify] [--inline]
pnpm formant preview <schema.json>   # build + open in browser
pnpm deploy <form.html>              # deploy to Vercel
```

## Full Schema Reference

For complete field property tables, branching rules, submit destination details, theme configuration, and worked examples, see [schema-reference.md](schema-reference.md).
