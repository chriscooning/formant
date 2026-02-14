# Phase 1G — End-to-End Tests

## Goal

Playwright tests that generate real HTML form files, open them in a browser, and interact with them — verifying the full stack from schema to rendered interactive form.

## Prerequisites

- Phase 1F complete (`buildFormHTML` can generate working HTML files)
- `@playwright/test` is installed in `apps/e2e/`
- All packages compile successfully

## Dependency Graph Position

```
Phase 1F ──► ► Phase 1G ◄ (terminal — no downstream deps)
```

---

## Implementation Spec

### Playwright Config (`apps/e2e/playwright.config.ts`)

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    // No baseURL — we load HTML files directly or via page.setContent
  },
  // Global setup: generate HTML files from fixtures before tests run
  globalSetup: "./global-setup.ts",
});
```

### Global Setup (`apps/e2e/global-setup.ts`)

```typescript
// Before all tests, generate HTML files from fixture schemas
import { buildFormHTML } from "@formant/html-builder";
import fs from "fs";
import path from "path";

export default async function globalSetup() {
  const fixturesDir = path.join(__dirname, "fixtures");
  const outputDir = path.join(__dirname, "generated");
  
  fs.mkdirSync(outputDir, { recursive: true });

  const fixtures = ["simple-form.json", "branching-form.json", "full-form.json"];
  
  for (const fixture of fixtures) {
    const schema = JSON.parse(fs.readFileSync(path.join(fixturesDir, fixture), "utf-8"));
    const html = buildFormHTML(schema);
    const outName = fixture.replace(".json", ".html");
    fs.writeFileSync(path.join(outputDir, outName), html);
  }
}
```

### Fixture Schemas

#### `apps/e2e/fixtures/simple-form.json`

A 3-question form with no branching:
```json
{
  "id": "simple",
  "title": "Simple Form",
  "fields": [
    {
      "id": "welcome",
      "type": "welcome",
      "title": "Welcome to our survey",
      "subtitle": "This will only take a minute",
      "buttonText": "Let's go"
    },
    {
      "id": "name",
      "type": "text",
      "title": "What is your name?",
      "required": true,
      "placeholder": "Type your name..."
    },
    {
      "id": "email",
      "type": "email",
      "title": "What is your email?",
      "required": true,
      "placeholder": "you@example.com"
    },
    {
      "id": "feedback",
      "type": "textarea",
      "title": "Any feedback?",
      "required": false,
      "placeholder": "Tell us what you think..."
    },
    {
      "id": "end",
      "type": "ending",
      "title": "Thank you!",
      "subtitle": "Your response has been recorded."
    }
  ],
  "submit": {
    "destinations": [
      { "type": "excel", "filename": "simple-responses" }
    ]
  }
}
```

#### `apps/e2e/fixtures/branching-form.json`

A form with conditional paths:
```json
{
  "id": "branching",
  "title": "Branching Form",
  "fields": [
    {
      "id": "welcome",
      "type": "welcome",
      "title": "Product Feedback",
      "buttonText": "Start"
    },
    {
      "id": "satisfaction",
      "type": "choice",
      "title": "How satisfied are you?",
      "required": true,
      "options": ["Very satisfied", "Satisfied", "Unsatisfied", "Very unsatisfied"],
      "next": {
        "Very satisfied": "positive-detail",
        "Satisfied": "positive-detail",
        "Unsatisfied": "negative-detail",
        "Very unsatisfied": "negative-detail"
      }
    },
    {
      "id": "positive-detail",
      "type": "text",
      "title": "What did you like most?",
      "next": "end"
    },
    {
      "id": "negative-detail",
      "type": "text",
      "title": "What could we improve?",
      "next": "end"
    },
    {
      "id": "end",
      "type": "ending",
      "title": "Thanks for your feedback!",
      "showSummary": true
    }
  ],
  "submit": {
    "destinations": [{ "type": "excel" }]
  }
}
```

#### `apps/e2e/fixtures/full-form.json`

A form with ALL question types:
```json
{
  "id": "full",
  "title": "All Question Types",
  "fields": [
    { "id": "welcome", "type": "welcome", "title": "Complete Form Demo", "buttonText": "Begin" },
    { "id": "name", "type": "text", "title": "Your name?", "required": true },
    { "id": "email", "type": "email", "title": "Your email?", "required": true },
    { "id": "age", "type": "number", "title": "Your age?", "min": 0, "max": 150 },
    { "id": "phone", "type": "phone", "title": "Phone number?" },
    { "id": "website", "type": "url", "title": "Your website?" },
    { "id": "bio", "type": "textarea", "title": "Tell us about yourself", "maxLength": 500 },
    { "id": "role", "type": "choice", "title": "Your role?", "options": ["Developer", "Designer", "PM", "Other"], "allowOther": true },
    { "id": "skills", "type": "multi_choice", "title": "Your skills?", "options": ["JavaScript", "TypeScript", "Python", "Go", "Rust"], "minSelections": 1 },
    { "id": "rating", "type": "rating", "title": "Rate our service", "max": 5, "labels": { "1": "Poor", "5": "Excellent" } },
    { "id": "nps", "type": "scale", "title": "How likely to recommend?", "min": 0, "max": 10, "minLabel": "Not likely", "maxLabel": "Very likely" },
    { "id": "recommend", "type": "yes_no", "title": "Would you use again?" },
    { "id": "start-date", "type": "date", "title": "When did you start?" },
    { "id": "department", "type": "dropdown", "title": "Your department?", "options": ["Engineering", "Design", "Marketing", "Sales", "Support"], "searchable": true },
    { "id": "note", "type": "statement", "title": "Almost done!", "subtitle": "Just one more question.", "buttonText": "Continue" },
    { "id": "end", "type": "ending", "title": "All done!", "showSummary": true }
  ],
  "submit": {
    "destinations": [{ "type": "excel", "filename": "full-form-responses" }]
  }
}
```

### Test Suites

#### `apps/e2e/tests/formant.spec.ts` — Happy Path

```
test: "complete a simple form"
  - Navigate to generated simple-form.html
  - Verify welcome screen is visible with title "Welcome to our survey"
  - Click "Let's go" button
  - Verify name question appears
  - Type "John Doe" and press Enter
  - Verify email question appears
  - Type "john@example.com" and press Enter
  - Verify feedback question appears
  - Type "Great product!" and click OK button (textarea uses button, not Enter)
  - Verify ending screen appears with "Thank you!"
  - Verify progress bar reached 100% before ending

test: "skip optional fields"
  - Navigate to simple-form.html
  - Click start
  - Fill name, press Enter
  - Fill email, press Enter
  - On feedback (optional): press Enter without typing
  - Verify ending screen appears (optional field skippable)
```

#### `apps/e2e/tests/branching.spec.ts` — Conditional Logic

```
test: "positive branch"
  - Navigate to branching-form.html
  - Click start
  - Select "Very satisfied"
  - Verify "What did you like most?" appears (positive-detail)
  - Type answer, press Enter
  - Verify ending screen

test: "negative branch"
  - Navigate to branching-form.html
  - Click start
  - Select "Unsatisfied"
  - Verify "What could we improve?" appears (negative-detail)
  - Type answer, press Enter
  - Verify ending screen

test: "back navigation through branch"
  - Start form, select "Very satisfied", arrive at positive-detail
  - Press Back
  - Verify back on satisfaction question
  - Select "Unsatisfied"
  - Verify now on negative-detail (different branch)
```

#### `apps/e2e/tests/keyboard.spec.ts` — Keyboard Navigation

```
test: "Enter advances past welcome"
  - Load simple-form, press Enter
  - Verify advanced to first question

test: "letter keys select choice options"
  - Load full-form, navigate to role question
  - Press 'a' key
  - Verify "Developer" is selected (first option)

test: "Y/N keys for yes_no"
  - Navigate to recommend question
  - Press 'y' key
  - Verify "Yes" selected

test: "number keys for rating"
  - Navigate to rating question
  - Press '4' key
  - Verify 4 stars selected

test: "number keys for scale"
  - Navigate to NPS question
  - Press '8' key
  - Verify 8 selected

test: "Backspace goes back"
  - Navigate forward a few questions
  - Press Backspace (while not focused on input)
  - Verify went back to previous question
```

#### `apps/e2e/tests/validation.spec.ts` — Error States

```
test: "required field shows error when empty"
  - Navigate to name question (required)
  - Press Enter without typing
  - Verify error message appears

test: "invalid email shows error"
  - Navigate to email question
  - Type "notanemail"
  - Press Enter
  - Verify email validation error

test: "fix error clears message"
  - Trigger email error
  - Clear input, type valid email
  - Verify error disappears (on input change or on next attempt)

test: "non-required field can be skipped"
  - Navigate to an optional field
  - Press Enter without input
  - Verify advances to next question (no error)

test: "number outside range shows error"
  - Navigate to age question
  - Type "200" (max is 150)
  - Press Enter
  - Verify range error
```

#### `apps/e2e/tests/theme.spec.ts` — Dark/Light Mode

```
test: "respects system dark mode"
  - Use Playwright's colorScheme: "dark" emulation
  - Load form
  - Verify background color is dark (#0a0a0c or similar)

test: "respects system light mode"
  - Use Playwright's colorScheme: "light" emulation
  - Load form
  - Verify background color is light (#fafafa or similar)

test: "manual toggle switches theme"
  - Load form with dark mode
  - Click theme toggle button
  - Verify html[data-theme="light"] is set
  - Verify background changes to light

test: "text is readable in both modes"
  - In dark mode: verify text color is light
  - Toggle to light mode: verify text color is dark
  - Verify accent color (#6c5ce7) is consistent in both
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `apps/e2e/playwright.config.ts` | Replace placeholder with config |
| `apps/e2e/global-setup.ts` | **NEW** — generate HTML from fixtures |
| `apps/e2e/fixtures/simple-form.json` | Replace placeholder with fixture |
| `apps/e2e/fixtures/branching-form.json` | Replace placeholder with fixture |
| `apps/e2e/fixtures/full-form.json` | Replace placeholder with fixture |
| `apps/e2e/tests/formant.spec.ts` | Replace placeholder with tests |
| `apps/e2e/tests/branching.spec.ts` | Replace placeholder with tests |
| `apps/e2e/tests/keyboard.spec.ts` | Replace placeholder with tests |
| `apps/e2e/tests/validation.spec.ts` | Replace placeholder with tests |
| `apps/e2e/tests/theme.spec.ts` | Replace placeholder with tests |
| `apps/e2e/tests/submit.spec.ts` | Stub — full submit tests in Phase 4 |

## Completion Criteria

```bash
# Install Playwright browsers
pnpm --filter e2e exec playwright install chromium

# Run E2E tests
pnpm test:e2e

# All 5 test suites pass
```

- All test suites pass in headless Chromium
- Tests cover: happy path, branching, keyboard nav, validation, theme toggle
- Fixtures cover: simple form, branching form, all question types
- Generated HTML files render correctly in real browser

## Open Questions

None — all decisions resolved for this segment.
