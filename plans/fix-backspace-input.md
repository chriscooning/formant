# Fix: Backspace navigates back instead of deleting text in inputs

## Bug

Pressing Backspace while typing in any text input (text, email, number, phone, url, textarea) navigates the form back to the previous question instead of deleting a character.

## Root Cause

`packages/renderer/src/Formant.tsx` line 48 declares `const [inputFocused, setInputFocused] = useState(false)` but `setInputFocused` is **never called** — it stays `false` forever.

The Backspace handler in `packages/renderer/src/hooks/useKeyboard.ts` (line 41) checks `!inputFocused` before calling `onBack()`. Since it's always `false`, Backspace always triggers back navigation + `preventDefault()`.

## Fix — Option B: Detect focus via `document.activeElement`

### Step 1: Update `useKeyboard.ts`

In `packages/renderer/src/hooks/useKeyboard.ts`, replace the Backspace guard (lines 41–45):

```typescript
// BEFORE:
if (key === "Backspace" && !inputFocused) {
  event.preventDefault();
  onBack();
  return;
}

// AFTER:
if (key === "Backspace") {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return; // Let browser handle Backspace normally in form controls
  }
  event.preventDefault();
  onBack();
  return;
}
```

### Step 2: Remove unused `inputFocused` state from `Formant.tsx`

In `packages/renderer/src/Formant.tsx`:

1. Remove the state declaration: `const [inputFocused, setInputFocused] = useState(false);`
2. Remove `inputFocused` from the `useKeyboard` config object (line ~273)

### Step 3: Remove `inputFocused` from `UseKeyboardConfig`

In `packages/renderer/src/hooks/useKeyboard.ts`:

1. Remove `inputFocused: boolean` from the `UseKeyboardConfig` interface
2. Remove `inputFocused` from the destructured config
3. Remove `inputFocused` from the `useEffect` dependency array

### Step 4: Add E2E test for Backspace in text inputs

In `apps/e2e/tests/keyboard.spec.ts`, add a test:

- Navigate to a text input question
- Type some text (e.g. "Hello")
- Press Backspace
- Verify the form did NOT go back (question title is unchanged)
- Verify the input value lost a character (e.g. "Hell")

### Step 5: Verify

```bash
# TypeScript
pnpm --filter @formant/renderer exec tsc --noEmit

# Unit tests
pnpm --filter @formant/renderer test -- --run

# E2E tests
pnpm test:e2e
```

All 28 E2E tests should still pass, plus the new Backspace test. No regressions expected — the only behavioral change is that Backspace now works correctly in focused inputs.

## Files Changed

| File | Change |
|------|--------|
| `packages/renderer/src/hooks/useKeyboard.ts` | Replace `inputFocused` guard with `document.activeElement` check, remove from interface + deps |
| `packages/renderer/src/Formant.tsx` | Remove `inputFocused` state + usage |
| `apps/e2e/tests/keyboard.spec.ts` | Add Backspace-in-input test |

## Notes

- The Dropdown component (`packages/renderer/src/questions/Dropdown.tsx`) has a searchable text input — this fix covers it automatically since it's an `<input>` element.
- Playwright's `fill()` bypasses keydown events, which is why existing E2E tests never caught this. The new test should use `page.keyboard.press("Backspace")` to exercise the real keydown path.
