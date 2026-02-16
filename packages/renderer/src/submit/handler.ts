import type { FormSchema, FormResponse } from "@formant/core";
import { submitToSheets } from "./sheets";
import { submitToWebhook } from "./webhook";
import { submitToService } from "./service";
import { downloadExcel, downloadCSV } from "./excel";
import { completePartialToLocal } from "./local";
import { getSessionId } from "../utils/sessionId";
import { getStoredSheetsUrl } from "../utils/sheetsStorage";

export interface SubmitResult {
  destination: string;
  success: boolean;
  error?: string;
}

export interface SubmitOptions {
  /** When set, service destination will PUT to update existing response instead of POST */
  responseId?: string | null;
}

export async function submitResponses(
  schema: FormSchema,
  answers: Record<string, unknown>,
  metadata: object,
  options?: SubmitOptions
): Promise<SubmitResult[]> {
  const storedSheets = await getStoredSheetsUrl(schema.id ?? "form");
  const baseDestinations = schema.submit?.destinations ?? [];
  const sheetsDest = storedSheets?.url
    ? { type: "sheets" as const, url: storedSheets.url }
    : null;
  const destinations = sheetsDest
    ? [...baseDestinations.filter((d) => d.type !== "sheets"), sheetsDest]
    : baseDestinations;

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
          await submitToService(dest.formId, endpoint, response, options?.responseId);
          return { destination: "service", success: true };
        }

        case "excel":
          downloadExcel(schema, response, dest.filename);
          return { destination: "excel", success: true };

        case "csv":
          downloadCSV(schema, response, dest.filename);
          return { destination: "csv", success: true };

        case "local":
          await completePartialToLocal(schema.id, getSessionId(), response);
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
