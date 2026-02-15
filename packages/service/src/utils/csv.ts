import type { ResponseRow } from "../db/queries";
import { extractInputFields, normaliseValue } from "./export-common";

/**
 * RFC 4180 CSV: quoted fields, escaped double-quotes (" → "").
 * Same column structure as XLSX: one column per input field + "Submitted At".
 */
export function buildCsv(
  schema: Record<string, unknown>,
  responses: ResponseRow[],
): string {
  const fields = extractInputFields(schema);
  const headers = [...fields.map((f) => f.title ?? f.id), "Submitted At"];

  const rows: string[][] = [headers.map(escapeCsvField)];

  for (const row of responses) {
    let answers: Record<string, unknown> = {};
    try {
      answers = JSON.parse(row.answers_json) as Record<string, unknown>;
    } catch {
      /* empty */
    }

    const cells: string[] = [];
    for (const field of fields) {
      const raw = answers[field.id];
      cells.push(escapeCsvField(normaliseValue(raw)));
    }
    cells.push(escapeCsvField(row.submitted_at));
    rows.push(cells);
  }

  return rows.map((r) => r.join(",")).join("\r\n");
}

function escapeCsvField(value: string | number | boolean): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
