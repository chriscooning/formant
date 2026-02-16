# Agent Use Improvements

**Date:** 2026-02-16  
**Status:** Future plan  
**Context:** Make Formant forms easier for AI agents and automation tools to read, understand, and fill out. Use cases: Playwright/Puppeteer scripts, browser automation, AI assistants that complete forms, direct API submission.

---

## Goal

Improve form accessibility and machine-readability so agents can:
1. Parse the form structure without stepping through the UI
2. Find and interact with inputs reliably
3. Submit responses directly via API when possible

---

## Current State

| Aspect | Status |
|--------|--------|
| **Schema in DOM** | ✅ Full schema in `__FORMANT_SCHEMA__` — agents can parse it |
| **Prefill via URL** | ✅ Implemented — `?name=John&email=john@example.com` |
| **Direct API** | ✅ Service destination accepts `POST /api/responses/:formId` |
| **Input `id` / `name`** | ❌ Not set — harder to find inputs programmatically |
| **Label association** | ❌ No `aria-labelledby` or `<label for>` |
| **Schema data attribute** | ❌ Schema only in script var, not on DOM element |
| **API documentation** | ❌ No doc for agent direct submission |

---

## Phase Summary

| Phase | Description |
|-------|-------------|
| **1** | Add `id` and `aria-labelledby` to inputs — link question to control |
| **2** | Add `data-formant-schema` on root — parseable schema on DOM element |
| **3** | Document direct API submission for agents |
| **4** | (Optional) Agent mode — `?agent=1` shows all questions at once |

---

## Phase 1 — Input IDs and Label Association

### Goal

Make inputs findable by ID and properly associated with their question text for accessibility and automation.

### Implementation

**For each question component** (TextInput, TextArea, NumberInput, Email, etc.):

1. Add `id` to the input: `id={`ff-field-${field.id}`}`
2. Add `aria-labelledby` pointing to the question title: `aria-labelledby={`ff-label-${field.id}`}`
3. Add `id` to the title element: `id={`ff-label-${field.id}`}`

**For choice/scale/rating** (button-based):

- Add `id` to the container or each option
- Add `aria-label` or `aria-labelledby` where missing

**Files to modify:**

- `packages/renderer/src/questions/TextInput.tsx`
- `packages/renderer/src/questions/TextArea.tsx`
- `packages/renderer/src/questions/NumberInput.tsx`
- `packages/renderer/src/questions/Choice.tsx`
- `packages/renderer/src/questions/MultiChoice.tsx`
- `packages/renderer/src/questions/Rating.tsx`
- `packages/renderer/src/questions/Scale.tsx`
- `packages/renderer/src/questions/YesNo.tsx`
- `packages/renderer/src/questions/Dropdown.tsx`
- `packages/renderer/src/questions/DateInput.tsx` (if exists)

### Verification

- Run accessibility audit (e.g. axe-core)
- Playwright test: `page.getByLabel('What is your name?')` finds the input

---

## Phase 2 — Schema on DOM Element

### Goal

Allow agents to extract the schema from a data attribute on the root element, without parsing script content.

### Implementation

**In Formant.tsx** (or the root div):

Add `data-formant-schema` to the root container with the schema JSON (or a minimal agent-friendly subset):

```tsx
<div
  className="ff-root"
  data-formant-schema={JSON.stringify({
    id: schema.id,
    title: schema.title,
    fields: schema.fields.map(f => ({
      id: f.id,
      type: f.type,
      title: f.title,
      options: 'options' in f ? f.options : undefined,
      // ... minimal fields needed for agent to understand structure
    })),
    submit: schema.submit,
  })}
  ...
>
```

**Consideration:** Schema can be large. Alternative: `data-formant-schema-url` pointing to a JSON endpoint, or keep `__FORMANT_SCHEMA__` as primary and add a small `data-formant-form-id` and `data-formant-endpoint` for service forms.

**Simpler approach:** Add `data-formant-form-id` and `data-formant-endpoint` (when service dest) on root — enough for agents to know where to POST. Full schema stays in `__FORMANT_SCHEMA__`.

### Verification

- Agent script can read `document.querySelector('[data-formant-form-id]')?.dataset.formantFormId`

---

## Phase 3 — Document Direct API Submission

### Goal

Document how agents can submit responses directly to the API, bypassing the form UI.

### Implementation

**Create `docs/agent-api.md`** (or add section to existing docs):

```markdown
# Formant Forms — Agent API

For forms with a `service` destination, agents can submit responses directly.

## Endpoint

POST {endpoint}/api/responses/{formId}

## Request

- Method: POST
- Content-Type: application/json
- Body: { "answers": { "fieldId": "value", ... }, "metadata": { ... } }

## Getting formId and endpoint

- From schema: schema.submit.destinations find type "service" → formId, endpoint
- From DOM: __FORMANT_SCHEMA__ or data-formant-* attributes
- From URL: Form URL is /f/{formId}; endpoint is the API base
```

**Skill update:** Add note: "For agent automation: forms with service destination accept direct POST to /api/responses/:formId. See docs/agent-api.md."

---

## Phase 4 — Agent Mode (Optional)

### Goal

`?agent=1` (or `?mode=agent`) renders all questions at once in a single scrollable view. Agents can fill and submit without clicking through.

### Scope

- Larger change — requires a different render path
- All questions visible; single submit button at bottom
- May conflict with branching logic (conditional next)
- Use case: simple linear forms only, or flatten branches for agent view

### Implementation (outline)

- Add `agentMode` prop to Formant (from URL param)
- When true: render all answerable fields in sequence, each with its input
- Submit button at bottom
- Branching: show only reachable fields based on a "default" path, or show all and validate on submit

**Defer** unless there's clear demand. Phases 1–3 are lower effort and cover most agent needs.

---

## Files Changed Summary

| Phase | File | Action |
|-------|------|--------|
| 1 | `packages/renderer/src/questions/*.tsx` | Add id, aria-labelledby, aria-label |
| 2 | `packages/renderer/src/Formant.tsx` | Add data-formant-form-id, data-formant-endpoint |
| 3 | `docs/agent-api.md` | Create — direct submission guide |
| 3 | `.cursor/skills/formant/SKILL.md` | Add agent API note |

---

## Out of Scope

- Full WCAG 2.1 compliance audit (Phase 1 helps, but not complete)
- Native `<form>` with traditional submit (would require larger refactor)
- Converting choice/scale to native `<select>` / radio (changes UX)

---

## Verification

1. **Phase 1:** `page.getByLabel('What is your name?').fill('Alice')` works in Playwright
2. **Phase 2:** `document.querySelector('.ff-root').dataset.formantFormId` returns form ID
3. **Phase 3:** Agent can POST to API with answers and receive 200
