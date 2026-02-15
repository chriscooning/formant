# Phase 1C — Renderer Hooks & Shared Components

## Goal

Implement the React hooks and shared UI building blocks that all question components and the main Formant component depend on.

## Prerequisites

- Phase 1B complete (`@formant/core` types, validation, engine all tested and exported)
- `packages/renderer/` has placeholder files and `happy-dom` configured in vitest

## Dependency Graph Position

```
Phase 1B ──► ► Phase 1C ◄ ──► Phase 1D (question components)
```

---

## Implementation Spec

### Important Context

The renderer is authored as **normal TSX with standard imports**. esbuild handles JSX → `React.createElement` transpilation and bundles everything into a single IIFE at build time (Phase 1F). During development, write idiomatic React code — the CDN/IIFE concerns are purely a build step.

React and ReactDOM are NOT installed as dependencies — they come from CDN at runtime. For development and testing, they are available as `@types/react` and `@types/react-dom` (type-only). In `happy-dom` test environment, you'll need to mock or install React for tests. Add `react` and `react-dom` as **devDependencies** for testing purposes:

```json
"devDependencies": {
  "react": "^19",
  "react-dom": "^19",
  ...
}
```

### 1. Hooks

#### `packages/renderer/src/hooks/useFormEngine.ts`

```typescript
import { useState, useCallback } from "react";
import type { FormSchema, Field } from "@formant/core";
import {
  createInitialState,
  goNext,
  goBack,
  setAnswer,
  getProgress,
  isComplete,
  validateField,
  type EngineState,
} from "@formant/core";
```

**Hook signature:**
```typescript
function useFormEngine(schema: FormSchema): {
  currentField: Field | null;
  currentIndex: number;
  answers: Record<string, unknown>;
  progress: number;
  complete: boolean;
  error: string | null;
  goNext: () => boolean;          // Returns false if validation fails
  goBack: () => void;
  setAnswer: (fieldId: string, value: unknown) => void;
  setError: (error: string | null) => void;
  state: EngineState;             // Exposed for auto-save
}
```

**Behavior:**
- Initialize with `createInitialState()`
- `goNext()`: Validate current field's answer first. If validation fails, set error and return false. If valid, clear error, call engine's `goNext`, return true.
- `goBack()`: Call engine's `goBack`. Clear any error.
- `setAnswer()`: Call engine's `setAnswer`. Clear error (user is correcting).
- `progress`: Derived from `getProgress(state, schema.fields)`
- `complete`: Derived from `isComplete(state, schema.fields)`
- `currentField`: `schema.fields[state.currentIndex]` or null if past end

#### `packages/renderer/src/hooks/useKeyboard.ts`

```typescript
import { useEffect } from "react";
```

**Hook signature:**
```typescript
interface UseKeyboardConfig {
  onNext: () => void;
  onBack: () => void;
  onSelect: (key: string) => void;  // For choice/rating/scale/yesno
  currentField: Field | null;
  phase: "entering" | "active" | "exiting";
  inputFocused: boolean;            // Don't intercept when user is typing in input
}

function useKeyboard(config: UseKeyboardConfig): void
```

**Behavior:**
- Only active when `phase === "active"` (don't capture during transitions)
- Attach `keydown` listener on mount, detach on unmount
- Key mappings:
  - **Enter**: call `onNext` (except when `currentField.type === "textarea"` — Enter creates newlines there)
  - **Backspace**: call `onBack` ONLY when `inputFocused` is false (don't intercept text editing)
  - **A-Z keys**: For `choice` and `multi_choice` fields, call `onSelect` with the letter (maps to option index: A=0, B=1, etc.)
  - **Y / N keys**: For `yes_no` fields, call `onSelect("Y")` or `onSelect("N")`
  - **1-9, 0 keys**: For `rating` and `scale` fields, call `onSelect` with the number string
- Prevent default on handled keys to avoid scroll/navigation side effects
- Use `event.key` (not `event.keyCode`)

#### `packages/renderer/src/hooks/useTheme.ts`

```typescript
import { useState, useEffect, useCallback } from "react";
```

**Hook signature:**
```typescript
function useTheme(defaultMode: "light" | "dark" | "auto"): {
  mode: "light" | "dark";        // Resolved actual mode
  isDark: boolean;
  toggle: () => void;
}
```

**Behavior:**
- On mount: if `defaultMode === "auto"`, read `matchMedia("(prefers-color-scheme: dark)")`. Otherwise use the explicit default.
- Track manual override in state (NOT localStorage — Claude artifacts don't support it)
- `toggle()`: flip between light and dark, set `data-theme` attribute on `document.documentElement`
- Listen for media query changes (user changes system preference) — only applies when no manual override
- Set `data-theme` attribute immediately on mount and on every change
- Return resolved `mode` and convenience `isDark` boolean

### 2. Shared Components

All components use CSS custom properties — no hardcoded colors. Reference the variable names with `var(--ff-*)` prefix.

#### `packages/renderer/src/components/ProgressBar.tsx`

**Props:** `{ progress: number }` (0-100)

**Render:**
```
<div className="ff-progress">
  <div className="ff-progress-bar" style={{ width: `${progress}%` }} />
</div>
```

- Fixed to top of viewport
- Height: 2px
- Full width
- Background track: transparent or very subtle
- Fill bar: `var(--ff-accent)`
- CSS transition on width: `var(--ff-transition)`

#### `packages/renderer/src/components/TransitionWrapper.tsx`

**Props:** `{ phase: "entering" | "active" | "exiting"; children: React.ReactNode }`

**Render:**
```
<div className={`ff-transition ff-transition-${phase}`}>
  {children}
</div>
```

CSS classes:
- `.ff-transition-entering`: `opacity: 0; transform: translateY(20px);`
- `.ff-transition-active`: `opacity: 1; transform: translateY(0); transition: all var(--ff-transition-slow);`
- `.ff-transition-exiting`: `opacity: 0; transform: translateY(-20px); transition: all var(--ff-transition);`

#### `packages/renderer/src/components/KeyboardHint.tsx`

**Props:** `{ field: Field | null }`

**Render:** Fixed to bottom center. Show relevant keys for current question type.

Key hints by field type:
- `welcome` / `statement`: `Press Enter ↵`
- `text` / `email` / `number` / `phone` / `url` / `date`: `Press Enter ↵`
- `textarea`: `Shift + Enter ↵ to submit`
- `choice`: `A, B, C ... to select` + `Enter ↵`
- `multi_choice`: `A, B, C ... to toggle` + `Enter ↵ to continue`
- `rating`: `1-{max} to rate`
- `scale`: `{min}-{max} to select`
- `yes_no`: `Y / N`
- `dropdown`: `↑ ↓ to navigate` + `Enter ↵`
- `ending`: none (no hint)

Use `<kbd>` elements for key representations. Font: Space Mono, 11px, `var(--ff-text-muted)`.

#### `packages/renderer/src/components/ThemeToggle.tsx`

**Props:** `{ mode: "light" | "dark"; onToggle: () => void }`

**Render:**
- Fixed top-right corner (position: fixed, top: 16px, right: 16px)
- Small button with border pill style
- Content: `☀` when dark (click to go light), `●` when light (click to go dark)
- Font: Space Mono, `var(--ff-text-muted)`
- Border: 1px solid `var(--ff-border)`
- Hover: `var(--ff-border-hover)`
- Padding: 6px 12px, border-radius: 20px
- No background (transparent)

#### `packages/renderer/src/components/ErrorMessage.tsx`

**Props:** `{ message: string | null }`

**Render:** If `message` is null, render nothing.

Otherwise:
```
<div className="ff-error-message" role="alert">
  {message}
</div>
```

- Color: `var(--ff-error)`
- Font: Space Mono, 9px, uppercase, letter-spacing: 3px
- Margin-top: 12px
- CSS `shake` animation on appear (small horizontal shake, 300ms)
- `role="alert"` for accessibility

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/renderer/src/hooks/useFormEngine.ts` | Replace placeholder with full hook |
| `packages/renderer/src/hooks/useKeyboard.ts` | Replace placeholder with full hook |
| `packages/renderer/src/hooks/useTheme.ts` | Replace placeholder with full hook |
| `packages/renderer/src/components/ProgressBar.tsx` | Replace placeholder with component |
| `packages/renderer/src/components/TransitionWrapper.tsx` | Replace placeholder with component |
| `packages/renderer/src/components/KeyboardHint.tsx` | Replace placeholder with component |
| `packages/renderer/src/components/ThemeToggle.tsx` | Replace placeholder with component |
| `packages/renderer/src/components/ErrorMessage.tsx` | Replace placeholder with component |
| `packages/renderer/package.json` | Ensure `react` and `react-dom` are devDeps for testing |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/renderer exec tsc --noEmit

# Components render (spot-check in tests if written)
# Hooks can be imported without error
```

- `useFormEngine` wraps core engine as React state, validates before advance, exposes full state
- `useKeyboard` handles all key bindings per field type, respects phase and input focus
- `useTheme` detects system preference, manages toggle, sets `data-theme` attribute
- All shared components render with correct CSS class names (actual CSS written in Phase 1E-1)
- No hardcoded colors — all use `var(--ff-*)` references

## Open Questions

None — all decisions resolved for this segment.
