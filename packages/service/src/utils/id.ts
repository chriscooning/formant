import { nanoid } from "nanoid";

/** Generate a 12-character form ID */
export function generateFormId(): string {
  return nanoid(12);
}

/** Generate a 16-character response ID */
export function generateResponseId(): string {
  return nanoid(16);
}
