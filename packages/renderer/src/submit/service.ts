import type { FormResponse } from "@formant/core";

/**
 * Submit form response to the Formant service API.
 *
 * POSTs to `${endpoint}/api/responses/${formId}`.
 * No authentication required — the submission endpoint is public.
 */
export async function submitToService(
  formId: string,
  endpoint: string,
  response: FormResponse
): Promise<void> {
  const url = `${endpoint}/api/responses/${formId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  });

  if (!res.ok) {
    throw new Error(
      `Service submission failed: ${res.status} ${res.statusText}`
    );
  }
}
