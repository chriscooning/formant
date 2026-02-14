# Formant — Implementation Plan

> A self-contained form generation and hosting system. Forms are single HTML files that work anywhere — emailed, hosted, opened locally — and submit responses to configurable endpoints.

## Tech Stack

- **Language**: TypeScript (strict mode, throughout)
- **Form Runtime**: Vanilla TS + React 19 via CDN (forms are single `.html` files)
- **Hosting Service**: Cloudflare Workers + D1 (SQLite) + Hono framework
- **Excel Generation**: SheetJS (client-side, bundled into form HTML via CDN)
- **Testing**: Vitest + Playwright (E2E for form interactions)
- **Build**: Vite (for the service), esbuild (for form template bundling)
- **Package Manager**: pnpm
- **Monorepo Structure**: pnpm workspaces

---

## Decisions & Conventions

Resolved decisions that inform all implementation work. Agents implementing any segment should read this section first.

| Area | Decision | Rationale |
|---|---|---|
| **Aesthetic** | Typeform / Vercel design style — minimal, clean, lots of whitespace, smooth transitions, one-question-at-a-time flow. Dark and light mode with system detection default + manual toggle. | User requirement |
| **Renderer authoring** | Write normal TSX with standard imports. esbuild transpiles JSX → `React.createElement` and bundles into a single IIFE at build time. | Developer experience: JSX is far more readable than raw createElement calls across 12+ components, hooks, and shared UI. esbuild handles the transform in milliseconds with zero config overhead. The output is identical either way. |
| **Package linking** | Use pnpm workspace protocol (`"@formant/core": "workspace:*"`) for cross-package dependencies. | Standard monorepo practice — live linking during dev, automatic version resolution on publish. Single lockfile. Used by Vercel, Turborepo projects, etc. |
| **Service testing** | Vitest + `@cloudflare/vitest-pool-workers` (miniflare bindings) for service tests. | Workers run in V8 isolates, not Node.js. Miniflare simulates the Workers runtime locally so tests can exercise real D1 queries, CORS headers, and Hono routes without deploying. |
| **API entry point** | Programmatic only for MVP. The html-builder exposes `buildFormHTML(schema)` as a function. No CLI. | Primary consumer is the Claude skill (generates schema, calls function, outputs HTML). CLI is a future phase item. |
| **Skill type** | Claude marketplace skill. `skill/SKILL.md` follows Claude skill format and teaches Claude how to generate valid FormSchema JSON and produce HTML artifacts. | User requirement — this is the user-facing product layer. |
| **Dashboard UI** | Deferred. Not scoped into any current phase. | MVP focuses on form generation + submission. A management dashboard can be added as a future phase once the service API is stable. |
| **Rate limiting** | Post-MVP. The public `POST /api/responses/:formId` endpoint has no rate limiting initially. | Acceptable for early usage. Will be added as a future phase. |
| **Font fallback** | Include system font stacks so forms remain readable offline: `'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` and `'Space Mono', 'SF Mono', 'Fira Code', 'Fira Mono', monospace`. | Google Fonts require network; fallbacks ensure offline forms don't break. |

---

## Design System

All generated forms share this aesthetic. Inspired by Typeform and Vercel's design language — minimal, clean, generous whitespace, smooth transitions.

> **Note:** A service dashboard UI is deferred to a future phase. When built, it will share this same design system.

### Principles
- **Minimal, typographic, editorial** — not "app-like", more like a well-designed printed form
- **Two fonts**: `Space Mono` (monospace, labels/hints/metadata) + `Outfit` (sans-serif, titles/body)
- **Dark mode default**, light mode available, auto-detects `prefers-color-scheme`
- **Micro-animations**: subtle translateY + opacity on transitions, no bounce/spring/playful
- **Color palette**: near-black backgrounds, muted grays for secondary, single accent color per form (configurable, default: `#6c5ce7`)
- **Dense but breathable**: tight letter-spacing on labels, generous padding on interactive elements
- **Card-based surfaces**: subtle border, slight background lift, 10px radius
- **No shadows** — use borders and background shifts for depth

### CSS Custom Properties (Dark Mode)
```css
:root {
  --ff-bg: #0a0a0c;
  --ff-surface: #0e0e12;
  --ff-surface-hover: #131318;
  --ff-border: #1a1a1f;
  --ff-border-hover: #333;
  --ff-text: #e0e0e0;
  --ff-text-secondary: #666;
  --ff-text-muted: #444;
  --ff-text-faint: #333;
  --ff-accent: #6c5ce7;
  --ff-accent-hover: #5a4bd1;
  --ff-accent-glow: rgba(108, 92, 231, 0.12);
  --ff-error: #ff6b6b;
  --ff-success: #51cf66;
  --ff-radius: 10px;
  --ff-font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --ff-font-mono: 'Space Mono', 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
  --ff-transition: 0.2s ease;
  --ff-transition-slow: 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
```

### CSS Custom Properties (Light Mode)
```css
@media (prefers-color-scheme: light) {
  :root {
    --ff-bg: #fafafa;
    --ff-surface: #ffffff;
    --ff-surface-hover: #f5f5f5;
    --ff-border: #e5e5e5;
    --ff-border-hover: #ccc;
    --ff-text: #1a1a1a;
    --ff-text-secondary: #888;
    --ff-text-muted: #aaa;
    --ff-text-faint: #ddd;
    --ff-accent: #6c5ce7;
    --ff-accent-hover: #5a4bd1;
    --ff-accent-glow: rgba(108, 92, 231, 0.08);
    --ff-error: #e03131;
    --ff-success: #2f9e44;
  }
}
```

### Manual Theme Toggle
In addition to auto-detection, forms include a small toggle button (top-right corner, a sun/moon icon in `Space Mono` style — just the characters `☀` / `●`). Clicking it sets `data-theme="light"` or `data-theme="dark"` on `<html>` and stores the preference in a JS variable (NOT localStorage, since artifacts don't support it). The CSS uses `[data-theme="light"]` selectors that override the media query when manually toggled.

```css
[data-theme="light"] {
  --ff-bg: #fafafa;
  /* ... same as light mode values above ... */
}
[data-theme="dark"] {
  --ff-bg: #0a0a0c;
  /* ... same as dark mode values above ... */
}
```

### Typography Scale
```
Page title:      Outfit 300, 28px
Question title:  Outfit 500, 22px
Body/options:    Outfit 300, 15px
Input text:      Outfit 300, 18px
Labels/hints:    Space Mono 400, 9px, letter-spacing: 3px, uppercase
Tags/badges:     Space Mono 400, 9px, letter-spacing: 2px, uppercase, border pill
Keyboard hints:  Space Mono 400, 11px
```

### Interactive Elements
```
Choice cards:    border: 1px solid var(--ff-border), padding: 28px 24px, radius: 10px
                 hover: border-color var(--ff-border-hover), bg var(--ff-surface-hover), translateY(-2px)
                 selected: border-color var(--ff-accent), bg var(--ff-accent-glow)
Buttons:         bg var(--ff-accent), color white, padding: 10px 24px, radius: 8px
                 hover: bg var(--ff-accent-hover), translateY(-1px)
                 active: translateY(0)
Text inputs:     transparent bg, border-bottom: 1px solid var(--ff-border)
                 focus: border-color var(--ff-accent)
Progress bar:    fixed top, height: 2px, bg var(--ff-accent), smooth width transition
```

---

## Repository Structure

```
formant/
├── packages/
│   ├── core/                          # Form schema types + validation logic
│   │   ├── src/
│   │   │   ├── types.ts               # FormSchema, Field, Theme, SubmitConfig types
│   │   │   ├── validate.ts            # Field validation logic
│   │   │   ├── engine.ts              # Navigation state machine (resolveNext, history)
│   │   │   └── index.ts               # Public API exports
│   │   ├── __tests__/
│   │   │   ├── validate.test.ts       # Validation unit tests
│   │   │   └── engine.test.ts         # Navigation/branching unit tests
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── renderer/                      # React form renderer (compiled into HTML)
│   │   ├── src/
│   │   │   ├── Formant.tsx           # Main component
│   │   │   ├── questions/             # One component per question type
│   │   │   │   ├── Welcome.tsx
│   │   │   │   ├── TextInput.tsx
│   │   │   │   ├── Choice.tsx
│   │   │   │   ├── MultiChoice.tsx
│   │   │   │   ├── Rating.tsx
│   │   │   │   ├── Scale.tsx
│   │   │   │   ├── YesNo.tsx
│   │   │   │   ├── TextArea.tsx
│   │   │   │   ├── DateInput.tsx
│   │   │   │   ├── Dropdown.tsx
│   │   │   │   ├── Statement.tsx
│   │   │   │   ├── Ending.tsx
│   │   │   │   └── index.ts           # Question type registry
│   │   │   ├── components/            # Shared UI pieces
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── KeyboardHint.tsx
│   │   │   │   ├── ThemeToggle.tsx
│   │   │   │   ├── TransitionWrapper.tsx
│   │   │   │   └── ErrorMessage.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useFormEngine.ts   # Wraps core/engine as React hook
│   │   │   │   ├── useKeyboard.ts     # Keyboard navigation hook
│   │   │   │   └── useTheme.ts        # Dark/light mode detection + toggle
│   │   │   ├── submit/
│   │   │   │   ├── handler.ts         # Orchestrates multi-destination submit
│   │   │   │   ├── sheets.ts          # Google Sheets POST logic
│   │   │   │   ├── webhook.ts         # Generic webhook POST
│   │   │   │   ├── service.ts         # Formant service POST
│   │   │   │   └── excel.ts           # Client-side XLSX generation + download
│   │   │   ├── styles.ts              # All CSS as template literal (uses CSS vars)
│   │   │   └── index.tsx              # Entry point: reads schema, mounts Formant
│   │   ├── __tests__/
│   │   │   ├── Formant.test.tsx       # Component render tests
│   │   │   └── submit.test.ts          # Submit handler tests (mocked fetch)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── html-builder/                   # Compiles renderer + schema → single .html file
│   │   ├── src/
│   │   │   ├── build.ts               # Takes FormSchema JSON → outputs .html string
│   │   │   ├── template.ts            # HTML shell template with CDN imports
│   │   │   ├── cli.ts                 # STUB — future CLI entry point (formant build schema.json -o form.html)
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   │   └── build.test.ts          # Verify HTML output structure
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── service/                        # Cloudflare Worker hosting + response collection
│       ├── src/
│       │   ├── index.ts               # Hono app entry
│       │   ├── routes/
│       │   │   ├── forms.ts           # POST /api/forms, GET /f/:id
│       │   │   ├── responses.ts       # POST /api/responses/:id, GET /api/responses/:id
│       │   │   └── export.ts          # GET /api/responses/:id/xlsx
│       │   ├── db/
│       │   │   ├── schema.sql         # D1 table definitions
│       │   │   └── queries.ts         # Typed query helpers
│       │   ├── middleware/
│       │   │   ├── cors.ts            # CORS allowing null origin + configured domains
│       │   │   └── auth.ts            # Simple API key auth for form creation
│       │   └── utils/
│       │       ├── id.ts              # Short ID generation (nanoid)
│       │       └── xlsx.ts            # Server-side Excel generation
│       ├── __tests__/
│       │   ├── forms.test.ts          # Form CRUD tests
│       │   └── responses.test.ts      # Response collection tests
│       ├── wrangler.toml
│       ├── tsconfig.json
│       └── package.json
│
├── apps/
│   └── e2e/                            # End-to-end tests
│       ├── tests/
│       │   ├── formant.spec.ts      # Complete form walkthrough
│       │   ├── branching.spec.ts      # Conditional logic paths
│       │   ├── keyboard.spec.ts       # Keyboard navigation
│       │   ├── validation.spec.ts     # Required fields, email format, etc.
│       │   ├── submit.spec.ts         # Submit to various destinations
│       │   └── theme.spec.ts          # Dark/light mode toggle
│       ├── fixtures/
│       │   ├── simple-form.json       # 3 question form, no branching
│       │   ├── branching-form.json    # Form with conditional paths
│       │   └── full-form.json         # All question types
│       ├── playwright.config.ts
│       └── package.json
│
├── skill/                              # Claude marketplace skill (the AI instruction layer)
│   ├── SKILL.md                        # Claude skill: teaches Claude to generate FormSchema + HTML artifacts
│   └── examples/
│       ├── product-feedback.json       # Example schema
│       └── product-feedback.html       # Generated HTML reference
│
├── scripts/
│   ├── apps-script/
│   │   └── sheets-connector.gs        # Google Apps Script (copy-paste)
│   └── setup.sh                        # Local dev setup
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts                    # Shared vitest config
├── .eslintrc.json
├── .prettierrc
├── README.md
├── LICENSE                             # MIT
└── package.json
```

---

## Phase 1 — Core Types, Engine, and Renderer

> Goal: Generate a single `.html` file that is a fully interactive form with Excel download on completion. No backend. No setup. Works anywhere.

### Step 1.1 — Project Scaffolding

Initialize the monorepo and all packages with proper TypeScript configuration.

```
Tasks:
1. Create the root directory structure as shown above
2. Initialize pnpm workspace with `pnpm-workspace.yaml` pointing to `packages/*` and `apps/*`
3. Create root `package.json` with shared dev dependencies:
   - typescript ^5.7
   - vitest ^3
   - @types/react ^19
   - eslint + prettier
4. Create `tsconfig.base.json` with strict mode:
   - "strict": true
   - "noUncheckedIndexedAccess": true
   - "exactOptionalPropertyTypes": false (too annoying for form schemas)
   - "moduleResolution": "bundler"
   - "target": "ES2022"
5. Create each package with its own `package.json` and `tsconfig.json` extending base
   - Use pnpm workspace protocol for cross-package deps: `"@formant/core": "workspace:*"`
   - Package names: @formant/core, @formant/renderer, @formant/html-builder, @formant/service
6. Configure vitest in root `vitest.config.ts` with workspaces
7. Add `.eslintrc.json` and `.prettierrc` with reasonable defaults
8. Add scripts to root package.json:
   - "dev": runs all packages in dev mode
   - "build": builds all packages
   - "test": runs vitest
   - "test:e2e": runs playwright
   - "lint": eslint + prettier check
```

### Step 1.2 — Core Types (`packages/core/src/types.ts`)

Define the complete type system for form schemas. These types are the contract between the skill (which generates JSON), the renderer (which displays forms), and the service (which stores them).

```typescript
// All types to define:

// FieldType — union of all supported question types
type FieldType =
  | "welcome" | "text" | "textarea" | "email" | "number"
  | "phone" | "url" | "choice" | "multi_choice" | "rating"
  | "scale" | "yes_no" | "date" | "dropdown" | "statement" | "ending";

// BaseField — shared properties for all fields
interface BaseField {
  id: string;                              // Unique identifier, used as answer key
  type: FieldType;
  title: string;                           // The question text
  subtitle?: string;                       // Optional helper text below title
  required?: boolean;                      // Default false
  next?: Record<string, string> | string;  // Branching: answer→fieldId map or single fieldId
}

// Type-specific field interfaces extending BaseField:
// - TextField: placeholder, minLength, maxLength, pattern (regex string)
// - EmailField: placeholder
// - NumberField: placeholder, min, max, step
// - TextAreaField: placeholder, minLength, maxLength, rows
// - ChoiceField: options (string[]), allowOther (boolean)
// - MultiChoiceField: options (string[]), minSelections, maxSelections
// - RatingField: max (1-10, default 5), labels (Record<number, string>)
// - ScaleField: min, max, minLabel, maxLabel
// - YesNoField: yesLabel, noLabel (defaults "Yes"/"No")
// - DateField: minDate, maxDate
// - DropdownField: options (string[]), searchable (boolean)
// - WelcomeField: buttonText
// - StatementField: buttonText
// - EndingField: showSummary, redirectUrl, redirectLabel

// Field — discriminated union of all field types
type Field = TextField | EmailField | NumberField | /* ... all types */;

// SubmitDestination — where responses go
interface SheetsDestination {
  type: "sheets";
  url: string;                             // Google Apps Script web app URL
}
interface WebhookDestination {
  type: "webhook";
  url: string;
  headers?: Record<string, string>;
}
interface ServiceDestination {
  type: "service";
  formId: string;
  endpoint?: string;                       // Defaults to production Formant API
}
interface ExcelDestination {
  type: "excel";                           // Client-side download, no URL needed
  filename?: string;
}
type SubmitDestination = SheetsDestination | WebhookDestination | ServiceDestination | ExcelDestination;

// ThemeConfig — customizable visual properties
interface ThemeConfig {
  accent?: string;                         // Primary accent color, default #6c5ce7
  accentHover?: string;                    // Hover state, auto-derived if not set
  radius?: string;                         // Border radius, default "10px"
  defaultMode?: "light" | "dark" | "auto"; // Default "auto"
}

// FormSchema — the top-level schema
interface FormSchema {
  id: string;
  title?: string;                          // Used in HTML <title> and service dashboard
  fields: Field[];
  submit?: {
    destinations: SubmitDestination[];
    successMessage?: string;               // Override ending screen message on submit
  };
  theme?: ThemeConfig;
  meta?: {
    createdAt?: string;
    createdBy?: string;
    version?: number;
  };
}

// FormResponse — what gets sent to destinations
interface FormResponse {
  formId: string;
  submittedAt: string;                     // ISO 8601
  answers: Record<string, unknown>;        // fieldId → answer value
  metadata?: {
    userAgent?: string;
    duration?: number;                     // Seconds from start to submit
    completionRate?: number;               // Questions answered / total questions
  };
}
```

### Step 1.3 — Validation Logic (`packages/core/src/validate.ts`)

Implement field-level validation. Pure functions, no side effects, fully unit testable.

```
Functions to implement:

validateField(field: Field, value: unknown): string | null
  - Returns error message string, or null if valid
  - Handles each field type:
    - required check (all types): value is not undefined/null/empty string
    - text/textarea: minLength, maxLength, pattern (RegExp)
    - email: regex validation (/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    - number: min, max, must be numeric
    - url: basic URL validation
    - phone: basic format check (loose — international numbers vary)
    - choice: value must be in options array (or allowOther is true)
    - multi_choice: array length between minSelections and maxSelections
    - date: valid date string, within minDate/maxDate if set
    - dropdown: value must be in options array
    - rating: integer between 1 and field.max
    - scale: integer between field.min and field.max
    - yes_no: value must be "Yes" or "No" (or custom labels)
    - welcome/statement/ending: always valid (no input)

validateSchema(schema: FormSchema): string[]
  - Returns array of validation errors for the schema itself
  - Checks: unique field IDs, valid branching targets exist, at least one field,
    ending field exists, no orphaned branches, submit destinations are valid
```

Write tests in `packages/core/__tests__/validate.test.ts`:
- Test each field type with valid and invalid inputs
- Test required vs optional behavior
- Test edge cases: empty strings, null, undefined, wrong types
- Test schema validation: duplicate IDs, missing branch targets, etc.

### Step 1.4 — Navigation Engine (`packages/core/src/engine.ts`)

The state machine that drives form navigation. Pure functions operating on immutable state.

```
Types:
  interface EngineState {
    currentIndex: number;
    answers: Record<string, unknown>;
    history: number[];                     // Stack of previous indices for back navigation
    startedAt: number;                     // Timestamp for duration tracking
  }

Functions:
  createInitialState(): EngineState
    - currentIndex: 0, answers: {}, history: [], startedAt: Date.now()

  resolveNextIndex(fields: Field[], currentIndex: number, answer: unknown): number
    - If current field has `next` property:
      - If `next` is a string: find field with that ID, return its index
      - If `next` is a Record: look up answer in map, fall back to "default" key
      - If target field not found: fall through to sequential
    - Otherwise: return currentIndex + 1
    - If result >= fields.length: return fields.length (signals completion)

  goNext(state: EngineState, fields: Field[]): EngineState | null
    - Resolve next index from current field and its answer
    - Push current index onto history stack
    - Return new state with updated currentIndex and history
    - Return null if already at end

  goBack(state: EngineState): EngineState | null
    - Pop last index from history stack
    - Return new state with that index as currentIndex
    - Return null if history is empty

  setAnswer(state: EngineState, fieldId: string, value: unknown): EngineState
    - Return new state with updated answers map

  getProgress(state: EngineState, fields: Field[]): number
    - Calculate 0-100 progress percentage
    - Exclude welcome/ending/statement from count
    - Based on (answered questions / total questions), not index position

  isComplete(state: EngineState, fields: Field[]): boolean
    - True if currentIndex >= fields.length or current field is "ending" type
```

Write tests in `packages/core/__tests__/engine.test.ts`:
- Linear form: 5 questions, verify sequential navigation
- Branching form: test that different answers lead to different paths
- Back navigation: verify history stack works correctly through branches
- Progress calculation: verify accuracy with mixed field types
- Edge cases: single question form, all optional, deep branching (3+ levels)

### Step 1.5 — Form Renderer (`packages/renderer/`)

React components that render the form. **Written as normal TSX with standard imports** — esbuild handles JSX → `React.createElement` transpilation and bundles everything into a single IIFE at build time (see Step 1.6 for the build pipeline). During development, write idiomatic React code; the CDN/IIFE concerns are purely a build step.

Uses CSS custom properties for theming. All styles in a single `styles.ts` file as a template literal.

#### 1.5.1 — Hooks

```
useFormEngine(schema: FormSchema)
  - Wraps core engine functions as React state
  - Returns: { currentField, answers, progress, isComplete, goNext, goBack, setAnswer, error, setError }
  - Calls validateField before goNext; sets error if invalid

useKeyboard(config: { onNext, onBack, onSelect, currentField, phase })
  - Attaches/detaches keydown listener
  - Enter → onNext (except during textarea)
  - Letter keys A-Z → onSelect for choice fields
  - Y/N → onSelect for yes_no
  - 0-9 → onSelect for rating/scale
  - Backspace (with no input focused) → onBack
  - Only active when phase === "active" (not during transitions)

useTheme(defaultMode: "light" | "dark" | "auto")
  - Reads system preference via matchMedia("(prefers-color-scheme: dark)")
  - Manages manual override state
  - Sets data-theme attribute on documentElement
  - Returns: { mode, toggle, isDark }
```

#### 1.5.2 — Shared Components

```
ProgressBar
  - Fixed top, 2px tall, full width
  - Width set by progress percentage
  - CSS transition on width
  - Color: var(--ff-accent)

TransitionWrapper
  - Manages enter/active/exit CSS classes on children
  - Props: phase ("entering" | "active" | "exiting"), children
  - CSS: entering = opacity 0, translateY(20px)
         active = opacity 1, translateY(0)
         exiting = opacity 0, translateY(-20px)

KeyboardHint
  - Fixed bottom center
  - Shows relevant keys for current question type
  - Space Mono, 11px, muted color
  - Uses <kbd> elements for key representations

ThemeToggle
  - Fixed top-right corner
  - Small button: ☀ (light) or ● (dark)
  - Space Mono, muted, border pill style
  - onClick calls useTheme().toggle

ErrorMessage
  - Renders below input when error is set
  - ff-error color, shake animation
  - Space Mono, 9px uppercase
```

#### 1.5.3 — Question Components

Each question component receives these common props:
```typescript
interface QuestionProps<T = unknown> {
  field: Field;               // The field definition
  value: T;                   // Current answer value
  onChange: (value: T) => void;
  error: string | null;
  questionNumber: number;     // "Question 3 of 8"
  totalQuestions: number;
  onNext: () => void;         // For auto-advance on selection
}
```

Implement each question type:

**Welcome** — Large centered title (Outfit 300 28px), subtitle (15px muted), single CTA button. No question number.

**TextInput** (covers text, email, url, phone) — Question number label (Space Mono 9px), title, underline-style input (transparent bg, bottom border only), placeholder in muted color. Auto-focus on mount.

**NumberInput** — Same as TextInput but type="number" with min/max attributes.

**TextArea** — Question number, title, bordered textarea (1px border, 10px radius), "OK ✓" button below (since Enter creates newlines).

**Choice** — Question number, title, vertical stack of choice cards. Each card: left-aligned letter key in a bordered pill (Space Mono), label text (Outfit). Cards stagger-animate in (50ms delay each). Clicking or pressing letter key selects and auto-advances after 300ms. Selected card gets accent border + glow background.

**MultiChoice** — Same card style as Choice but with a checkbox indicator instead of letter key. No auto-advance. Shows "Continue" button after at least one selection (or minSelections if set).

**Rating** — Question number, title, row of star characters. Filled stars = accent color, unfilled = muted/grayscale. Optional labels below (space-between). Clicking a star sets that rating.

**Scale** — Question number, title, horizontal row of number buttons (Space Mono). Selected button gets accent background. Min/max labels below at edges.

**YesNo** — Question number, title, two large side-by-side cards ("Yes" / "No" or custom labels). Small key hint below each (Y/N). Selecting auto-advances after 300ms.

**DateInput** — Question number, title, native date input styled to match theme. Fallback styling for date picker.

**Dropdown** — Question number, title, custom styled select. If `searchable`, render a text input that filters options with a dropdown list below.

**Statement** — Title + optional subtitle, "Continue →" button. No question number, no input.

**Ending** — Centered layout. CSS-only checkmark in a circle (accent border + glow bg). Title, subtitle. Optional response summary (if showSummary). Summary renders each answered field as label + value pairs in a card surface.

#### 1.5.4 — Submit Handler (`packages/renderer/src/submit/`)

After the last question (before or on the ending screen), fire submissions to all configured destinations in parallel.

```
submitResponses(schema: FormSchema, answers: Record<string, unknown>, metadata: object): Promise<SubmitResult[]>
  - Build FormResponse object
  - For each destination in schema.submit.destinations, call the appropriate handler
  - Fire all in parallel with Promise.allSettled
  - Return array of results: { destination: string, success: boolean, error?: string }

submitToSheets(url: string, response: FormResponse): Promise<void>
  - POST to Google Apps Script URL
  - Body: JSON with flattened answers (field titles as keys, not IDs)
  - Content-Type: text/plain (Apps Script quirk for CORS from null origin)
  - Mode: "no-cors" as fallback if CORS fails

submitToWebhook(url: string, response: FormResponse, headers?: Record<string, string>): Promise<void>
  - POST JSON to the URL with optional custom headers

submitToService(formId: string, endpoint: string, response: FormResponse): Promise<void>
  - POST to {endpoint}/api/responses/{formId}

downloadExcel(schema: FormSchema, response: FormResponse, filename?: string): void
  - Use SheetJS (XLSX) to generate a workbook
  - Sheet 1: "Responses" with field titles as headers, values as first row
  - Sheet 2: "Metadata" with submission timestamp, duration, completion rate
  - Trigger browser download
  - SheetJS is loaded from CDN: https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js
```

#### 1.5.5 — Main Formant Component

```
Formant({ schema }: { schema: FormSchema })
  - Uses useFormEngine for state
  - Uses useKeyboard for navigation
  - Uses useTheme for dark/light mode
  - Manages transition phases: "active" → "exiting" → (update index) → "entering" → "active"
  - Transition timing: 350ms exit, 50ms pause, enter begins immediately on mount
  - Renders: ProgressBar, ThemeToggle, TransitionWrapper > QuestionComponent, KeyboardHint, BackButton
  - On completion: calls submitResponses, shows ending screen with success/error state
  - The question type registry maps FieldType → component, making it easy to extend
```

#### 1.5.6 — Styles (`packages/renderer/src/styles.ts`)

All CSS as a single exported template literal string. Uses CSS custom properties throughout (no hardcoded colors). The HTML builder will inject this into a `<style>` tag.

Structure the CSS in sections:
```
1. @import for Google Fonts (Outfit + Space Mono)
2. :root variables (dark mode defaults)
3. @media (prefers-color-scheme: light) overrides
4. [data-theme="light"] overrides
5. [data-theme="dark"] overrides
6. Reset (* { margin: 0; padding: 0; box-sizing: border-box })
7. Base (body/root container)
8. Progress bar
9. Question container + transition states
10. Typography (question numbers, titles, subtitles)
11. Input styles (text, textarea, date)
12. Choice cards + stagger animation
13. Rating stars
14. Scale buttons
15. Yes/No cards
16. Dropdown
17. Buttons (primary, ghost)
18. Error state + shake animation
19. Keyboard hints
20. Theme toggle
21. Ending screen + checkmark animation
22. Responsive (@media max-width: 640px)
```

### Step 1.6 — HTML Builder (`packages/html-builder/`)

Takes a `FormSchema` and compiles it into a single, self-contained `.html` file.

```
buildFormHTML(schema: FormSchema): string
  - Returns a complete HTML document string
  - Structure:
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{schema.title || "Formant"}</title>
      <style>{GENERATED_CSS}</style>
    </head>
    <body>
      <div id="root"></div>
      <script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
      <script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
      <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
      <script>
        // Inline the compiled renderer code (pre-bundled, React globals)
        // Inline the schema as: const FORM_SCHEMA = {schema_json};
        // Mount: ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Formant, { schema: FORM_SCHEMA }));
      </script>
    </body>
    </html>

  - The renderer is authored as normal TSX with imports (see Step 1.5)
  - esbuild compiles TSX → JS, resolves all internal imports, and outputs a single IIFE
  - React/ReactDOM are marked as external (resolved from window globals via CDN script tags)
  - The schema JSON is interpolated into the HTML as a script variable
```

The build pipeline:
```
1. esbuild bundles packages/renderer/ → single JS string
   - Format: IIFE
   - External: react, react-dom (read from window globals)
   - Target: ES2020
   - Minify: true for production
2. buildFormHTML() interpolates:
   - CSS styles into <style>
   - Bundled JS into <script>
   - Schema JSON into a const declaration
   - CDN script tags for React, ReactDOM, SheetJS
3. Output: single .html file, typically 50-80KB, works offline (except font loading)
```

Test in `packages/html-builder/__tests__/build.test.ts`:
- Verify output is valid HTML
- Verify schema is properly embedded
- Verify React and SheetJS CDN tags are present
- Verify CSS contains theme variables

### Step 1.7 — End-to-End Tests (`apps/e2e/`)

Playwright tests that open generated HTML files in a browser and interact with them.

```
Setup:
  - beforeAll: use html-builder to generate test HTML files from fixture schemas
  - Serve them via a local static server (or use Playwright's page.setContent)

Tests:

formant.spec.ts — Happy path walkthrough
  - Load simple-form.json (3 text questions + ending)
  - Click start on welcome screen
  - Type answers, press Enter to advance
  - Verify ending screen shows
  - Verify all answers are collected correctly

branching.spec.ts — Conditional logic
  - Load branching-form.json
  - Select option A → verify redirected to branch A question
  - Go back, select option B → verify redirected to branch B question
  - Complete each branch, verify ending reached

keyboard.spec.ts — Full keyboard navigation
  - Verify Enter advances past welcome
  - Verify letter keys select choice options
  - Verify Y/N keys work for yes_no
  - Verify number keys work for rating/scale
  - Verify Backspace goes back
  - Verify Tab moves focus correctly

validation.spec.ts — Error states
  - Press Enter on required empty field → verify error message appears
  - Enter invalid email → verify email error
  - Enter number outside min/max → verify error
  - Fix error → verify error clears
  - Verify non-required fields can be skipped

theme.spec.ts — Dark/light mode
  - Load form with auto theme
  - Verify respects prefers-color-scheme media query
  - Click theme toggle → verify switches
  - Verify all text remains readable in both modes
  - Verify accent color is consistent across modes
```

---

## Phase 2 — Google Sheets Connector

> Goal: Form responses automatically appear as rows in a Google Sheet. Zero server infrastructure.

### Step 2.1 — Google Apps Script (`scripts/apps-script/sheets-connector.gs`)

A ~40 line Google Apps Script that the user deploys as a web app on their Google Sheet.

```javascript
// The script should:
// 1. Accept POST requests with JSON body containing form responses
// 2. Parse the response data
// 3. On first submission, create header row from field keys
// 4. Append a new row with the response values
// 5. Return success JSON with CORS headers

// Key implementation details:
// - doPost(e) function handles incoming requests
// - Parse e.postData.contents as JSON
// - Get active spreadsheet and first sheet
// - If row 1 is empty, write headers (field titles/IDs)
// - Map response answers to columns in header order
// - Append row with SpreadsheetApp.getActiveSpreadsheet().getActiveSheet().appendRow()
// - Return ContentService.createTextOutput(JSON.stringify({status: "ok"}))
//     .setMimeType(ContentService.MimeType.JSON)

// CORS: Apps Script web apps automatically handle CORS when published as
// "Execute as: Me" and "Who has access: Anyone" — no extra headers needed
```

Create a `SETUP.md` alongside it with step-by-step instructions (with screenshots descriptions):
1. Open your Google Sheet
2. Go to Extensions → Apps Script
3. Delete the default code, paste this script
4. Click Deploy → New deployment
5. Select "Web app", set access to "Anyone"
6. Copy the deployment URL
7. Give this URL to Claude when generating your form, or paste it into the schema's submit config

### Step 2.2 — Sheets Submit Handler Update

The `packages/renderer/src/submit/sheets.ts` handler already exists from Phase 1. Verify it works correctly:

```
Testing (manual + automated):
1. Deploy the Apps Script on a test Google Sheet
2. Generate a form with sheets destination configured
3. Fill out and submit the form
4. Verify row appears in Google Sheet with correct data
5. Submit again → verify second row appends
6. Test from: hosted page (normal origin), local HTML file (null origin), artifact preview
7. Test error handling: wrong URL, script not deployed, sheet deleted

Edge cases to handle:
- Very long text answers (Google Sheets cell limit is 50,000 chars)
- Special characters in answers
- Multi-choice answers (arrays) → join with ", " for cell display
- Rating/scale (numbers) → ensure they're written as numbers not strings
- Date answers → format appropriately
```

### Step 2.3 — Skill Update for Sheets Integration

Update `skill/SKILL.md` to include instructions for Claude on how to offer and configure Google Sheets integration:

```
When generating a form, Claude should ask:
"Want responses sent to a Google Sheet?"

If yes:
1. Ask for the Apps Script deployment URL (or link to SETUP.md for instructions)
2. Add sheets destination to the schema's submit config
3. Also include "excel" destination as fallback

The generated HTML works regardless of whether the Sheets URL is valid —
it just silently fails the Sheets POST and the Excel download still works.
```

---

## Phase 3 — Formant Hosting Service

> Goal: Deploy forms to a public URL. Collect and export responses. The service is a thin Cloudflare Worker.

### Step 3.1 — Database Schema (`packages/service/src/db/schema.sql`)

```sql
-- Forms table: stores the HTML and metadata
CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,                     -- nanoid, 12 chars
  title TEXT,
  html TEXT NOT NULL,                      -- The complete HTML string
  schema_json TEXT NOT NULL,               -- The FormSchema JSON (for export/inspection)
  api_key_hash TEXT,                       -- SHA-256 of creator's API key (for management)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  view_count INTEGER DEFAULT 0,
  submit_count INTEGER DEFAULT 0
);

-- Responses table: stores individual form submissions
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,                     -- nanoid, 16 chars
  form_id TEXT NOT NULL REFERENCES forms(id),
  answers_json TEXT NOT NULL,              -- The answers object as JSON
  metadata_json TEXT,                      -- User agent, duration, etc.
  submitted_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast response queries by form
CREATE INDEX IF NOT EXISTS idx_responses_form_id ON responses(form_id);
CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON responses(submitted_at);
```

### Step 3.2 — API Routes (`packages/service/src/routes/`)

Using Hono framework for routing.

```
POST /api/forms
  - Auth: API key in Authorization header (Bearer token)
  - Body: { html: string, schema: FormSchema }
  - Generates a form ID (nanoid 12 chars)
  - Stores in D1
  - Returns: { id, url: "/f/{id}", created_at }

GET /f/:id
  - Public, no auth
  - Retrieves form HTML from D1
  - Increments view_count
  - Returns HTML with Content-Type: text/html
  - Cache: Cache-Control with stale-while-revalidate

POST /api/responses/:formId
  - Public, no auth (forms need to submit from any origin)
  - CORS: Allow all origins including null
  - Body: FormResponse JSON
  - Validates formId exists
  - Stores in D1
  - Increments form's submit_count
  - Returns: { id, submitted_at }

GET /api/responses/:formId
  - Auth: same API key used to create the form
  - Query params: limit (default 100), offset, since (ISO date)
  - Returns: { responses: FormResponse[], total: number }

GET /api/responses/:formId/xlsx
  - Auth: same API key
  - Generates Excel file from all responses
  - Sheet 1: "Responses" with headers from schema field titles, one row per response
  - Sheet 2: "Summary" with total responses, date range, completion stats
  - Returns: binary xlsx with Content-Disposition: attachment

DELETE /api/forms/:id
  - Auth: same API key
  - Soft delete or hard delete (configurable)
  - Also deletes associated responses
```

### Step 3.3 — CORS Middleware (`packages/service/src/middleware/cors.ts`)

Critical for the "emailed HTML file" use case.

```
CORS configuration:
  - Access-Control-Allow-Origin: * (or reflect the Origin header)
  - Must explicitly handle Origin: null (sent by local HTML files)
  - Access-Control-Allow-Methods: GET, POST, OPTIONS
  - Access-Control-Allow-Headers: Content-Type, Authorization
  - Handle preflight OPTIONS requests

Note: For the response collection endpoint (POST /api/responses/:formId),
we MUST allow any origin since forms can be opened from:
  - A hosted URL (normal origin)
  - A local HTML file (null origin)
  - An email client's preview (varies)
  - Claude's artifact preview (varies)

For management endpoints (GET responses, DELETE form), restrict to API key auth instead.

> **Post-MVP:** Add rate limiting to public endpoints (POST /api/responses/:formId, GET /f/:id)
> to prevent abuse. Consider Cloudflare's built-in rate limiting or a simple in-memory
> sliding window counter. Not scoped for initial implementation.
```

### Step 3.4 — Auth Middleware (`packages/service/src/middleware/auth.ts`)

Simple API key authentication. No user accounts, no sessions.

```
Implementation:
  - On form creation: require Bearer token in Authorization header
  - Hash the token with SHA-256, store hash in the form record
  - On management endpoints: require same Bearer token, hash and compare
  - No user registration — the API key IS the identity
  - Users generate their own keys (any string, recommend UUID v4)

For MVP, this is sufficient. Users include their API key when creating forms
and use the same key to manage them. No database of users needed.
```

### Step 3.5 — Wrangler Configuration

```toml
# wrangler.toml
name = "formant"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "formant-db"
database_id = "" # Filled after wrangler d1 create

# Optional: custom domain
# routes = [{ pattern = "formant.dev/*", zone_name = "formant.dev" }]
```

### Step 3.6 — Service Destination in Renderer

Update `packages/renderer/src/submit/service.ts` to POST to the Formant service:

```
submitToService(formId, endpoint, response):
  - POST to `${endpoint}/api/responses/${formId}`
  - Body: FormResponse JSON
  - No auth needed for submission (public endpoint)
  - Handle errors gracefully: if service is down, other destinations still fire
```

### Step 3.7 — Service Tests

Use **Vitest + `@cloudflare/vitest-pool-workers`** (miniflare bindings) to test against a local D1 database. This simulates the Cloudflare Workers runtime so tests exercise real D1 queries, CORS headers, and Hono routes without deploying.

```
packages/service/__tests__/forms.test.ts:
  - Create form → returns ID and URL
  - Create form without auth → 401
  - Get form HTML → returns correct HTML
  - Get nonexistent form → 404
  - Delete form → success, then GET returns 404

packages/service/__tests__/responses.test.ts:
  - Submit response → 201
  - Submit to nonexistent form → 404
  - Get responses with auth → returns array
  - Get responses without auth → 401
  - Export XLSX → returns valid Excel file
  - Submit from null origin → CORS headers present
```

### Step 3.8 — Deploy Command in Skill

Update the skill so Claude can offer deployment:

```
After generating a form, Claude can offer:
"Want me to deploy this? I'll give you a live URL."

Deployment flow:
1. Claude generates the HTML using html-builder
2. Claude POSTs to Formant service API (user provides API key, or uses a default)
3. Service returns the live URL
4. Claude presents: "Your form is live at formant.dev/f/abc123"

The generated HTML also includes the service as a submit destination,
so responses are collected automatically.
```

---

## Phase 4 — Multi-Destination + Webhook Support

> Goal: Forms can send responses to multiple places simultaneously.

### Step 4.1 — Webhook Handler (`packages/renderer/src/submit/webhook.ts`)

```
Already scaffolded in Phase 1. Now make it robust:
  - Support custom headers (for auth tokens, API keys)
  - Retry logic: 1 retry with 1s delay on 5xx errors
  - Timeout: 10 second fetch timeout
  - Payload: FormResponse JSON with all metadata
```

### Step 4.2 — Multi-Destination Orchestration

```
Update submitResponses() in packages/renderer/src/submit/handler.ts:
  - Fire all destinations with Promise.allSettled (not Promise.all — one failure shouldn't block others)
  - Collect results: { destination: string, success: boolean, error?: string }[]
  - On the ending screen, optionally show submission status:
    - All succeeded: just show success
    - Some failed: show success with subtle note "Some destinations unreachable"
    - All failed: show error state with "Download Excel" fallback
  - Always include Excel download as an option on the ending screen
```

### Step 4.3 — Destination Configuration in Skill

Update skill to support the full destination config:

```
Claude should ask about destinations during form generation:
1. "Where should responses go?"
2. Offer options: Google Sheet, webhook URL, Formant service, Excel download
3. User can pick multiple
4. Claude generates the submit config accordingly

Example generated config:
submit: {
  destinations: [
    { type: "sheets", url: "https://script.google.com/macros/s/.../exec" },
    { type: "service", formId: "abc123", endpoint: "https://formant.dev" },
    { type: "webhook", url: "https://hooks.zapier.com/hooks/catch/123/abc/" },
    { type: "excel", filename: "feedback-responses" }
  ]
}
```

### Step 4.4 — Integration Tests

```
apps/e2e/tests/submit.spec.ts:
  - Mock all external endpoints (MSW or Playwright route interception)
  - Test single destination (each type)
  - Test multi-destination: verify all endpoints receive the POST
  - Test partial failure: one endpoint fails, others succeed
  - Test all fail: verify Excel download fallback appears
  - Test CORS from null origin: open HTML from file://, verify submission works
  - Test response payload structure matches FormResponse type
```

---

## Development Workflow

### Local Development
```bash
pnpm install
pnpm dev          # Starts all packages in watch mode
pnpm test         # Runs vitest in watch mode
pnpm test:e2e     # Runs Playwright tests
pnpm build        # Builds all packages
```

### Testing a Form Locally
```bash
# Generate a test form HTML
pnpm --filter html-builder run build:example

# Open in browser
open packages/html-builder/dist/example.html

# Or serve it
npx serve packages/html-builder/dist
```

### Deploying the Service
```bash
cd packages/service
wrangler d1 create formant-db              # First time only
wrangler d1 execute formant-db --file=src/db/schema.sql  # Run migrations
wrangler deploy                              # Deploy to Cloudflare
```

---

## Agent Segment Breakdown

The plan is divided into independent segments that a fresh agent instance can pick up and execute. Each segment has clear inputs (what must exist before starting), outputs (what it produces), and scope boundaries.

**Dependency graph:**
```
Phase 1A ──► Phase 1B ──► Phase 1C ──► Phase 1D ──► Phase 1E ──► Phase 1F ──► Phase 1G
                │                                                     │
                │                                                     ▼
                └──────────────► Phase 3A ──────────────────► Phase 3B
                                                                │
Phase 1E ──► Phase 2                                            │
                                                                ▼
Phase 1E + Phase 3B ──► Phase 4
```

**Parallelism opportunities:**
- Phase 3A can start as soon as Phase 1B is complete (only needs core types), running in parallel with Phases 1C-1F
- Phase 2 can start as soon as Phase 1E is complete, running in parallel with Phases 1F/1G
- Phase 1G and Phase 3B can run in parallel if both their dependencies are met

---

### Segment: Phase 1A — Project Scaffolding

**Plan steps:** 1.1
**Dependencies:** None (first segment)
**Scope:** Monorepo initialization, pnpm workspace config, all `package.json` files with cross-package deps (`workspace:*`), all `tsconfig.json` files extending base, ESLint, Prettier, Vitest workspace config, complete directory structure with empty placeholder files.
**Output:** A buildable (but empty) monorepo where `pnpm install` succeeds and `pnpm build` runs without errors (even if it produces no output).

**Completion criteria:**
- `pnpm install` succeeds
- All package.json files have correct workspace references
- TypeScript compilation passes (no-emit check) across all packages
- Directory structure matches the Repository Structure section

---

### Segment: Phase 1B — Core Types & Logic

**Plan steps:** 1.2, 1.3, 1.4
**Dependencies:** Phase 1A (project structure exists)
**Scope:** `packages/core/` — all type definitions in `types.ts`, validation functions in `validate.ts`, navigation engine state machine in `engine.ts`, public API exports in `index.ts`, and full unit tests for validation and engine.
**Output:** A fully tested `@formant/core` package. Other packages can import types, validation, and engine functions.

**Completion criteria:**
- All types from Step 1.2 are defined and exported
- `validateField()` handles all field types with tests (Step 1.3)
- `validateSchema()` catches invalid schemas with tests
- Engine state machine functions all work with tests (Step 1.4)
- All tests pass: `pnpm --filter @formant/core test`

---

### Segment: Phase 1C — Renderer Hooks & Shared Components

**Plan steps:** 1.5.1, 1.5.2
**Dependencies:** Phase 1B (core types + engine must be importable)
**Scope:** `packages/renderer/src/hooks/` — `useFormEngine`, `useKeyboard`, `useTheme`. `packages/renderer/src/components/` — `ProgressBar`, `TransitionWrapper`, `KeyboardHint`, `ThemeToggle`, `ErrorMessage`.
**Output:** All hooks and shared UI building blocks, ready to be composed by question components and the main Formant component.

**Completion criteria:**
- `useFormEngine` wraps core engine as React state, handles validation before advance
- `useKeyboard` handles Enter, letter keys, Y/N, number keys, Backspace
- `useTheme` detects system preference, manages toggle, sets `data-theme` attribute
- All shared components render correctly with appropriate props
- Components use CSS custom properties (no hardcoded colors)

---

### Segment: Phase 1D — Renderer Question Components

**Plan steps:** 1.5.3
**Dependencies:** Phase 1C (hooks + shared components exist)
**Scope:** `packages/renderer/src/questions/` — all 12+ question type components (Welcome, TextInput, NumberInput, TextArea, Choice, MultiChoice, Rating, Scale, YesNo, DateInput, Dropdown, Statement, Ending) plus the type registry in `index.ts`.
**Output:** Complete set of question renderers that accept `QuestionProps` and render interactive UI.

**Completion criteria:**
- Every `FieldType` in the type system has a corresponding component
- Question type registry maps `FieldType` → component
- Auto-advance behavior works for Choice, YesNo (300ms delay after selection)
- All components follow the design system (Typeform/Vercel aesthetic, CSS custom properties)
- Keyboard interactions work per question type (letter keys for choice, Y/N, number keys, etc.)

---

### Segment: Phase 1E — Submit Handlers, Main Component & Styles

**Plan steps:** 1.5.4, 1.5.5, 1.5.6
**Dependencies:** Phase 1D (all question components exist)
**Scope:** `packages/renderer/src/submit/` — all submit handlers (handler.ts, sheets.ts, webhook.ts, service.ts, excel.ts). `Formant.tsx` — main component assembling everything with transition management. `styles.ts` — complete CSS as template literal.
**Output:** A fully functional renderer package. Given a schema, it renders a complete interactive form with transitions, keyboard navigation, theming, and submission.

**Completion criteria:**
- `submitResponses()` fires all destinations with `Promise.allSettled`
- Excel download works via SheetJS CDN
- Other submit handlers are scaffolded (sheets, webhook, service) — full robustness comes in later phases
- `Formant` component manages transition phases (entering → active → exiting)
- Styles cover all 22 CSS sections listed in Step 1.5.6
- Dark/light mode toggle works with system detection
- Renderer tests pass

---

### Segment: Phase 1F — HTML Builder

**Plan steps:** 1.6
**Dependencies:** Phase 1E (renderer package is complete)
**Scope:** `packages/html-builder/` — esbuild pipeline to bundle renderer into IIFE, `buildFormHTML()` function that produces self-contained HTML, `template.ts` HTML shell, unit tests. Include a stub `cli.ts` with a `// TODO: Future phase — CLI entry point` comment.
**Output:** Given a `FormSchema` JSON, produces a single self-contained `.html` file (typically 50-80KB) that works anywhere.

**Build pipeline to implement:**
1. esbuild bundles `packages/renderer/` → single JS string (IIFE, externals: react/react-dom, target: ES2020, minified)
2. `buildFormHTML()` interpolates CSS, bundled JS, schema JSON, and CDN script tags
3. Output: standalone HTML file

**Completion criteria:**
- `buildFormHTML(schema)` returns valid HTML string
- HTML includes React 19 + ReactDOM CDN tags
- HTML includes SheetJS CDN tag
- HTML includes inline CSS with all theme variables
- HTML includes bundled renderer JS as IIFE
- Schema is properly embedded as a `const FORM_SCHEMA = {...}` declaration
- Unit tests verify HTML structure
- Generated HTML opens in a browser and renders the form

---

### Segment: Phase 1G — E2E Tests

**Plan steps:** 1.7
**Dependencies:** Phase 1F (can generate HTML files from fixture schemas)
**Scope:** `apps/e2e/` — Playwright config, fixture schemas (simple-form.json, branching-form.json, full-form.json), all test suites (formant, branching, keyboard, validation, theme).
**Output:** Full E2E test coverage of generated forms running in real browsers.

**Completion criteria:**
- All 5 test suites pass
- Tests cover: happy path, branching logic, keyboard navigation, validation errors, theme toggle
- Fixtures cover: simple form (3 questions), branching form, full form (all question types)
- Tests run via `pnpm test:e2e`

---

### Segment: Phase 2 — Google Sheets Connector

**Plan steps:** 2.1, 2.2, 2.3
**Dependencies:** Phase 1E (submit handlers exist in renderer)
**Scope:** `scripts/apps-script/sheets-connector.gs` + `SETUP.md`, verify/harden the Sheets submit handler, update `skill/SKILL.md` with Sheets integration instructions.
**Output:** Working Google Sheets integration with user-facing setup documentation and skill instructions.

**Completion criteria:**
- Apps Script handles POST requests, creates headers on first submit, appends rows
- SETUP.md has clear step-by-step instructions
- Sheets submit handler handles edge cases (long text, special chars, arrays, numbers, dates)
- Skill instructions teach Claude to offer and configure Sheets integration

---

### Segment: Phase 3A — Service Database & Middleware

**Plan steps:** 3.1, 3.3, 3.4, 3.5
**Dependencies:** Phase 1B (core types for FormSchema/FormResponse)
**Scope:** `packages/service/` — D1 schema (schema.sql), typed query helpers (queries.ts), CORS middleware, auth middleware, wrangler.toml config, Hono app skeleton in index.ts.
**Output:** Service infrastructure layer with database, middleware, and config — ready for routes to be added.

**Completion criteria:**
- D1 schema creates forms and responses tables with indexes
- CORS middleware handles null origin and preflight OPTIONS
- Auth middleware validates Bearer tokens against stored SHA-256 hashes
- Wrangler config is valid
- `@cloudflare/vitest-pool-workers` is configured for testing
- Query helpers are typed against the schema

---

### Segment: Phase 3B — Service API Routes & Tests

**Plan steps:** 3.2, 3.6, 3.7, 3.8
**Dependencies:** Phase 3A (DB + middleware ready), Phase 1F (html-builder for form creation flow)
**Scope:** All Hono routes (forms CRUD, response collection, XLSX export), update service submit handler in renderer, full service test suite, skill deployment instructions.
**Output:** Fully functional and tested Cloudflare Worker API that can host forms and collect responses.

**Completion criteria:**
- All 6 API endpoints work (POST forms, GET form HTML, POST responses, GET responses, GET xlsx, DELETE forms)
- Service tests pass using miniflare bindings
- Service submit handler in renderer POSTs to the correct endpoint
- Skill instructions teach Claude to offer deployment
- `wrangler deploy` succeeds (when configured)

---

### Segment: Phase 4 — Multi-Destination & Webhooks

**Plan steps:** 4.1, 4.2, 4.3, 4.4
**Dependencies:** Phase 1E (submit handlers), Phase 3B (service routes)
**Scope:** Robust webhook handler with retries/timeouts, `Promise.allSettled` orchestration with status reporting on ending screen, skill update for destination configuration, integration tests.
**Output:** Forms can submit to multiple destinations simultaneously with graceful failure handling.

**Completion criteria:**
- Webhook handler supports custom headers, 1 retry on 5xx, 10s timeout
- Multi-destination fires all in parallel, reports per-destination status
- Ending screen shows: all succeeded / some failed / all failed (with Excel fallback)
- Skill instructs Claude to ask about destinations and configure multiple
- Integration tests cover all destination types, partial failure, total failure

---

## Future Phases (Not Scoped)

Items intentionally deferred from the current implementation plan. Each is a potential future segment.

### Service Dashboard UI
A web-based management interface for viewing deployed forms, browsing responses, and exporting data. Would share the same design system (Typeform/Vercel aesthetic). Requires a frontend app (likely React or similar) served by the Cloudflare Worker alongside the API routes.

### CLI Entry Point
A terminal command (`formant build schema.json -o form.html`) for developers to generate forms outside of the Claude skill. Stub exists at `packages/html-builder/src/cli.ts`. Would use a library like `commander` or `citty` for arg parsing.

### Rate Limiting
Rate limiting on public endpoints (`POST /api/responses/:formId`, `GET /f/:id`). Options include Cloudflare's built-in rate limiting product or a simple sliding window counter using D1 or Workers KV.

### Form Analytics
View counts, submit counts, completion rates, drop-off points, average completion time. Data already partially captured in the responses table metadata.

### Form Versioning
Allow updating a deployed form while preserving the original schema for existing responses. Requires schema versioning in the forms table.

### Custom Domains
Allow users to serve forms from their own domain via Cloudflare's custom domain routing.