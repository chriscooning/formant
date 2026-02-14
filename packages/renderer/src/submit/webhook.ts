import type { FormResponse } from "@formant/core";

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

/**
 * Submit form response to a webhook URL.
 *
 * - Sends JSON payload with optional custom headers
 * - 10-second timeout via AbortController
 * - Basic retry: 1 retry with 1s delay on 5xx errors
 * - Throws on final failure
 */
export async function submitToWebhook(
  url: string,
  response: FormResponse,
  headers?: Record<string, string>
): Promise<void> {
  const body = JSON.stringify(response);

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body,
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // First attempt
  let res = await attempt();

  // Retry once on 5xx
  if (res.status >= 500) {
    await delay(RETRY_DELAY_MS);
    res = await attempt();
  }

  if (!res.ok) {
    throw new Error(
      `Webhook submission failed: ${res.status} ${res.statusText}`
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
