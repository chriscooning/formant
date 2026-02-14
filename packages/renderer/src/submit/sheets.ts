import type { FormSchema, FormResponse, Field } from "@formant/core";

/** Google Sheets cell character limit */
const SHEETS_CELL_LIMIT = 50_000;

/**
 * Submit form response to Google Sheets via Apps Script Web App.
 *
 * Uses `text/plain` Content-Type because Apps Script doesn't support
 * CORS preflight from null origins (e.g. file:// or sandboxed iframes).
 * Falls back to `no-cors` mode if standard CORS fails.
 */
export async function submitToSheets(
  url: string,
  response: FormResponse,
  schema: FormSchema
): Promise<void> {
  const body = JSON.stringify(flattenForSheets(schema, response));

  try {
    // Try with CORS first
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "text/plain" },
      body,
    });

    if (!res.ok) {
      throw new Error(
        `Sheets submission failed: ${res.status} ${res.statusText}`
      );
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

/**
 * Flatten a FormResponse into a plain key-value object suitable for a
 * spreadsheet row. Uses field titles as keys (falling back to IDs),
 * and normalises values for Sheets compatibility.
 */
export function flattenForSheets(
  schema: FormSchema,
  response: FormResponse
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const field of schema.fields) {
    // Skip non-input fields
    if (isNonInputField(field)) continue;

    const key = field.title || field.id;
    const raw = response.answers[field.id];

    row[key] = normaliseCellValue(raw);
  }

  // Append metadata with _ prefix so the Apps Script can distinguish them
  row["_formId"] = response.formId;
  row["_submittedAt"] = response.submittedAt;

  if (response.metadata?.duration != null) {
    row["_duration"] = response.metadata.duration;
  }
  if (response.metadata?.completionRate != null) {
    row["_completionRate"] = response.metadata.completionRate;
  }

  return row;
}

/**
 * Convert a raw answer value into something Sheets can store in a cell.
 *
 * - Arrays (multi-choice) → comma-separated string
 * - Booleans → "Yes" / "No"
 * - Numbers → kept as numbers (Sheets recognises numeric JSON values)
 * - Dates → ISO string
 * - Long strings → truncated to 50 000 chars (Sheets cell limit)
 * - null / undefined → empty string
 */
function normaliseCellValue(value: unknown): string | number | boolean {
  if (value == null) return "";

  if (Array.isArray(value)) {
    return truncate(value.map(String).join(", "));
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const str = String(value);
  return truncate(str);
}

/** Truncate a string to the Google Sheets cell character limit. */
function truncate(str: string): string {
  if (str.length > SHEETS_CELL_LIMIT) {
    return str.slice(0, SHEETS_CELL_LIMIT - 3) + "...";
  }
  return str;
}

/** Returns true for field types that don't collect user input. */
function isNonInputField(field: Field): boolean {
  return (
    field.type === "welcome" ||
    field.type === "statement" ||
    field.type === "ending"
  );
}
