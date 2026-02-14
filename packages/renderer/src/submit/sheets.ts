import type { FormResponse } from "@formant/core";

/**
 * Submit form response to Google Sheets via Apps Script Web App.
 *
 * Uses `text/plain` Content-Type because Apps Script doesn't support
 * CORS preflight from null origins (e.g. file:// or sandboxed iframes).
 * Falls back to `no-cors` mode if standard CORS fails.
 */
export async function submitToSheets(
  url: string,
  response: FormResponse
): Promise<void> {
  // Flatten answers — use field titles where possible, fall back to IDs
  const body = JSON.stringify({
    ...response.answers,
    _submittedAt: response.submittedAt,
    _formId: response.formId,
  });

  try {
    // Try with CORS first
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body,
    });

    if (!res.ok) {
      throw new Error(`Sheets submission failed: ${res.status} ${res.statusText}`);
    }
  } catch {
    // Fall back to no-cors (opaque response — can't read status, but request still arrives)
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body,
    });
  }
}
