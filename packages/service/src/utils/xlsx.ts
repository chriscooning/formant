import * as XLSX from "xlsx";
import type { ResponseRow } from "../db/queries";

/** Field types that don't collect user input (excluded from export columns). */
const NON_INPUT_TYPES = new Set(["welcome", "statement", "ending"]);

interface SchemaField {
  id: string;
  type: string;
  title?: string;
}

/**
 * Build an XLSX workbook buffer from a form schema and its responses.
 *
 * Sheet 1 — "Responses": one column per input field, one row per response.
 * Sheet 2 — "Summary": total responses, date range, basic stats.
 *
 * Returns an ArrayBuffer suitable for streaming as an HTTP response.
 */
export function buildXlsx(
  schema: Record<string, unknown>,
  responses: ResponseRow[],
): ArrayBuffer {
  const fields = extractInputFields(schema);
  const headers = fields.map((f) => f.title ?? f.id);

  // ─── Sheet 1: Responses ───

  const dataRows = responses.map((row) => {
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(row.answers_json) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    const rowObj: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = answers[field.id];
      rowObj[field.title ?? field.id] = normaliseValue(raw);
    }
    rowObj["Submitted At"] = row.submitted_at;
    return rowObj;
  });

  // Ensure at least headers exist even with no responses
  const responsesSheet =
    dataRows.length > 0
      ? XLSX.utils.json_to_sheet(dataRows)
      : XLSX.utils.aoa_to_sheet([
          [...headers, "Submitted At"],
        ]);

  // ─── Sheet 2: Summary ───

  const submittedDates = responses.map((r) => r.submitted_at).sort();
  const summaryData = [
    {
      "Total Responses": responses.length,
      "First Response": submittedDates[0] ?? "N/A",
      "Last Response": submittedDates[submittedDates.length - 1] ?? "N/A",
    },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);

  // ─── Workbook ───

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, responsesSheet, "Responses");
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

  // Write as ArrayBuffer (Worker-safe — no Node Buffer dependency)
  const output = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  return output;
}

/** Extract fields that collect user input from the schema. */
function extractInputFields(
  schema: Record<string, unknown>,
): SchemaField[] {
  const fieldsRaw = schema.fields;
  if (!Array.isArray(fieldsRaw)) return [];

  return (fieldsRaw as SchemaField[]).filter(
    (f) => f && typeof f.type === "string" && !NON_INPUT_TYPES.has(f.type),
  );
}

/** Convert a raw answer value to something suitable for a spreadsheet cell. */
function normaliseValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  return String(value);
}
