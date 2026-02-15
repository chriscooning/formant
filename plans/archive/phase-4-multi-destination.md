# Phase 4 — Multi-Destination & Webhook Support

## Goal

Forms can send responses to multiple destinations simultaneously (Sheets + Service + Webhook + Excel). Graceful failure handling: if one destination fails, others still succeed. Ending screen reports per-destination status.

## Prerequisites

- Phase 1E-2 complete (submit handlers + main Formant component)
- Phase 3B complete (service routes — for service destination testing)

## Dependency Graph Position

```
Phase 1E-2 ──► ► Phase 4 ◄ (terminal — no downstream deps in current plan)
Phase 3B   ──►
```

---

## Implementation Spec

### 1. Robust Webhook Handler (`packages/renderer/src/submit/webhook.ts`)

Harden the webhook handler from Phase 1E-1:

```typescript
export async function submitToWebhook(
  url: string,
  response: FormResponse,
  headers?: Record<string, string>
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout
  
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(response),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (res.ok) return;
    
    // Retry once on 5xx
    if (res.status >= 500) {
      await new Promise(r => setTimeout(r, 1000)); // 1s delay
      const retryRes = await fetch(url, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(response),
        signal: AbortSignal.timeout(10_000),
      });
      if (!retryRes.ok) {
        throw new Error(`Webhook returned ${retryRes.status} after retry`);
      }
      return;
    }
    
    throw new Error(`Webhook returned ${res.status}`);
    
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Webhook request timed out (10s)");
    }
    throw error;
  }
}
```

**Features:**
- 10-second timeout via AbortController
- 1 retry with 1-second delay on 5xx server errors
- Custom headers support (for auth tokens, API keys, etc.)
- Clear error messages for timeout, HTTP errors, and network failures
- Does NOT retry on 4xx (client error — won't fix on retry)

### 2. Multi-Destination Orchestration (`packages/renderer/src/submit/handler.ts`)

Update the `submitResponses` function:

```typescript
export async function submitResponses(
  schema: FormSchema,
  answers: Record<string, unknown>,
  metadata: object,
  options?: {
    responseId?: string;  // From auto-save, if exists
  }
): Promise<SubmitResult[]> {
  const destinations = schema.submit?.destinations || [];
  
  if (destinations.length === 0) {
    // No destinations configured — just download Excel as default
    try {
      downloadExcel(schema, buildResponse(schema, answers, metadata, "completed"));
      return [{ destination: "excel", success: true }];
    } catch {
      downloadCSV(schema, buildResponse(schema, answers, metadata, "completed"));
      return [{ destination: "csv-fallback", success: true }];
    }
  }

  const response = buildResponse(schema, answers, metadata, "completed");
  
  // Build field ID → title map (for Sheets)
  const fieldTitleMap: Record<string, string> = {};
  for (const field of schema.fields) {
    fieldTitleMap[field.id] = field.title;
  }

  // Fire ALL destinations in parallel with Promise.allSettled
  const promises = destinations.map(async (dest): Promise<SubmitResult> => {
    try {
      switch (dest.type) {
        case "sheets":
          await submitToSheets(dest.url, response, fieldTitleMap);
          return { destination: "sheets", success: true };
          
        case "webhook":
          await submitToWebhook(dest.url, response, dest.headers);
          return { destination: "webhook", success: true };
          
        case "service":
          // If auto-save was active, update existing response to "completed"
          // Otherwise, create a new response
          await submitToService(
            dest.formId,
            dest.endpoint || "https://formant.dev",
            response,
            options?.responseId
          );
          return { destination: "service", success: true };
          
        case "excel":
          try {
            downloadExcel(schema, response, dest.filename);
          } catch {
            downloadCSV(schema, response, dest.filename);
          }
          return { destination: "excel", success: true };
          
        default:
          return { destination: "unknown", success: false, error: "Unknown destination type" };
      }
    } catch (error) {
      return {
        destination: dest.type,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  const results = await Promise.allSettled(promises);
  
  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { destination: "unknown", success: false, error: String(r.reason) }
  );
}

function buildResponse(
  schema: FormSchema,
  answers: Record<string, unknown>,
  metadata: object,
  status: "in_progress" | "completed"
): FormResponse {
  return {
    formId: schema.id,
    status,
    submittedAt: new Date().toISOString(),
    answers,
    metadata: metadata as FormResponse["metadata"],
  };
}
```

### 3. Ending Screen Status Display

Update the `Ending` component (in `packages/renderer/src/questions/Ending.tsx`) to show submission status:

```typescript
// Ending receives additional props:
interface EndingExtendedProps extends QuestionProps {
  answers: Record<string, unknown>;
  fields: Field[];
  submitResults: SubmitResult[] | null;
  submitting: boolean;
}
```

**Display logic:**
- While `submitting === true`: Show a subtle loading indicator (pulsing dots or spinner, using CSS only)
- When results arrive:
  - **All succeeded**: Show checkmark animation + success message. No mention of destinations.
  - **Some failed**: Show checkmark + success message + small muted note: "Some destinations were unreachable." Optional: show which ones in a collapsible detail.
  - **All failed**: Show warning icon instead of checkmark. Message: "We couldn't send your response, but you can download it." Show prominent "Download Excel" button (or CSV fallback).
- **Always**: Show an "Export your response" link/button at the bottom that triggers Excel/CSV download — regardless of success/failure.

### 4. Update Skill for Destination Configuration

Add to `skill/SKILL.md`:

```markdown
## Multi-Destination Configuration

When generating a form, ask about destinations:
"Where should responses go?"

Offer options:
1. **Google Sheet** — automatic rows in a spreadsheet (requires Apps Script setup)
2. **Webhook** — POST JSON to any URL (Zapier, Make, custom API, etc.)
3. **Formant Service** — hosted collection with export (requires API key)
4. **Excel Download** — client-side file download on completion

Users can pick multiple. Always include Excel as a fallback.

Example multi-destination config:
\`\`\`json
{
  "submit": {
    "destinations": [
      { "type": "sheets", "url": "https://script.google.com/macros/s/.../exec" },
      { "type": "service", "formId": "abc123", "endpoint": "https://formant.dev" },
      { "type": "webhook", "url": "https://hooks.zapier.com/hooks/catch/123/abc/", "headers": { "X-Api-Key": "secret" } },
      { "type": "excel", "filename": "feedback-responses" }
    ]
  }
}
\`\`\`

If one destination fails, others still succeed. Excel download is always available
as a fallback on the completion screen.
```

---

## Integration Tests

### `apps/e2e/tests/submit.spec.ts`

Use Playwright's route interception to mock external endpoints:

```
Setup: Intercept all outgoing fetch requests to mock endpoints.

test: "single destination — Excel download"
  - Load form with only Excel destination
  - Complete the form
  - Verify download is triggered (intercept download event)

test: "single destination — webhook"
  - Mock webhook URL to return 200
  - Load form with webhook destination
  - Complete the form
  - Verify the mock received the POST with correct FormResponse body

test: "single destination — service"
  - Mock service endpoint to return 201
  - Load form with service destination
  - Complete the form
  - Verify POST was made to correct URL

test: "multi-destination — all succeed"
  - Mock sheets + webhook + service URLs
  - Load form with all 4 destinations
  - Complete the form
  - Verify all 3 network destinations received POSTs
  - Verify ending screen shows success (no error message)

test: "partial failure — one endpoint fails"
  - Mock webhook to return 500 (even after retry), others return 200
  - Complete the form
  - Verify other destinations still received their POSTs
  - Verify ending screen shows "Some destinations were unreachable"

test: "total failure — all network destinations fail"
  - Mock all endpoints to fail
  - Complete the form
  - Verify ending screen shows download fallback
  - Verify Excel/CSV download works

test: "CORS from null origin"
  - Open HTML from file:// protocol (or simulate null origin)
  - Submit to mocked service endpoint
  - Verify submission works with null origin

test: "response payload structure"
  - Mock a webhook endpoint
  - Complete a form with various answer types
  - Verify the POST body matches FormResponse interface:
    - formId matches schema ID
    - status is "completed"
    - submittedAt is valid ISO date
    - answers has all field IDs as keys
    - metadata has userAgent and duration
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/renderer/src/submit/webhook.ts` | Replace with robust handler (retry, timeout) |
| `packages/renderer/src/submit/handler.ts` | Replace with multi-destination orchestrator |
| `packages/renderer/src/questions/Ending.tsx` | Add submit status display |
| `packages/renderer/src/Formant.tsx` | Pass submitResults to Ending |
| `skill/SKILL.md` | Add multi-destination section |
| `apps/e2e/tests/submit.spec.ts` | Replace placeholder with integration tests |

## Completion Criteria

```bash
# TypeScript compiles across all packages
pnpm -r exec tsc --noEmit

# Renderer tests pass
pnpm --filter @formant/renderer test

# E2E submit tests pass
pnpm --filter e2e test -- tests/submit.spec.ts
```

- Webhook handler: custom headers, 10s timeout, 1 retry on 5xx
- `submitResponses` fires all destinations with `Promise.allSettled`
- One failure doesn't block other destinations
- Ending screen shows: all succeeded / some failed / all failed with Excel fallback
- "Export your response" button is always visible on ending screen
- CSV fallback works when SheetJS CDN is unavailable
- Skill documents all destination types with examples
- Integration tests cover single, multi, partial failure, and total failure scenarios

## Open Questions

None — all decisions resolved for this segment.
