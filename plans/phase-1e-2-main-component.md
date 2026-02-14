# Phase 1E-2 — Main Formant Component & Auto-Save

## Goal

Assemble the main `Formant` component that ties together all hooks, question components, shared UI, and submission. Implement progressive capture (auto-save) so that incomplete forms are not lost.

## Prerequisites

- Phase 1E-1 complete (styles.ts + all submit handlers exist)
- Phase 1D complete (all question components + registry)
- Phase 1C complete (all hooks + shared components)

## Dependency Graph Position

```
Phase 1E-1 ──► ► Phase 1E-2 ◄ ──► Phase 1F (html builder)
                               ──► Phase 2 (sheets connector)
```

---

## Implementation Spec

### 1. Auto-Save Hook (`packages/renderer/src/hooks/useAutoSave.ts`)

**NEW FILE** — not in original plan.md directory structure.

This hook implements progressive capture: save answers as the user progresses so incomplete submissions aren't lost.

```typescript
import { useRef, useEffect, useCallback } from "react";
import type { FormSchema, FormResponse, EngineState } from "@formant/core";

interface UseAutoSaveConfig {
  schema: FormSchema;
  state: EngineState;
  enabled: boolean;              // Only auto-save when service destination is configured
}

interface UseAutoSaveReturn {
  responseId: string | null;     // Assigned by service after first save
  saving: boolean;
  lastSaved: number | null;      // Timestamp
}
```

**Behavior:**

1. **Determine if auto-save is active**: Check if `schema.submit?.destinations` includes a `type: "service"` destination. If not, this hook is a no-op (returns `{ responseId: null, saving: false, lastSaved: null }`).

2. **Create response on first interaction**: When `state.answers` first gets a value (user answers first question), POST to `${endpoint}/api/responses/${formId}` with:
   ```json
   {
     "formId": "...",
     "status": "in_progress",
     "answers": { ... },
     "metadata": { "lastFieldId": "...", "userAgent": "..." }
   }
   ```
   Store the returned `responseId`.

3. **Save on question advance**: When `state.currentIndex` changes, PUT to `${endpoint}/api/responses/${formId}/${responseId}` with current answers + status `"in_progress"`.

4. **Debounced save while typing**: For text/textarea fields, debounce-save every 3 seconds when `state.answers` changes. Use `useRef` for the timeout.

5. **Save on page close**: Use `beforeunload` event listener. On trigger, use `navigator.sendBeacon()` to send the current state (sendBeacon is reliable during page unload, unlike fetch).

6. **Don't interfere with final submit**: When the form is completed and `submitResponses` is called, the service handler should PUT with `status: "completed"`. The auto-save hook should stop saving after completion.

**Important:** Auto-save errors should be silent — never show auto-save errors to the user. Log to console only.

### 2. Main Component (`packages/renderer/src/Formant.tsx`)

```typescript
import React, { useState, useCallback, useEffect, useRef } from "react";
import type { FormSchema } from "@formant/core";
import { useFormEngine } from "./hooks/useFormEngine";
import { useKeyboard } from "./hooks/useKeyboard";
import { useTheme } from "./hooks/useTheme";
import { useAutoSave } from "./hooks/useAutoSave";
import { questionRegistry } from "./questions";
import { ProgressBar } from "./components/ProgressBar";
import { ThemeToggle } from "./components/ThemeToggle";
import { TransitionWrapper } from "./components/TransitionWrapper";
import { KeyboardHint } from "./components/KeyboardHint";
import { submitResponses, type SubmitResult } from "./submit/handler";
```

**Component: `Formant({ schema }: { schema: FormSchema })`**

**State:**
- `phase`: `"entering" | "active" | "exiting"` — transition state
- `submitResults`: `SubmitResult[] | null` — after submission
- `submitting`: `boolean` — prevents double-submit
- `submitted`: `boolean` — locks form after successful submit
- `inputFocused`: `boolean` — tracks whether a text input is focused (for keyboard hook)

**Transition Logic:**
- When `goNext` or `goBack` is called (from hook or keyboard):
  1. Set phase to `"exiting"`
  2. After 350ms timeout: engine advances, set phase to `"entering"`
  3. After 50ms: set phase to `"active"`
- This creates: current question slides out → pause → new question slides in

**Question Rendering:**
- Look up component from `questionRegistry[currentField.type]`
- Compute `questionNumber` — count of answerable fields (exclude welcome/statement/ending) up to current index, 1-indexed
- Compute `totalQuestions` — total answerable fields
- Pass standard `QuestionProps`
- For `Ending` component: also pass `answers` and `fields` for summary

**Keyboard Integration:**
- `onSelect(key)` handler: maps key to action based on current field type
  - Choice: letter → select option at index (A=0, B=1)
  - YesNo: Y/N → set answer
  - Rating: digit → set rating
  - Scale: digit → set value
- `onNext` → trigger transition then advance
- `onBack` → trigger transition then go back

**Submission:**
- Trigger: when engine reaches completion (navigates to ending field)
- Before showing ending, call `submitResponses(schema, answers, metadata)`
- Set `submitting = true` during, `submitted = true` after
- `metadata` includes: `userAgent`, `duration` (Date.now() - startedAt in seconds), `completionRate`
- If auto-save was active (service destination), the service handler should update status to `"completed"` instead of creating a new response
- Show ending screen with submit results

**Double-Submit Prevention:**
- Once `submitted` is true, ignore all further submit attempts
- The "back" button should still work from ending screen to review answers
- But re-submitting should not fire

**Back Button:**
- Render a subtle back button (← or "Back") in top-left when history is non-empty
- Ghost button style
- Hidden during transitions (phase !== "active")

**Render Structure:**
```
<div className="ff-root">
  <ProgressBar progress={progress} />
  <ThemeToggle mode={mode} onToggle={toggle} />
  {history.length > 0 && phase === "active" && <BackButton />}
  <div className="ff-question-container">
    <TransitionWrapper phase={phase}>
      <QuestionComponent {...props} />
    </TransitionWrapper>
  </div>
  <KeyboardHint field={currentField} />
</div>
```

### 3. Entry Point (`packages/renderer/src/index.tsx`)

This file is the esbuild entry point. It reads the schema from a global variable and mounts the app.

```typescript
import React from "react";
import { createRoot } from "react-dom/client";
import { Formant } from "./Formant";

// Schema is injected by the HTML builder as a global variable
// before this IIFE executes in the generated HTML
declare var __FORMANT_SCHEMA__: import("@formant/core").FormSchema;

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    React.createElement(Formant, { schema: __FORMANT_SCHEMA__ })
  );
}
```

The HTML builder (Phase 1F) will output:
```html
<script>
  var __FORMANT_SCHEMA__ = { ...schema JSON... };
  // ...bundled IIFE follows...
</script>
```

The `var` declaration ensures `__FORMANT_SCHEMA__` is accessible within the IIFE's scope.

### 4. Renderer Tests

#### `packages/renderer/__tests__/Formant.test.tsx`

Test with happy-dom environment:
- Renders welcome screen for a schema starting with welcome field
- Advances through questions on Enter key
- Shows error on required field when empty
- Completes form and shows ending screen
- Back button appears after first advance
- Progress bar updates as questions are answered

#### `packages/renderer/__tests__/submit.test.ts`

Mock `fetch` globally:
- `submitResponses` with single destination → calls correct handler
- `submitResponses` with multiple destinations → all fire in parallel
- One destination fails → others still succeed (Promise.allSettled behavior)
- Excel download → triggers blob download (mock)
- CSV fallback when XLSX not available

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/renderer/src/hooks/useAutoSave.ts` | **NEW** — create auto-save hook |
| `packages/renderer/src/Formant.tsx` | Replace placeholder with main component |
| `packages/renderer/src/index.tsx` | Replace placeholder with entry point |
| `packages/renderer/__tests__/Formant.test.tsx` | Replace placeholder with tests |
| `packages/renderer/__tests__/submit.test.ts` | Replace placeholder with tests |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/renderer exec tsc --noEmit

# Tests pass
pnpm --filter @formant/renderer test
```

- Formant component renders a complete interactive form from a schema
- Transitions work: exiting → entering → active with correct timing
- Keyboard navigation works through the form
- Theme toggle switches and persists during session
- Submit fires on completion, prevents double-submit
- Auto-save hook creates and updates responses when service destination exists
- Auto-save is silent on errors
- Entry point reads `__FORMANT_SCHEMA__` from global scope
- All renderer tests pass

## Open Questions

None — all decisions resolved for this segment.
