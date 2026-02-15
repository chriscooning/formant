import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { FormSchema } from "@formant/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_PATH = path.resolve(
  __dirname,
  "../../../.cursor/skills/formant/templates/admin-local.html",
);

/**
 * Build admin panel HTML for local mode.
 * Reads admin-local template and replaces placeholders.
 */
export function buildAdminHTML(
  schema: FormSchema,
  adminPasswordHash: string,
): string {
  let template: string;
  try {
    template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  } catch {
    throw new Error(
      `Admin template not found at ${TEMPLATE_PATH}. ` +
        "Ensure .cursor/skills/formant/templates/admin-local.html exists.",
    );
  }

  const formId = schema.id ?? "form";
  const formTitle = (schema.title ?? "Form")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  let schemaJSON = JSON.stringify(schema);
  // Escape </script> in JSON to prevent premature HTML script tag closure
  schemaJSON = schemaJSON.replace(/<\/script>/gi, "<\\/script>");

  return template
    .replace(/\{\{FORM_ID\}\}/g, formId)
    .replace(/\{\{FORM_TITLE\}\}/g, formTitle)
    .replace(/\{\{SCHEMA_JSON\}\}/, schemaJSON)
    .replace(/\{\{ADMIN_PASSWORD_HASH\}\}/g, adminPasswordHash);
}

/**
 * Compute SHA-256 hex hash of password for admin gate.
 */
export function hashAdminPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}
