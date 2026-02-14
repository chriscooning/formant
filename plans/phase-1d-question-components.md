# Phase 1D — Question Components

## Goal

Implement all 13 question type components plus the type registry. Each component renders an interactive question following the Typeform/Vercel design aesthetic.

## Prerequisites

- Phase 1C complete (hooks: `useFormEngine`, `useKeyboard`, `useTheme` + shared components exist)
- `@formant/core` types importable

## Dependency Graph Position

```
Phase 1C ──► ► Phase 1D ◄ ──► Phase 1E-1 (styles + submit)
```

---

## Design System Reference

All components must follow these specs. Use CSS class names — actual CSS is implemented in Phase 1E-1 (`styles.ts`).

### Typography
```
Question number label:  Space Mono 400, 9px, letter-spacing: 3px, uppercase, var(--ff-text-secondary)
Question title:         Outfit 500, 22px, var(--ff-text)
Question subtitle:      Outfit 300, 15px, var(--ff-text-secondary)
Input text:             Outfit 300, 18px, var(--ff-text)
Button text:            Outfit 400, 14px
```

### Common Props

Every question component receives:
```typescript
interface QuestionProps<T = unknown> {
  field: Field;               // The field definition (narrowed to specific type inside each component)
  value: T;                   // Current answer value
  onChange: (value: T) => void;
  error: string | null;
  questionNumber: number;     // Display as "Question 3" — 1-indexed, excludes welcome/statement/ending
  totalQuestions: number;     // Total answerable questions
  onNext: () => void;         // For auto-advance or explicit "Continue" button
}
```

Export this interface from `packages/renderer/src/questions/index.ts`.

---

## Implementation Spec

### `Welcome.tsx`

**Field type:** `WelcomeField`

**Layout:** Centered vertically and horizontally. No question number.

**Elements:**
- Title: Outfit 300, 28px (larger than normal questions)
- Subtitle: Outfit 300, 15px, `var(--ff-text-secondary)`, margin-top: 12px
- CTA Button: `field.buttonText || "Start"`, primary button style, margin-top: 40px
- Button click → `onNext()`

**CSS classes:** `ff-welcome`, `ff-welcome-title`, `ff-welcome-subtitle`, `ff-welcome-btn`

### `TextInput.tsx`

**Field types:** `TextField`, `EmailField`, `PhoneField`, `UrlField`

This component handles all single-line text input types. Determine the HTML input type from `field.type`:
- `text` → `type="text"`
- `email` → `type="email"`
- `phone` → `type="tel"`
- `url` → `type="url"`

**Layout:**
- Question number label (Space Mono, 9px, uppercase): `QUESTION {questionNumber} OF {totalQuestions}`
- Title: Outfit 500, 22px
- Subtitle (if exists): Outfit 300, 15px, muted
- Input: Transparent background, border-bottom only (1px solid `var(--ff-border)`). On focus: border-color `var(--ff-accent)`.
- Placeholder: `var(--ff-text-muted)`
- Auto-focus on mount (`useEffect` + `ref.focus()`)

**CSS classes:** `ff-question`, `ff-question-number`, `ff-question-title`, `ff-question-subtitle`, `ff-input`, `ff-input-underline`

**Error:** Render `<ErrorMessage>` below input when `error` is set.

### `NumberInput.tsx`

**Field type:** `NumberField`

**Layout:** Same as TextInput but:
- `type="number"`
- Apply `min`, `max`, `step` attributes from field
- Input mode: `inputMode="numeric"`
- Value is number, not string: `onChange` should convert

**CSS classes:** Same as TextInput

### `TextArea.tsx`

**Field type:** `TextAreaField`

**Layout:**
- Question number + title + subtitle (same as TextInput)
- `<textarea>` with border: 1px solid `var(--ff-border)`, border-radius: `var(--ff-radius)`, padding: 16px
- Rows: `field.rows || 4`
- Placeholder: `var(--ff-text-muted)`
- Below textarea: "OK ✓" button (since Enter creates newlines). Button appears once there's content.
- Character count if `maxLength` is set: `{current}/{max}` in muted text, bottom-right

**Important:** Enter key should NOT advance — it types a newline. Shift+Enter or the "OK" button advances. The `useKeyboard` hook already handles this (skips Enter for textarea).

**CSS classes:** `ff-textarea`, `ff-textarea-ok`, `ff-char-count`

### `Choice.tsx`

**Field type:** `ChoiceField`

**Layout:**
- Question number + title + subtitle
- Vertical stack of choice cards, one per option
- Each card:
  - Left: Letter key in a bordered pill (e.g., "A", "B", "C") — Space Mono
  - Right: Option label text — Outfit
  - Border: 1px solid `var(--ff-border)`
  - Padding: 28px 24px
  - Border-radius: `var(--ff-radius)` (10px)
  - Hover: border-color `var(--ff-border-hover)`, bg `var(--ff-surface-hover)`, translateY(-2px)
  - Selected: border-color `var(--ff-accent)`, bg `var(--ff-accent-glow)`
- Cards stagger-animate in: 50ms delay each (use inline style `animation-delay`)
- If `allowOther`: render an extra card "Other" with a text input that appears on selection

**Auto-advance:** On selection, wait 300ms then call `onNext()`. Use `setTimeout` with cleanup.

**Keyboard:** Letter keys A, B, C, ... map to options by index. Handled by parent via `onSelect` prop from `useKeyboard`.

**CSS classes:** `ff-choice-list`, `ff-choice-card`, `ff-choice-key`, `ff-choice-label`, `ff-choice-card--selected`, `ff-choice-other-input`

### `MultiChoice.tsx`

**Field type:** `MultiChoiceField`

**Layout:** Same card style as Choice but:
- Checkbox indicator instead of letter key (a square that fills with accent on check)
- No auto-advance — clicking toggles selection
- Show "Continue" button at bottom, only visible when selections >= `minSelections` (default 1 if required, 0 if not)
- The value is an array of selected option strings

**Keyboard:** Letter keys toggle selection (add/remove from array).

**CSS classes:** `ff-multi-list`, `ff-multi-card`, `ff-multi-check`, `ff-multi-check--checked`, `ff-multi-continue`

### `Rating.tsx`

**Field type:** `RatingField`

**Layout:**
- Question number + title
- Row of star characters: `★` (filled) and `☆` (unfilled)
- `field.max || 5` stars total
- Filled stars: `var(--ff-accent)` color
- Unfilled stars: `var(--ff-text-muted)` or grayscale
- Hover: fill up to hovered star (hover state)
- Click: set rating
- Optional labels below, positioned at edges or specific ratings (`field.labels`)
- Auto-advance after 400ms on selection

**Keyboard:** Number keys 1-9 (and 0 for 10) set rating directly.

**CSS classes:** `ff-rating`, `ff-rating-stars`, `ff-star`, `ff-star--filled`, `ff-star--hover`, `ff-rating-labels`

### `Scale.tsx`

**Field type:** `ScaleField`

**Layout:**
- Question number + title
- Horizontal row of number buttons from `field.min` to `field.max`
- Each button: Space Mono, border pill, min-width 44px, centered number
- Selected button: bg `var(--ff-accent)`, color white
- Unselected: transparent bg, `var(--ff-border)` border
- Hover: `var(--ff-surface-hover)` bg
- Min/max labels below at edges: `field.minLabel` (left), `field.maxLabel` (right)
- Auto-advance after 400ms on selection

**Keyboard:** Number keys directly select that value.

**CSS classes:** `ff-scale`, `ff-scale-buttons`, `ff-scale-btn`, `ff-scale-btn--selected`, `ff-scale-labels`

### `YesNo.tsx`

**Field type:** `YesNoField`

**Layout:**
- Question number + title
- Two large side-by-side cards
- Left card: `field.yesLabel || "Yes"` with small `Y` key hint below
- Right card: `field.noLabel || "No"` with small `N` key hint below
- Card style: same as choice cards but wider (flex: 1)
- Selected card: accent border + glow

**Auto-advance:** 300ms after selection, call `onNext()`.

**Keyboard:** Y key selects yes, N key selects no.

**CSS classes:** `ff-yesno`, `ff-yesno-card`, `ff-yesno-card--selected`, `ff-yesno-hint`

### `DateInput.tsx`

**Field type:** `DateField`

**Layout:**
- Question number + title + subtitle
- Native `<input type="date">` styled to match theme
- Set `min` and `max` attributes from `field.minDate` / `field.maxDate`
- Styled with custom appearance: override browser default date picker chrome as much as possible
- Fallback: ensure at minimum the input is readable in both dark/light modes

**CSS classes:** `ff-date-input`

### `Dropdown.tsx`

**Field type:** `DropdownField`

**Layout:**
- Question number + title + subtitle
- If `field.searchable === true`:
  - Text input for filtering, with dropdown list below
  - Filter options as user types (case-insensitive)
  - Show matched options in a list below input
  - Click or Enter selects
  - Arrow keys navigate the list
- If not searchable:
  - Custom styled `<select>` alternative (a button that opens a list)
  - Or: a dropdown trigger that opens a list of options
- Selected state: show the selected value in the trigger area

**CSS classes:** `ff-dropdown`, `ff-dropdown-trigger`, `ff-dropdown-list`, `ff-dropdown-option`, `ff-dropdown-option--highlighted`, `ff-dropdown-search`

### `Statement.tsx`

**Field type:** `StatementField`

**Layout:** Similar to Welcome but can appear mid-form.
- Centered: title + optional subtitle
- "Continue →" button (`field.buttonText || "Continue"`)
- No question number, no input
- Button click → `onNext()`

**CSS classes:** `ff-statement`, `ff-statement-title`, `ff-statement-subtitle`, `ff-statement-btn`

### `Ending.tsx`

**Field type:** `EndingField`

**Layout:** Centered.
- CSS-only animated checkmark in a circle:
  - Circle: border 2px solid `var(--ff-accent)`, 64px × 64px, border-radius 50%
  - Background: `var(--ff-accent-glow)`
  - Checkmark: CSS border trick (rotated L-shape), animated with stroke-dashoffset or scale+opacity
  - Animation: circle scales in (0 → 1, 300ms), then checkmark draws (200ms delay)
- Title: below checkmark, Outfit 500, 22px
- Subtitle: Outfit 300, 15px, muted
- If `field.showSummary`:
  - Render each answered field as label + value pair in a card surface
  - Labels: Space Mono 9px uppercase
  - Values: Outfit 300 15px
  - Card: `var(--ff-surface)` bg, 1px border, 10px radius, padding 24px
  - Multi-choice values: join with ", "
  - Rating: show stars
  - Scale: show number
- If `field.redirectUrl`: show a link/button to redirect
- No question number

**Props extension:** Ending also receives `answers: Record<string, unknown>` and `fields: Field[]` for the summary.

**CSS classes:** `ff-ending`, `ff-ending-checkmark`, `ff-ending-circle`, `ff-ending-check`, `ff-ending-title`, `ff-ending-summary`, `ff-ending-summary-item`, `ff-ending-redirect`

### Question Type Registry (`packages/renderer/src/questions/index.ts`)

```typescript
import type { FieldType } from "@formant/core";
import { Welcome } from "./Welcome";
import { TextInput } from "./TextInput";
import { NumberInput } from "./NumberInput";
import { TextArea } from "./TextArea";
import { Choice } from "./Choice";
import { MultiChoice } from "./MultiChoice";
import { Rating } from "./Rating";
import { Scale } from "./Scale";
import { YesNo } from "./YesNo";
import { DateInput } from "./DateInput";
import { Dropdown } from "./Dropdown";
import { Statement } from "./Statement";
import { Ending } from "./Ending";

export { QuestionProps } from "./types"; // or define inline

// Map field type to component
export const questionRegistry: Record<FieldType, React.ComponentType<QuestionProps<any>>> = {
  welcome: Welcome,
  text: TextInput,
  email: TextInput,
  phone: TextInput,
  url: TextInput,
  number: NumberInput,
  textarea: TextArea,
  choice: Choice,
  multi_choice: MultiChoice,
  rating: Rating,
  scale: Scale,
  yes_no: YesNo,
  date: DateInput,
  dropdown: Dropdown,
  statement: Statement,
  ending: Ending,
};
```

Note: `text`, `email`, `phone`, `url` all map to `TextInput` — it handles the different HTML input types internally.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/renderer/src/questions/Welcome.tsx` | Implement |
| `packages/renderer/src/questions/TextInput.tsx` | Implement |
| `packages/renderer/src/questions/NumberInput.tsx` | Implement |
| `packages/renderer/src/questions/TextArea.tsx` | Implement |
| `packages/renderer/src/questions/Choice.tsx` | Implement |
| `packages/renderer/src/questions/MultiChoice.tsx` | Implement |
| `packages/renderer/src/questions/Rating.tsx` | Implement |
| `packages/renderer/src/questions/Scale.tsx` | Implement |
| `packages/renderer/src/questions/YesNo.tsx` | Implement |
| `packages/renderer/src/questions/DateInput.tsx` | Implement |
| `packages/renderer/src/questions/Dropdown.tsx` | Implement |
| `packages/renderer/src/questions/Statement.tsx` | Implement |
| `packages/renderer/src/questions/Ending.tsx` | Implement |
| `packages/renderer/src/questions/index.ts` | Implement registry + export QuestionProps |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/renderer exec tsc --noEmit
```

- Every `FieldType` in the type system has a corresponding component
- Question type registry maps all types correctly (text/email/phone/url → TextInput)
- Auto-advance behavior: Choice and YesNo auto-advance after 300ms, Rating and Scale after 400ms
- All components use CSS class names from the spec (no inline styles for colors/fonts)
- Components are exportable and renderable (visual verification in Phase 1G E2E tests)

## Open Questions

None — all decisions resolved for this segment.
