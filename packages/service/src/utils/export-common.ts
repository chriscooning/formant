/** Field types that don't collect user input (excluded from export columns). */
const NON_INPUT_TYPES = new Set(["welcome", "statement", "ending"]);

export interface SchemaField {
  id: string;
  type: string;
  title?: string;
}

/** Extract fields that collect user input from the schema. */
export function extractInputFields(
  schema: Record<string, unknown>,
): SchemaField[] {
  const fieldsRaw = schema.fields;
  if (!Array.isArray(fieldsRaw)) return [];

  return (fieldsRaw as SchemaField[]).filter(
    (f) => f && typeof f.type === "string" && !NON_INPUT_TYPES.has(f.type),
  );
}

/** Convert a raw answer value to something suitable for a spreadsheet cell. */
export function normaliseValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  return String(value);
}
