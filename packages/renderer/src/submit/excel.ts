import type { FormSchema, FormResponse } from "@formant/core";

// SheetJS is loaded from CDN at runtime — NOT bundled
declare const XLSX: {
  utils: {
    json_to_sheet: (data: Record<string, unknown>[]) => unknown;
    book_new: () => { SheetNames: string[]; Sheets: Record<string, unknown> };
    book_append_sheet: (
      wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
      ws: unknown,
      name: string
    ) => void;
  };
  write: (
    wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
    opts: { bookType: string; type: string }
  ) => ArrayBuffer;
};

/**
 * Download form response as an Excel (.xlsx) file.
 *
 * Requires SheetJS (XLSX) to be loaded from CDN at runtime.
 * Falls back to CSV download if XLSX global is not available.
 */
export function downloadExcel(
  schema: FormSchema,
  response: FormResponse,
  filename?: string
): void {
  // Check if SheetJS is available
  if (typeof XLSX === "undefined") {
    downloadCSV(schema, response, filename);
    return;
  }

  const defaultFilename = `${schema.title ?? "formant"}-responses.xlsx`;
  const file = filename ?? defaultFilename;

  // Build responses row — flatten answers with field titles as keys
  const row = buildFlatRow(schema, response);

  // Sheet 1: Responses
  const responsesSheet = XLSX.utils.json_to_sheet([row]);

  // Sheet 2: Metadata
  const metadataSheet = XLSX.utils.json_to_sheet([
    {
      "Submission Timestamp": response.submittedAt,
      Duration: response.metadata?.duration ?? "",
      "Completion Rate": response.metadata?.completionRate ?? "",
    },
  ]);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, responsesSheet, "Responses");
  XLSX.utils.book_append_sheet(wb, metadataSheet, "Metadata");

  // Write and trigger download
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    file
  );
}

/**
 * CSV Fallback — works fully offline, no library needed.
 *
 * Generates a simple CSV with field titles as headers and values as a row.
 * Properly escapes commas and quotes.
 */
export function downloadCSV(
  schema: FormSchema,
  response: FormResponse,
  filename?: string
): void {
  const defaultFilename = `${schema.title ?? "formant"}-responses.csv`;
  const file = filename
    ? filename.replace(/\.xlsx$/i, ".csv")
    : defaultFilename;

  const row = buildFlatRow(schema, response);
  const headers = Object.keys(row);
  const values = Object.values(row);

  const csvLines = [
    headers.map(escapeCSV).join(","),
    values.map((v) => escapeCSV(String(v ?? ""))).join(","),
  ];

  const csvString = csvLines.join("\n");

  triggerDownload(
    new Blob([csvString], { type: "text/csv;charset=utf-8;" }),
    file
  );
}

/** Build a flat key-value row using field titles as keys. */
function buildFlatRow(
  schema: FormSchema,
  response: FormResponse
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const title = field.title ?? field.id;
    const value = response.answers[field.id];

    if (Array.isArray(value)) {
      // Multi-choice → join with ", "
      row[title] = value.join(", ");
    } else if (value instanceof Date) {
      row[title] = value.toISOString();
    } else {
      row[title] = value;
    }
  }

  return row;
}

/** Escape a value for CSV — wrap in quotes if it contains comma, quote, or newline. */
function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Trigger a browser file download via blob + anchor click. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
