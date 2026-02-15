# Phase 1E-1 — Styles & Submit Handlers

## Goal

Implement the complete CSS design system as a template literal and all submit destination handlers. These are largely independent of each other but both must exist before the main Formant component can be assembled.

## Prerequisites

- Phase 1D complete (all question components exist and use the CSS class names defined here)
- `@formant/core` types importable

## Dependency Graph Position

```
Phase 1D ──► ► Phase 1E-1 ◄ ──► Phase 1E-2 (main component)
```

---

## Implementation Spec — Styles

### `packages/renderer/src/styles.ts`

Export a single template literal string containing ALL CSS. The HTML builder will inject this into a `<style>` tag.

```typescript
export const formantStyles = `
  /* All CSS here */
`;
```

#### Structure the CSS in this exact order:

**1. Google Fonts Import**
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500&family=Space+Mono:wght@400&display=swap');
```

**2. :root variables (dark mode defaults)**
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

**3. @media (prefers-color-scheme: light) overrides**
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

**4. [data-theme="light"] overrides** (manual toggle — overrides media query)
Same values as light mode media query above.

**5. [data-theme="dark"] overrides** (manual toggle — overrides media query)
Same values as dark mode defaults.

**6. Reset**
```css
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
```

**7. Base**
```css
html, body {
  height: 100%;
  font-family: var(--ff-font-sans);
  background: var(--ff-bg);
  color: var(--ff-text);
  -webkit-font-smoothing: antialiased;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}
```

**8. Progress bar**
```css
.ff-progress { position: fixed; top: 0; left: 0; width: 100%; height: 2px; z-index: 100; }
.ff-progress-bar { height: 100%; background: var(--ff-accent); transition: width var(--ff-transition-slow); }
```

**9. Question container + transition states**
- `.ff-question-container` — max-width: 600px, width: 100%
- `.ff-transition` — base transition container
- `.ff-transition-entering` — opacity 0, translateY(20px)
- `.ff-transition-active` — opacity 1, translateY(0), transition all var(--ff-transition-slow)
- `.ff-transition-exiting` — opacity 0, translateY(-20px), transition all var(--ff-transition)

**10. Typography**
- `.ff-question-number` — font: var(--ff-font-mono), 9px, uppercase, letter-spacing: 3px, color: var(--ff-text-secondary), margin-bottom: 16px
- `.ff-question-title` — font: var(--ff-font-sans), 500 weight, 22px, margin-bottom: 8px
- `.ff-question-subtitle` — font: var(--ff-font-sans), 300 weight, 15px, color: var(--ff-text-secondary), margin-bottom: 32px

**11. Input styles**
- `.ff-input-underline` — border: none, border-bottom: 1px solid var(--ff-border), background: transparent, font-size: 18px, font-family: var(--ff-font-sans), color: var(--ff-text), padding: 12px 0, width: 100%, outline: none. Focus: border-color var(--ff-accent).
- `.ff-textarea` — similar but with full border, border-radius var(--ff-radius), padding 16px, resize: vertical
- `.ff-date-input` — styled native date input matching theme

**12. Choice cards + stagger animation**
- `.ff-choice-list` — display flex, flex-direction column, gap 12px
- `.ff-choice-card` — border 1px solid var(--ff-border), padding 28px 24px, border-radius var(--ff-radius), cursor pointer, display flex, align-items center, gap 16px, transition: all var(--ff-transition)
- `.ff-choice-card:hover` — border-color var(--ff-border-hover), background var(--ff-surface-hover), transform translateY(-2px)
- `.ff-choice-card--selected` — border-color var(--ff-accent), background var(--ff-accent-glow)
- `.ff-choice-key` — font: var(--ff-font-mono), 11px, border 1px solid var(--ff-border), border-radius 4px, padding 2px 8px, min-width 28px, text-align center
- Stagger animation: `@keyframes ff-stagger-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`
- `.ff-choice-card { animation: ff-stagger-in 0.3s ease forwards; opacity: 0; }` with `animation-delay` set inline per card

**13. Rating stars**
- `.ff-rating-stars` — display flex, gap 8px
- `.ff-star` — font-size 28px, cursor pointer, transition color var(--ff-transition), color var(--ff-text-muted)
- `.ff-star--filled` — color var(--ff-accent)
- `.ff-star--hover` — color var(--ff-accent), opacity 0.7

**14. Scale buttons**
- `.ff-scale-buttons` — display flex, gap 8px, flex-wrap wrap
- `.ff-scale-btn` — font: var(--ff-font-mono), min-width 44px, height 44px, border 1px solid var(--ff-border), border-radius var(--ff-radius), cursor pointer, background transparent, color var(--ff-text)
- `.ff-scale-btn:hover` — background var(--ff-surface-hover)
- `.ff-scale-btn--selected` — background var(--ff-accent), color white, border-color var(--ff-accent)
- `.ff-scale-labels` — display flex, justify-content space-between, margin-top 8px, font: var(--ff-font-mono), 9px, color var(--ff-text-muted)

**15. Yes/No cards**
- `.ff-yesno` — display grid, grid-template-columns 1fr 1fr, gap 16px
- `.ff-yesno-card` — same as choice card style but centered text, padding 40px 24px
- `.ff-yesno-hint` — font: var(--ff-font-mono), 11px, color var(--ff-text-muted), margin-top 8px

**16. Dropdown**
- `.ff-dropdown` — position relative
- `.ff-dropdown-trigger` — styled like underline input with a chevron indicator
- `.ff-dropdown-list` — position absolute, top 100%, left 0, width 100%, background var(--ff-surface), border 1px solid var(--ff-border), border-radius var(--ff-radius), max-height 240px, overflow-y auto, z-index 10
- `.ff-dropdown-option` — padding 12px 16px, cursor pointer. Hover: background var(--ff-surface-hover)
- `.ff-dropdown-option--highlighted` — background var(--ff-accent-glow)
- `.ff-dropdown-search` — sticky top, padding 12px 16px, border-bottom 1px solid var(--ff-border)

**17. Buttons**
- `.ff-btn-primary` — background var(--ff-accent), color white, border none, padding 10px 24px, border-radius 8px, font-family var(--ff-font-sans), font-size 14px, cursor pointer, transition all var(--ff-transition)
- `.ff-btn-primary:hover` — background var(--ff-accent-hover), transform translateY(-1px)
- `.ff-btn-primary:active` — transform translateY(0)
- `.ff-btn-ghost` — background transparent, border 1px solid var(--ff-border), color var(--ff-text), same padding/radius/cursor. Hover: border-color var(--ff-border-hover), background var(--ff-surface-hover)

**18. Error state + shake animation**
```css
.ff-error-message {
  color: var(--ff-error);
  font-family: var(--ff-font-mono);
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 3px;
  margin-top: 12px;
  animation: ff-shake 0.3s ease;
}

@keyframes ff-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
```

**19. Keyboard hints**
- `.ff-keyboard-hint` — position fixed, bottom 24px, left 50%, transform translateX(-50%), display flex, gap 8px, align-items center
- `kbd` elements: font-family var(--ff-font-mono), font-size 11px, color var(--ff-text-muted), border 1px solid var(--ff-border), border-radius 4px, padding 2px 8px, background var(--ff-surface)

**20. Theme toggle**
- `.ff-theme-toggle` — position fixed, top 16px, right 16px, background transparent, border 1px solid var(--ff-border), border-radius 20px, padding 6px 12px, cursor pointer, font-family var(--ff-font-mono), color var(--ff-text-muted), z-index 100
- `.ff-theme-toggle:hover` — border-color var(--ff-border-hover)

**21. Ending screen + checkmark animation**
- `.ff-ending` — text-align center, display flex, flex-direction column, align-items center
- Checkmark circle animation:
```css
.ff-ending-circle {
  width: 64px; height: 64px; border-radius: 50%;
  border: 2px solid var(--ff-accent);
  background: var(--ff-accent-glow);
  display: flex; align-items: center; justify-content: center;
  animation: ff-scale-in 0.3s ease;
  margin-bottom: 24px;
}

.ff-ending-check {
  width: 20px; height: 10px;
  border-left: 2px solid var(--ff-accent);
  border-bottom: 2px solid var(--ff-accent);
  transform: rotate(-45deg) translateY(-2px);
  animation: ff-check-draw 0.2s ease 0.3s forwards;
  opacity: 0;
}

@keyframes ff-scale-in { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes ff-check-draw { to { opacity: 1; } }
```

- `.ff-ending-summary` — margin-top 32px, width 100%, max-width 480px
- `.ff-ending-summary-item` — display flex, justify-content space-between, padding 12px 0, border-bottom 1px solid var(--ff-border)

**22. Responsive**
```css
@media (max-width: 640px) {
  #root { padding: 24px 16px; }
  .ff-question-title { font-size: 18px; }
  .ff-yesno { grid-template-columns: 1fr; }
  .ff-choice-card { padding: 20px 16px; }
  .ff-scale-buttons { gap: 4px; }
  .ff-scale-btn { min-width: 36px; height: 36px; }
}
```

---

## Implementation Spec — Submit Handlers

### `packages/renderer/src/submit/handler.ts`

Main orchestrator. Called on form completion.

```typescript
import type { FormSchema, FormResponse, SubmitDestination } from "@formant/core";

export interface SubmitResult {
  destination: string;    // e.g. "sheets", "webhook", "service", "excel"
  success: boolean;
  error?: string;
}

export async function submitResponses(
  schema: FormSchema,
  answers: Record<string, unknown>,
  metadata: object
): Promise<SubmitResult[]> {
  // 1. Build FormResponse object
  // 2. For each destination in schema.submit.destinations
  //    call the appropriate handler
  // 3. Fire ALL in parallel with Promise.allSettled (one failure doesn't block others)
  // 4. Map PromiseSettledResult to SubmitResult[]
  // 5. Return results array
}
```

### `packages/renderer/src/submit/sheets.ts`

```typescript
export async function submitToSheets(url: string, response: FormResponse): Promise<void>
```

- POST to Google Apps Script URL
- Body: JSON with **flattened answers** — use field titles as keys, not IDs (for readable spreadsheet headers)
- Content-Type: `text/plain` (Apps Script quirk for CORS from null origin)
- Try `mode: "cors"` first, fall back to `mode: "no-cors"` if CORS fails
- Throws on network error

### `packages/renderer/src/submit/webhook.ts`

```typescript
export async function submitToWebhook(
  url: string,
  response: FormResponse,
  headers?: Record<string, string>
): Promise<void>
```

- POST JSON to the URL with Content-Type application/json
- Include optional custom headers
- Timeout: 10 seconds (AbortController)
- Basic retry: 1 retry with 1s delay on 5xx errors
- Throws on final failure

### `packages/renderer/src/submit/service.ts`

```typescript
export async function submitToService(
  formId: string,
  endpoint: string,
  response: FormResponse
): Promise<void>
```

- POST to `${endpoint}/api/responses/${formId}`
- Body: FormResponse JSON
- No auth needed for submission (public endpoint)
- Throws on error

### `packages/renderer/src/submit/excel.ts`

```typescript
declare var XLSX: any; // Loaded from CDN at runtime

export function downloadExcel(
  schema: FormSchema,
  response: FormResponse,
  filename?: string
): void
```

- **SheetJS is loaded from CDN at runtime** (`https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`). It is NOT bundled — it requires an internet connection.
- Check if `XLSX` global exists. If not, fall back to CSV download (see below).
- Sheet 1 "Responses": field titles as headers, values as first row
  - Arrays (multi_choice) → join with ", "
  - Rating/scale → write as numbers
  - Date → format as ISO string
- Sheet 2 "Metadata": submission timestamp, duration, completion rate
- Trigger browser download via blob + anchor click trick
- Default filename: `${schema.title || "formant"}-responses.xlsx`

**CSV Fallback** (for offline — no SheetJS available):
```typescript
export function downloadCSV(
  schema: FormSchema,
  response: FormResponse,
  filename?: string
): void
```
- Generate a simple CSV string (field titles as headers, values as row)
- Escape commas and quotes properly
- Trigger download as `.csv` file
- This works fully offline — no library needed

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/renderer/src/styles.ts` | Replace placeholder with complete CSS template literal |
| `packages/renderer/src/submit/handler.ts` | Replace placeholder with orchestrator |
| `packages/renderer/src/submit/sheets.ts` | Replace placeholder with Sheets handler |
| `packages/renderer/src/submit/webhook.ts` | Replace placeholder with webhook handler |
| `packages/renderer/src/submit/service.ts` | Replace placeholder with service handler |
| `packages/renderer/src/submit/excel.ts` | Replace placeholder with Excel + CSV handlers |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/renderer exec tsc --noEmit
```

- `formantStyles` string contains all 22 CSS sections
- All CSS custom properties are correct for dark and light modes
- `[data-theme="light"]` and `[data-theme="dark"]` selectors exist
- Submit handlers compile and export correct signatures
- CSV fallback exists for offline Excel scenario
- `submitResponses` uses `Promise.allSettled` (not `Promise.all`)

## Open Questions

None — all decisions resolved for this segment.
