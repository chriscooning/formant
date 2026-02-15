import type { FormResponse } from "@formant/core";

/**
 * Submit form response to the Formant service API.
 *
 * When responseId is provided (from auto-save), PUTs to update existing response.
 * Otherwise POSTs to create new. No authentication required — public endpoint.
 */
export async function submitToService(
  formId: string,
  endpoint: string,
  response: FormResponse,
  responseId?: string | null
): Promise<void> {
  const payload = { ...response, status: "completed" as const };
  const url =
    responseId
      ? `${endpoint}/api/responses/${formId}/${responseId}`
      : `${endpoint}/api/responses/${formId}`;
  const method = responseId ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(
      `Service submission failed: ${res.status} ${res.statusText}`
    );
  }
}
