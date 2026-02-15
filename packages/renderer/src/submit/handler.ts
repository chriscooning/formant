import type { FormSchema, FormResponse } from "@formant/core";
import { submitToSheets } from "./sheets";
import { submitToWebhook } from "./webhook";
import { submitToService } from "./service";
import { downloadExcel } from "./excel";
import { saveToLocal } from "./local";

export interface SubmitResult {
  destination: string;
  success: boolean;
  error?: string;
}

export async function submitResponses(
  schema: FormSchema,
  answers: Record<string, unknown>,
  metadata: object
): Promise<SubmitResult[]> {
  const destinations = schema.submit?.destinations ?? [];

  if (destinations.length === 0) {
    return [];
  }

  // Build FormResponse object
  const response: FormResponse = {
    formId: schema.id,
    status: "completed",
    submittedAt: new Date().toISOString(),
    answers,
    metadata: metadata as FormResponse["metadata"],
  };

  // Fire all destinations in parallel — one failure doesn't block others
  const settled = await Promise.allSettled(
    destinations.map(async (dest): Promise<SubmitResult> => {
      switch (dest.type) {
        case "sheets":
          await submitToSheets(dest.url, response, schema);
          return { destination: "sheets", success: true };

        case "webhook":
          await submitToWebhook(dest.url, response, dest.headers);
          return { destination: "webhook", success: true };

        case "service": {
          const endpoint = dest.endpoint ?? "";
          await submitToService(dest.formId, endpoint, response);
          return { destination: "service", success: true };
        }

        case "excel":
          downloadExcel(schema, response, dest.filename);
          return { destination: "excel", success: true };

        case "local":
          await saveToLocal(schema.id, response);
          return { destination: "local", success: true };

        default:
          return {
            destination: "unknown",
            success: false,
            error: `Unknown destination type`,
          };
      }
    })
  );

  // Map PromiseSettledResult to SubmitResult[]
  return settled.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    const destType = destinations[i]?.type ?? "unknown";
    return {
      destination: destType,
      success: false,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });
}
