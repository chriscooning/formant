# Formant — Form Generation Skill

> Generate beautiful, interactive single-file HTML forms from natural language descriptions.

## What This Skill Does

You help users create forms by generating a **FormSchema** JSON object. The schema is then compiled into a self-contained `.html` file using the Formant build tool. The generated forms have a modern Typeform/Vercel aesthetic — minimal, clean, one-question-at-a-time flow with keyboard navigation, dark/light mode, and smooth transitions.

## Workflow

1. **Understand** what the user wants to collect (questions, branching logic, where responses should go)
2. **Generate** a valid FormSchema JSON
3. **Output** the schema in a fenced JSON code block

The user runs the schema through `buildFormHTML(schema)` (from `@formant/html-builder`) to produce a standalone HTML file.

---

## FormSchema Reference

### Top-Level Structure

```json
{
  "id": "unique-form-id",
  "title": "Human-readable form title",
  "fields": [ /* ordered array of Field objects */ ],
  "submit": {
    "destinations": [ /* where responses are sent */ ],
    "successMessage": "Optional override for the ending screen"
  },
  "theme": {
    "accent": "#6c5ce7",
    "accentHover": "#5a4bd1",
    "radius": "10px",
    "defaultMode": "auto"
  },
  "meta": {
    "createdAt": "2026-02-14T00:00:00Z",
    "createdBy": "claude",
    "version": 1
  }
}
```

**Required:** `id`, `fields`
**Optional:** `title`, `submit`, `theme`, `meta`

### Field Types

Every field has these base properties:

| Property   | Type                              | Required | Description |
|------------|-----------------------------------|----------|-------------|
| `id`       | `string`                          | yes      | Unique identifier, used as the answer key |
| `type`     | `FieldType`                       | yes      | One of the types below |
| `title`    | `string`                          | yes      | The question text shown to the user |
| `subtitle` | `string`                          | no       | Helper text below the title |
| `required` | `boolean`                         | no       | Default `false`. If `true`, user must answer before advancing |
| `next`     | `string \| Record<string, string>` | no       | Branching — see Branching Logic section |

#### `welcome` — Opening screen

| Property     | Type     | Default      |
|--------------|----------|--------------|
| `buttonText` | `string` | `"Start"`    |

No question number shown. Large centered title + subtitle + CTA button.

#### `text` — Single-line text input

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | Input placeholder text |
| `minLength`   | `number` | Minimum character count |
| `maxLength`   | `number` | Maximum character count |
| `pattern`     | `string` | Regex validation pattern |

Also used as the base for `email`, `phone`, and `url` inputs which share the same UI.

#### `email` — Email input

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | e.g. `"you@example.com"` |

Validates email format automatically.

#### `number` — Numeric input

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | Input placeholder |
| `min`         | `number` | Minimum value |
| `max`         | `number` | Maximum value |
| `step`        | `number` | Step increment |

#### `phone` — Phone number input

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | e.g. `"+1 (555) 000-0000"` |

Loose validation — accepts international formats.

#### `url` — URL input

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | e.g. `"https://example.com"` |

#### `textarea` — Multi-line text

| Property      | Type     | Description |
|---------------|----------|-------------|
| `placeholder` | `string` | Placeholder text |
| `minLength`   | `number` | Minimum character count |
| `maxLength`   | `number` | Maximum character count |
| `rows`        | `number` | Visible row count |

Shows an "OK" button since Enter creates newlines in textareas.

#### `choice` — Single select from options

| Property     | Type       | Description |
|--------------|------------|-------------|
| `options`    | `string[]` | **Required.** List of choices |
| `allowOther` | `boolean`  | Allow free-text "Other" option |

Cards with letter-key shortcuts (A, B, C...). Auto-advances 300ms after selection. Best for branching.

#### `multi_choice` — Multiple select

| Property        | Type       | Description |
|-----------------|------------|-------------|
| `options`       | `string[]` | **Required.** List of choices |
| `minSelections` | `number`   | Minimum selections required |
| `maxSelections` | `number`   | Maximum selections allowed |

Checkbox-style cards. No auto-advance — shows a "Continue" button.

#### `rating` — Star rating

| Property | Type                    | Description |
|----------|-------------------------|-------------|
| `max`    | `number`                | Number of stars (1–10, default `5`) |
| `labels` | `Record<number, string>` | Labels for specific values, e.g. `{ "1": "Poor", "5": "Excellent" }` |

Number keys 1–N select the rating.

#### `scale` — Numeric scale (e.g. NPS)

| Property   | Type     | Description |
|------------|----------|-------------|
| `min`      | `number` | **Required.** Scale minimum (usually `0` or `1`) |
| `max`      | `number` | **Required.** Scale maximum (usually `5` or `10`) |
| `minLabel` | `string` | Label at the low end |
| `maxLabel` | `string` | Label at the high end |

Number buttons in a horizontal row. Keys 0–9 select values.

#### `yes_no` — Binary choice

| Property   | Type     | Default   |
|------------|----------|-----------|
| `yesLabel` | `string` | `"Yes"`   |
| `noLabel`  | `string` | `"No"`    |

Two large side-by-side cards. Y/N keyboard shortcuts. Auto-advances after selection.

#### `date` — Date picker

| Property  | Type     | Description |
|-----------|----------|-------------|
| `minDate` | `string` | Earliest allowed date (ISO format) |
| `maxDate` | `string` | Latest allowed date (ISO format) |

Native date input styled to match the theme.

#### `dropdown` — Dropdown select

| Property     | Type       | Description |
|--------------|------------|-------------|
| `options`    | `string[]` | **Required.** List of options |
| `searchable` | `boolean`  | Enable type-to-filter |

Use when there are too many options for choice cards (roughly > 7 options).

#### `statement` — Informational screen (no input)

| Property     | Type     | Default        |
|--------------|----------|----------------|
| `buttonText` | `string` | `"Continue →"` |

Displays a message without collecting input. No question number.

#### `ending` — Final screen

| Property        | Type      | Description |
|-----------------|-----------|-------------|
| `showSummary`   | `boolean` | Show a summary of all answers |
| `redirectUrl`   | `string`  | URL to redirect to |
| `redirectLabel` | `string`  | Text for the redirect link |

**Every form must have exactly one `ending` field as the last reachable field.** It displays a checkmark animation, the title/subtitle, and optionally a summary of responses.

---

### Branching Logic

The `next` property on any field controls where the form goes after that question.

**Unconditional jump** — always go to a specific field:
```json
{ "id": "q1", "type": "text", "title": "...", "next": "q5" }
```

**Conditional branching** — go to different fields based on the answer:
```json
{
  "id": "satisfaction",
  "type": "choice",
  "title": "How satisfied are you?",
  "options": ["Happy", "Neutral", "Unhappy"],
  "next": {
    "Happy": "praise-detail",
    "Neutral": "suggestion",
    "Unhappy": "complaint-detail",
    "default": "end"
  }
}
```

The `"default"` key is the fallback if the answer doesn't match any key. If `next` is omitted entirely, the form advances to the next field in array order.

**Rules:**
- All `next` target values must be valid `id`s of other fields in the schema
- Branching targets should eventually reach an `ending` field
- Back navigation follows the user's actual path (history stack), not the array order

---

### Submit Destinations

Configure where form responses are sent. **Multiple destinations fire in parallel** using `Promise.allSettled` — one destination failing does not block others. The ending screen shows status feedback:

- **All succeed:** Green "Responses submitted successfully" message
- **Some fail:** Warning "Some destinations were unreachable" with details
- **All fail:** Error state with "Download Responses" as a prominent fallback

A **"Download Responses"** button is always visible on the ending screen regardless of success/failure.

```json
"submit": {
  "destinations": [
    { "type": "excel", "filename": "my-responses" },
    { "type": "sheets", "url": "https://script.google.com/macros/s/.../exec" },
    { "type": "webhook", "url": "https://hooks.example.com/abc", "headers": { "Authorization": "Bearer token" } },
    { "type": "service", "formId": "abc123" }
  ]
}
```

| Type      | Required Fields | Description |
|-----------|-----------------|-------------|
| `excel`   | —               | Client-side XLSX download. `filename` is optional. |
| `sheets`  | `url`           | POST to a Google Apps Script web app URL |
| `webhook` | `url`           | POST JSON to any URL. Optional `headers`. Retries once on 5xx with 1s delay. 10s timeout. |
| `service` | `formId`        | POST to the Formant hosting service. Optional `endpoint` for Cloudflare Workers or Vercel Postgres API. |

**Default recommendation:** Always include `{ "type": "excel" }` as a fallback so the user can always download their responses even if other destinations fail.

#### Webhook Details

The `webhook` destination sends a `POST` request with the full `FormResponse` JSON:

```json
{
  "formId": "my-form",
  "status": "completed",
  "submittedAt": "2026-02-14T12:00:00.000Z",
  "answers": { "name": "Alice", "rating": 5 },
  "metadata": { "userAgent": "...", "duration": 120, "completionRate": 100 }
}
```

- **Custom headers:** Use `headers` to add authentication tokens, API keys, or any custom headers
- **Retry:** Automatically retries once with a 1-second delay on 5xx server errors
- **Timeout:** 10-second fetch timeout per attempt
- **Use cases:** Zapier, Make.com, Slack incoming webhooks, custom APIs, n8n, Pipedream

---

### Theme Configuration

```json
"theme": {
  "accent": "#6c5ce7",
  "accentHover": "#5a4bd1",
  "radius": "10px",
  "defaultMode": "auto"
}
```

| Property      | Default     | Description |
|---------------|-------------|-------------|
| `accent`      | `#6c5ce7`   | Primary accent color (buttons, selections, progress bar) |
| `accentHover` | `#5a4bd1`   | Hover state for accent. Auto-derived if omitted. |
| `radius`      | `10px`      | Border radius for cards and inputs |
| `defaultMode` | `auto`      | `"auto"` (system preference), `"dark"`, or `"light"` |

All forms include a manual dark/light toggle regardless of `defaultMode`.

---

## How to Generate a Form

### Step 1 — Ask Clarifying Questions

Before generating, make sure you understand:

1. **Purpose** — What is this form for? (feedback, survey, registration, quiz, etc.)
2. **Fields** — What information to collect? What question types fit best?
3. **Logic** — Any conditional branching? ("If they answer X, ask Y")
4. **Destinations** — Where should responses go? Ask: *"Where should responses be sent?"*
   - **Excel download** (always include as fallback) — works offline, no setup
   - **Google Sheets** — requires a deployed Apps Script URL (see SETUP.md)
   - **Webhook** — any URL that accepts POST JSON. Supports custom headers for auth. Great for Zapier, Slack, Make.com, n8n, or custom APIs.
   - **Formant service** — hosted collection with export. Requires API key + deployment (Cloudflare D1 or Vercel Postgres).
   - Users can pick **multiple destinations** — all fire in parallel.
5. **Tone** — Formal or casual? This affects title/subtitle wording.

If the user gives a vague request like "make me a feedback form", use sensible defaults (at minimum `excel`) and explain your choices.

### Step 2 — Design the Schema

Follow these guidelines:

- **Start with a `welcome` field** — sets the tone and gives context
- **End with an `ending` field** — provides closure and optionally shows a summary
- **Use `required: true`** for essential fields; leave optional fields without it
- **Use `choice` for 2–7 options**, `dropdown` for 8+ options
- **Use `statement` fields** to break up long forms with context or encouragement
- **Keep forms focused** — 5–12 questions is ideal. Longer forms should use branching to skip irrelevant sections.
- **Use descriptive `id` values** — e.g. `"satisfaction-rating"` not `"q3"`. These become answer keys.
- **Write conversational titles** — "What's your email?" not "Email Address:"
- **Add `subtitle`** for context on complex questions
- **Add `placeholder`** for text inputs to guide the expected format

### Step 3 — Validate Your Schema

Before outputting, mentally verify:

1. Every `id` is unique across all fields
2. At least one field exists
3. Exactly one `ending` field exists and is reachable
4. All `next` targets reference valid field `id`s
5. All branching paths eventually reach the `ending`
6. `choice` and `dropdown` fields have non-empty `options` arrays
7. `scale` fields have both `min` and `max`
8. `submit.destinations` array is present (include at least `excel`)

### Step 4 — Output the Schema

Output the complete FormSchema as a JSON code block:

~~~
```json
{
  "id": "my-form",
  "title": "My Form Title",
  "fields": [ ... ],
  "submit": { "destinations": [{ "type": "excel" }] }
}
```
~~~

Then tell the user:
> Save this as a `.json` file and run it through the Formant builder to generate your HTML form:
> ```ts
> import { buildFormHTML } from "@formant/html-builder";
> import schema from "./my-form.json";
> const html = buildFormHTML(schema);
> ```

---

## Complete Example — Product Feedback Form

```json
{
  "id": "product-feedback",
  "title": "Product Feedback",
  "fields": [
    {
      "id": "welcome",
      "type": "welcome",
      "title": "We'd love your feedback",
      "subtitle": "Takes about 2 minutes. Your responses help us improve.",
      "buttonText": "Get Started"
    },
    {
      "id": "name",
      "type": "text",
      "title": "What's your name?",
      "placeholder": "Type your name...",
      "required": true
    },
    {
      "id": "email",
      "type": "email",
      "title": "What's your email?",
      "subtitle": "We'll only use this to follow up if needed.",
      "placeholder": "you@example.com",
      "required": true
    },
    {
      "id": "role",
      "type": "choice",
      "title": "What best describes your role?",
      "options": ["Developer", "Designer", "Product Manager", "Executive", "Other"],
      "allowOther": true
    },
    {
      "id": "satisfaction",
      "type": "rating",
      "title": "How satisfied are you with the product?",
      "required": true,
      "max": 5,
      "labels": { "1": "Very poor", "3": "Okay", "5": "Excellent" }
    },
    {
      "id": "recommend",
      "type": "scale",
      "title": "How likely are you to recommend us?",
      "min": 0,
      "max": 10,
      "minLabel": "Not at all likely",
      "maxLabel": "Extremely likely"
    },
    {
      "id": "favorite-feature",
      "type": "choice",
      "title": "What's your favorite feature?",
      "options": ["Speed", "Design", "Reliability", "Integrations", "Support"],
      "next": {
        "Support": "support-detail",
        "default": "improvements"
      }
    },
    {
      "id": "support-detail",
      "type": "textarea",
      "title": "Tell us about your support experience",
      "subtitle": "What went well? What could be better?",
      "placeholder": "Share your experience...",
      "next": "improvements"
    },
    {
      "id": "improvements",
      "type": "textarea",
      "title": "What would you most like us to improve?",
      "placeholder": "Your suggestions..."
    },
    {
      "id": "use-again",
      "type": "yes_no",
      "title": "Would you use this product again?"
    },
    {
      "id": "end",
      "type": "ending",
      "title": "Thank you!",
      "subtitle": "Your feedback is incredibly valuable to us.",
      "showSummary": true
    }
  ],
  "submit": {
    "destinations": [
      { "type": "excel", "filename": "product-feedback" }
    ]
  },
  "theme": {
    "accent": "#6c5ce7"
  }
}
```

This form:
- Starts with a friendly welcome screen
- Collects identity (name, email) and role
- Gets quantitative feedback (rating, NPS scale)
- Branches to a support-specific question if the user picks "Support"
- Collects open-ended improvement suggestions
- Ends with a summary of all answers
- Downloads responses as an Excel file

---

## Common Patterns

### Quick 3-Question Survey
```json
{
  "id": "quick-survey",
  "title": "Quick Survey",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Quick question for you", "buttonText": "Sure" },
    { "id": "rating", "type": "rating", "title": "How's your experience so far?", "max": 5, "required": true },
    { "id": "comment", "type": "textarea", "title": "Anything else?", "placeholder": "Optional..." },
    { "id": "end", "type": "ending", "title": "Thanks!", "subtitle": "Appreciate your time." }
  ],
  "submit": { "destinations": [{ "type": "excel" }] }
}
```

### NPS Survey with Branching
```json
{
  "id": "nps",
  "title": "NPS Survey",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "One quick question" },
    {
      "id": "score", "type": "scale", "title": "How likely are you to recommend us to a friend?",
      "min": 0, "max": 10, "minLabel": "Not likely", "maxLabel": "Very likely", "required": true
    },
    { "id": "why", "type": "textarea", "title": "What's the main reason for your score?", "placeholder": "Tell us more..." },
    { "id": "end", "type": "ending", "title": "Thank you!", "showSummary": true }
  ],
  "submit": { "destinations": [{ "type": "excel", "filename": "nps-responses" }] }
}
```

### Event Registration
```json
{
  "id": "event-registration",
  "title": "Event Registration",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Register for TechConf 2026", "subtitle": "March 15 · San Francisco", "buttonText": "Register" },
    { "id": "name", "type": "text", "title": "Full name", "required": true, "placeholder": "Jane Smith" },
    { "id": "email", "type": "email", "title": "Email address", "required": true, "placeholder": "jane@company.com" },
    { "id": "company", "type": "text", "title": "Company", "placeholder": "Acme Inc." },
    { "id": "role", "type": "dropdown", "title": "Your role", "options": ["Engineer", "Designer", "PM", "Executive", "Student", "Other"], "searchable": false },
    { "id": "dietary", "type": "choice", "title": "Dietary preference", "options": ["No restrictions", "Vegetarian", "Vegan", "Gluten-free", "Other"], "allowOther": true },
    { "id": "sessions", "type": "multi_choice", "title": "Which sessions interest you?", "options": ["Keynote", "AI Workshop", "Design Systems", "DevOps Deep Dive", "Networking Lunch"], "minSelections": 1 },
    { "id": "end", "type": "ending", "title": "You're registered!", "subtitle": "We'll send confirmation to your email.", "showSummary": true }
  ],
  "submit": { "destinations": [{ "type": "excel", "filename": "event-registrations" }] }
}
```

### Multi-Destination Feedback with Webhook + Sheets

```json
{
  "id": "multi-dest-feedback",
  "title": "Customer Feedback",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Quick feedback?", "buttonText": "Sure" },
    { "id": "satisfaction", "type": "rating", "title": "How satisfied are you?", "max": 5, "required": true },
    { "id": "comment", "type": "textarea", "title": "Anything you'd like to share?", "placeholder": "Optional..." },
    { "id": "end", "type": "ending", "title": "Thank you!", "subtitle": "Your feedback has been recorded." }
  ],
  "submit": {
    "destinations": [
      { "type": "sheets", "url": "https://script.google.com/macros/s/.../exec" },
      { "type": "webhook", "url": "https://hooks.zapier.com/hooks/catch/123/abc/", "headers": { "X-Source": "formant" } },
      { "type": "excel", "filename": "customer-feedback" }
    ]
  }
}
```

This form sends responses to Google Sheets and Zapier simultaneously, with Excel download as a fallback. If Zapier is down, Sheets still receives the data (and vice versa).

---

## CLI Deploy (Quick Reference)

**Share with others:** `pnpm formant deploy <form.html> --target vercel --with-backend` or `--target cloudflare` — shareable URL, server-side storage, dashboard.

**Preview locally:** `pnpm formant deploy <form.html> --target offline` or `pnpm formant preview <schema.json>`.

**Other options:** Vercel + Sheets (Connect Google Sheet), Local (kiosk), Vercel + admin. See `docs/deploy-options.md` for full reference.

---

## Deploying to the Formant Service

After generating a form, you can offer to deploy it to a live URL using the Formant hosting service.

### How Deployment Works

1. The user provides an **API key** (any string — recommend a UUID v4). This key is used to manage the form and access responses.
2. You generate the HTML using `buildFormHTML(schema)`.
3. POST the HTML and schema to the Formant service API.
4. The service returns a **live URL** where the form is publicly accessible.
5. Responses submitted through the form are automatically collected by the service.

### Deployment Flow

```
After generating a form, ask the user:

"Would you like me to deploy this to a live URL?
You'll need an API key — any secret string will do (I recommend a UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)."
```

Once the user provides their API key and the Formant service endpoint:

```ts
import { buildFormHTML } from "@formant/html-builder";

// 1. Build the HTML
const html = buildFormHTML(schema);

// 2. Deploy to the service
const response = await fetch("https://<formant-service-url>/api/forms", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer <user-api-key>"
  },
  body: JSON.stringify({ html, schema })
});

const { id, url } = await response.json();
// url is "/f/<id>" — the live form URL
```

Then present:
> **Your form is live at:** `https://<formant-service-url>/f/<id>`
>
> Responses are being collected automatically. To view or export them, use the same API key.

### Including Service as a Submit Destination

When deploying, add the service as a submit destination so responses are collected automatically:

```json
"submit": {
  "destinations": [
    {
      "type": "service",
      "formId": "<generated-form-id>",
      "endpoint": "https://<formant-service-url>"
    },
    { "type": "excel", "filename": "my-responses" }
  ]
}
```

**Note:** Always keep `excel` as a fallback destination, so users can download responses even if the service is unreachable.

### Managing Deployed Forms

All management endpoints require the same API key used to create the form:

| Action | Method | Endpoint |
|--------|--------|----------|
| View responses | `GET` | `/api/responses/<formId>?limit=100&offset=0` |
| Export as Excel | `GET` | `/api/responses/<formId>/xlsx` |
| Delete form | `DELETE` | `/api/forms/<formId>` |

All requests need `Authorization: Bearer <api-key>` header.

---

## Do NOT

- **Generate field IDs like `q1`, `q2`** — use descriptive names (`"satisfaction"`, `"email"`, `"favorite-feature"`)
- **Forget the `ending` field** — every form must end with one
- **Use `choice` for long lists** — switch to `dropdown` for 8+ options
- **Hardcode colors** — use the `theme.accent` property instead
- **Skip `submit.destinations`** — always include at least `{ "type": "excel" }`
- **Create orphan branches** — every path through the form must reach the `ending`
- **Use `required: true` on `welcome`, `statement`, or `ending`** — these have no input to validate
