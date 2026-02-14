# Phase 1B — Core Types, Validation & Engine

## Goal

Implement the complete type system, field validation, and navigation state machine in `@formant/core`. This is the foundational contract between all other packages.

## Prerequisites

- Phase 1A complete (`pnpm install` succeeds, directory structure exists)
- `packages/core/` has placeholder files

## Dependency Graph Position

```
Phase 1A ──► ► Phase 1B ◄ ──► Phase 1C (renderer hooks)
                            ──► Phase 3A (service infra)
```

---

## Implementation Spec

### 1. Types (`packages/core/src/types.ts`)

Define ALL types below. These are the contract between the skill (generates JSON), the renderer (displays forms), and the service (stores them).

```typescript
// ─── Field Types ───

export type FieldType =
  | "welcome"
  | "text"
  | "textarea"
  | "email"
  | "number"
  | "phone"
  | "url"
  | "choice"
  | "multi_choice"
  | "rating"
  | "scale"
  | "yes_no"
  | "date"
  | "dropdown"
  | "statement"
  | "ending";

// ─── Base Field ───

export interface BaseField {
  id: string;                              // Unique identifier, used as answer key
  type: FieldType;
  title: string;                           // The question text
  subtitle?: string;                       // Optional helper text below title
  required?: boolean;                      // Default false
  // Branching: answer→fieldId map or single fieldId for unconditional jump
  next?: Record<string, string> | string;
}

// ─── Type-Specific Fields ───

export interface WelcomeField extends BaseField {
  type: "welcome";
  buttonText?: string;                     // Default "Start"
}

export interface TextField extends BaseField {
  type: "text";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;                        // Regex string for custom validation
}

export interface EmailField extends BaseField {
  type: "email";
  placeholder?: string;                    // Default "you@example.com"
}

export interface NumberField extends BaseField {
  type: "number";
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;                           // Default 1
}

export interface PhoneField extends BaseField {
  type: "phone";
  placeholder?: string;
}

export interface UrlField extends BaseField {
  type: "url";
  placeholder?: string;                    // Default "https://"
}

export interface TextAreaField extends BaseField {
  type: "textarea";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  rows?: number;                           // Default 4
}

export interface ChoiceField extends BaseField {
  type: "choice";
  options: string[];
  allowOther?: boolean;                    // Show "Other" option with free text
}

export interface MultiChoiceField extends BaseField {
  type: "multi_choice";
  options: string[];
  minSelections?: number;                  // Default 1 if required
  maxSelections?: number;
}

export interface RatingField extends BaseField {
  type: "rating";
  max?: number;                            // 1-10, default 5
  labels?: Record<number, string>;         // e.g. { 1: "Poor", 5: "Excellent" }
}

export interface ScaleField extends BaseField {
  type: "scale";
  min: number;                             // e.g. 0 or 1
  max: number;                             // e.g. 10
  minLabel?: string;                       // e.g. "Not likely"
  maxLabel?: string;                       // e.g. "Very likely"
}

export interface YesNoField extends BaseField {
  type: "yes_no";
  yesLabel?: string;                       // Default "Yes"
  noLabel?: string;                        // Default "No"
}

export interface DateField extends BaseField {
  type: "date";
  minDate?: string;                        // ISO date string
  maxDate?: string;
}

export interface DropdownField extends BaseField {
  type: "dropdown";
  options: string[];
  searchable?: boolean;                    // Default false
}

export interface StatementField extends BaseField {
  type: "statement";
  buttonText?: string;                     // Default "Continue"
}

export interface EndingField extends BaseField {
  type: "ending";
  showSummary?: boolean;                   // Show all answers on ending screen
  redirectUrl?: string;
  redirectLabel?: string;
}

// ─── Discriminated Union ───

export type Field =
  | WelcomeField
  | TextField
  | EmailField
  | NumberField
  | PhoneField
  | UrlField
  | TextAreaField
  | ChoiceField
  | MultiChoiceField
  | RatingField
  | ScaleField
  | YesNoField
  | DateField
  | DropdownField
  | StatementField
  | EndingField;

// ─── Submit Destinations ───

export interface SheetsDestination {
  type: "sheets";
  url: string;                             // Google Apps Script web app URL
}

export interface WebhookDestination {
  type: "webhook";
  url: string;
  headers?: Record<string, string>;
}

export interface ServiceDestination {
  type: "service";
  formId: string;
  endpoint?: string;                       // Defaults to production Formant API
}

export interface ExcelDestination {
  type: "excel";                           // Client-side download, no URL needed
  filename?: string;
}

export type SubmitDestination =
  | SheetsDestination
  | WebhookDestination
  | ServiceDestination
  | ExcelDestination;

// ─── Theme ───

export interface ThemeConfig {
  accent?: string;                         // Primary accent color, default #6c5ce7
  accentHover?: string;                    // Hover state, auto-derived if not set
  radius?: string;                         // Border radius, default "10px"
  defaultMode?: "light" | "dark" | "auto"; // Default "auto"
}

// ─── Form Schema ───

export interface FormSchema {
  id: string;
  title?: string;                          // Used in HTML <title> and service
  fields: Field[];
  submit?: {
    destinations: SubmitDestination[];
    successMessage?: string;               // Override ending screen message
  };
  theme?: ThemeConfig;
  meta?: {
    createdAt?: string;
    createdBy?: string;
    version?: number;
  };
}

// ─── Form Response ───

export type ResponseStatus = "in_progress" | "completed";

export interface FormResponse {
  formId: string;
  responseId?: string;                     // Assigned by service on creation
  status: ResponseStatus;                  // Progressive capture: in_progress until final submit
  submittedAt: string;                     // ISO 8601
  answers: Record<string, unknown>;        // fieldId → answer value
  metadata?: {
    userAgent?: string;
    duration?: number;                     // Seconds from start to submit
    completionRate?: number;               // Questions answered / total questions
    lastFieldId?: string;                  // Last field the user was on (for incomplete tracking)
  };
}
```

### 2. Validation (`packages/core/src/validate.ts`)

Two functions:

**`validateField(field: Field, value: unknown): string | null`**
Returns error message string, or null if valid.

Rules per field type:
- **All types (required check)**: If `field.required` is true, value must not be `undefined`, `null`, or empty string `""`. For arrays (multi_choice), must not be empty array.
- **text / textarea**: Check `minLength`, `maxLength` on string value. If `pattern` is set, test against `new RegExp(pattern)`.
- **email**: Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **number**: Must be numeric (not NaN). Check `min`, `max`.
- **url**: Basic URL validation — must start with `http://` or `https://`
- **phone**: Loose check — at least 7 digits, allows `+`, `-`, spaces, parens. International numbers vary too much for strict validation.
- **choice**: Value (string) must be in `field.options` array, OR `field.allowOther === true`.
- **multi_choice**: Value must be an array of strings. Each must be in `field.options`. Array length must be between `minSelections` (default 0, or 1 if required) and `maxSelections` (default unlimited).
- **rating**: Must be integer between 1 and `field.max` (default 5).
- **scale**: Must be integer between `field.min` and `field.max`.
- **yes_no**: Value must be the yesLabel or noLabel (defaults "Yes" / "No").
- **date**: Must be a valid date string (parseable by `new Date()`). If `minDate`/`maxDate` set, must be within range.
- **dropdown**: Value (string) must be in `field.options`.
- **welcome / statement / ending**: Always return null (no input to validate).

**`validateSchema(schema: FormSchema): string[]`**
Returns array of error strings for the schema itself (structural validation).

Checks:
- At least one field
- All field IDs are unique
- An ending field exists
- All branching targets (in `next` maps) reference existing field IDs
- No orphaned branches (field IDs referenced in `next` that don't exist)
- Submit destinations have valid structure (sheets has url, webhook has url, service has formId, excel needs nothing)
- If `next` is a Record, all values are valid field IDs
- If `next` is a string, it's a valid field ID

### 3. Navigation Engine (`packages/core/src/engine.ts`)

Pure functions operating on immutable state. No side effects.

```typescript
export interface EngineState {
  currentIndex: number;
  answers: Record<string, unknown>;
  history: number[];                     // Stack of visited indices for back navigation
  startedAt: number;                     // Date.now() timestamp
}
```

**Functions to implement:**

**`createInitialState(): EngineState`**
- `currentIndex: 0`, `answers: {}`, `history: []`, `startedAt: Date.now()`

**`resolveNextIndex(fields: Field[], currentIndex: number, answer: unknown): number`**
- Get the current field: `fields[currentIndex]`
- If field has `next`:
  - If `next` is a **string**: find field index by ID, return it. If not found, fall through to sequential.
  - If `next` is a **Record**:
    - **For multi_choice fields** (answer is array): check if ANY selected option matches a key in the `next` map. Use the **first matching** key's target. This resolved the multi-choice branching question.
    - **For all other fields**: look up `String(answer)` in the map.
    - If no match found: use `"default"` key if present.
    - If still no match: fall through to sequential.
- Otherwise (no `next`): return `currentIndex + 1`
- If result `>= fields.length`: return `fields.length` (signals completion)

**`goNext(state: EngineState, fields: Field[]): EngineState | null`**
- Get current field and its answer from `state.answers[field.id]`
- Call `resolveNextIndex` to get next index
- Push `currentIndex` onto `history` stack
- Return new state with updated `currentIndex` and `history`
- Return `null` if already at or past end

**`goBack(state: EngineState): EngineState | null`**
- Pop last index from `history` stack
- Return new state with that index as `currentIndex`
- Return `null` if history is empty

**`setAnswer(state: EngineState, fieldId: string, value: unknown): EngineState`**
- Return new state with `answers[fieldId]` set to `value`
- Immutable: spread existing answers

**`getProgress(state: EngineState, fields: Field[]): number`**
- Count "answerable" fields: exclude `welcome`, `ending`, `statement` types
- Count answered questions from `state.answers` (only counting answerable fields)
- Return `Math.round((answered / total) * 100)`
- Clamp to 0-100

**`isComplete(state: EngineState, fields: Field[]): boolean`**
- True if `currentIndex >= fields.length`
- OR if `fields[currentIndex]?.type === "ending"`

### 4. Public API (`packages/core/src/index.ts`)

Re-export everything:
```typescript
export * from "./types";
export * from "./validate";
export * from "./engine";
```

---

## Tests

### `packages/core/__tests__/validate.test.ts`

Test `validateField`:
- **Required fields**: text with required=true, empty value → error. With value → null.
- **Text**: minLength/maxLength boundary cases. Pattern match and mismatch.
- **Email**: valid emails pass, invalid fail (no @, spaces, etc.)
- **Number**: within range passes. Below min, above max → errors. Non-numeric → error.
- **URL**: with http/https → pass. Without protocol → error.
- **Phone**: various international formats (with +, with parens, etc.). Too short → error.
- **Choice**: value in options → pass. Not in options → error. allowOther=true with custom value → pass.
- **Multi-choice**: correct array → pass. Too few selections → error. Too many → error. Non-array → error.
- **Rating**: 1 through max → pass. 0 or above max → error. Non-integer → error.
- **Scale**: within range → pass. Outside → error.
- **Yes/No**: "Yes"/"No" → pass. Custom labels → pass with custom values. Other strings → error.
- **Date**: valid date → pass. Invalid string → error. Before minDate → error. After maxDate → error.
- **Dropdown**: in options → pass. Not in options → error.
- **Welcome/Statement/Ending**: always pass.
- **Edge cases**: undefined value, null value, wrong types (number where string expected, etc.)

Test `validateSchema`:
- Valid minimal schema → empty array
- No fields → error
- Duplicate field IDs → error
- No ending field → error
- Branch target references nonexistent field → error
- Valid branching targets → no error
- Missing URL on sheets destination → error
- Valid multi-destination → no errors

### `packages/core/__tests__/engine.test.ts`

Test `createInitialState`:
- Returns expected default values
- `startedAt` is recent timestamp

Test `resolveNextIndex`:
- **Sequential**: no `next` → returns currentIndex + 1
- **Unconditional jump**: `next: "some-id"` → returns index of that field
- **Conditional branching**: `next: { "A": "field-a", "B": "field-b" }` → correct target per answer
- **Multi-choice branching**: answer `["A", "C"]` with next map `{ "A": "target-a", "B": "target-b" }` → resolves to "target-a" (first match)
- **Default fallback**: answer "X" not in map, but `"default": "fallback"` exists → resolves to fallback
- **No match, no default**: falls through to sequential
- **End of form**: last field → returns fields.length

Test `goNext` / `goBack`:
- Linear 5-question form: advance through all, verify each state
- Go back: verify history pops correctly
- Go back at start: returns null
- Go next at end: returns null

Test branching flow:
- 3 fields: Q1 (choice) → answer "A" → Q-A, answer "B" → Q-B → Ending
- Navigate with answer "A", verify lands on Q-A
- Go back, change answer to "B", verify lands on Q-B
- Verify history is correct through branches

Test `getProgress`:
- 5 answerable questions, 2 answered → 40%
- Exclude welcome/ending/statement from count
- All answered → 100%
- None answered → 0%

Test `isComplete`:
- At ending field → true
- Past all fields → true
- In the middle → false

Test edge cases:
- Single-field form (just ending)
- All optional fields, no answers
- Deep branching (3+ levels): Q1 → Q2a → Q3a → Ending

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/core/src/types.ts` | Replace placeholder with full type definitions |
| `packages/core/src/validate.ts` | Replace placeholder with validation functions |
| `packages/core/src/engine.ts` | Replace placeholder with engine functions |
| `packages/core/src/index.ts` | Replace placeholder with re-exports |
| `packages/core/__tests__/validate.test.ts` | Replace placeholder with full test suite |
| `packages/core/__tests__/engine.test.ts` | Replace placeholder with full test suite |

## Completion Criteria

```bash
# All tests pass
pnpm --filter @formant/core test

# TypeScript compiles clean
pnpm --filter @formant/core exec tsc --noEmit

# Types are importable from other packages (spot check)
# (Verified when Phase 1C starts)
```

## Open Questions

None — all decisions resolved for this segment.
