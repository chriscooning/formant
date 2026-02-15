# Disable Submitter Excel Download on Thank-You Screen

## Goal

Allow forms to hide the "Download Responses" button on the ending/thank-you screen. Submitters see success (or failure) but cannot download their responses as Excel. Use case: kiosk mode, local/IndexedDB forms where the admin exports from the admin panel.

## Current Behavior

- **Formant.tsx** always passes `onDownloadExcel: handleDownloadExcel` to the Ending component when on the ending screen.
- **Ending.tsx** shows a "Download Responses" button when `onDownloadExcel` is truthy.
- The button appears regardless of success/failure (ghost style on success, primary on all-failed).
- Phase 4 plan: "Always show an Export your response link/button at the bottom."

## Implementation

### 1. Schema Option

**File**: `packages/core/src/types.ts`

Add to `submit`:

```ts
submit?: {
  destinations: SubmitDestination[];
  successMessage?: string;
  /** When false, hide the "Download Responses" button on the ending screen. Default: true. */
  allowSubmitterDownload?: boolean;
};
```

### 2. Formant.tsx — Conditional Pass

**File**: `packages/renderer/src/Formant.tsx`

Only pass `onDownloadExcel` when allowed:

```ts
// When building questionProps for ending:
onDownloadExcel: schema.submit?.allowSubmitterDownload !== false ? handleDownloadExcel : undefined,
```

### 3. All-Failed Case

When `allowSubmitterDownload` is false and all destinations fail:
- Ending already shows: "Submission failed — please download your responses below"
- With no button, the message is misleading. Update the copy when download is disabled:

**File**: `packages/renderer/src/questions/Ending.tsx`

```ts
// Line ~124: conditionally change message
{status === "all_failed" && (
  <div className="ff-submit-status ff-submit-status--error" ...>
    {onDownloadExcel
      ? "Submission failed — please download your responses below"
      : "Submission failed. Please try again or contact support."}
    ...
  </div>
)}
```

### 4. Local Build — Auto-Disable

**File**: `packages/html-builder/src/cli.ts`

In `ensureLocalDestination`, when adding local destination, also set `allowSubmitterDownload: false`:

```ts
function ensureLocalDestination(schema: FormSchema): FormSchema {
  const destinations = schema.submit?.destinations ?? [];
  const hasLocal = destinations.some((d) => d && d.type === "local");
  if (!hasLocal) {
    return {
      ...schema,
      submit: {
        ...schema.submit,
        destinations: [...destinations, { type: "local" }],
        allowSubmitterDownload: false,
      },
    };
  }
  // If already has local, ensure allowSubmitterDownload is false for kiosk
  if (schema.submit?.allowSubmitterDownload !== false) {
    return {
      ...schema,
      submit: { ...schema.submit, allowSubmitterDownload: false },
    };
  }
  return schema;
}
```

Or simpler: when `--local`, always set `allowSubmitterDownload: false` on the schema before build.

### 5. Validation (Optional)

**File**: `packages/core/src/validate.ts`

No strict validation needed — `allowSubmitterDownload` is optional boolean. Schema validation can ignore it.

### 6. Tests

**File**: `packages/renderer/__tests__/Formant.test.tsx`

- Add test: when `submit.allowSubmitterDownload === false`, the ending screen does not show the download button (no `[data-testid="download-excel"]`).

**File**: `apps/e2e/tests/submit.spec.ts`

- "excel download button is always visible on ending screen" — update to test a form that has `allowSubmitterDownload: true` (or omit, default).
- Add test: when `allowSubmitterDownload: false`, download button is not visible on ending screen.
- "multi-destination: all fail" — ensure the form used has `allowSubmitterDownload: true` so the download fallback is expected.

**File**: `packages/renderer/__tests__/submit.test.ts`

- No changes needed (submit handler tests don't care about the UI button).

### 7. Documentation

**File**: `.cursor/skills/formant/SKILL.md`

Add to Response Collection or Submit Destinations section:

```markdown
- **allowSubmitterDownload** (optional): When `false`, hides the "Download Responses" button on the thank-you screen. Use for kiosk/local forms where the admin exports from the admin panel. Default: `true`.
```

**File**: `.cursor/skills/formant/schema-reference.md` (if exists)

Document `submit.allowSubmitterDownload` in the submit section.

## Verification

```bash
pnpm -r exec tsc --noEmit
pnpm --filter @formant/renderer test
pnpm test:e2e
```

Manual:
1. Build form with `--local` → open form, submit → no "Download Responses" button.
2. Build form without `--local`, schema has `allowSubmitterDownload: false` → no button.
3. Default (omit or `true`) → button visible.

## Files Changed

| Action | File |
|--------|------|
| Modify | `packages/core/src/types.ts` |
| Modify | `packages/renderer/src/Formant.tsx` |
| Modify | `packages/renderer/src/questions/Ending.tsx` |
| Modify | `packages/html-builder/src/cli.ts` |
| Modify | `packages/renderer/__tests__/Formant.test.tsx` |
| Modify | `apps/e2e/tests/submit.spec.ts` |
| Modify | `.cursor/skills/formant/SKILL.md` |

## Backward Compatibility

- Default `allowSubmitterDownload` is `true` (when omitted) — existing forms unchanged.
- `--local` build explicitly sets `false` for kiosk use case.
