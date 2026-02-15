#!/usr/bin/env node
/**
 * Generate admin-local.html with placeholder values.
 * Usage: node scripts/generate-admin-local.js <schema.json> <output.html> [password]
 * Env: FORMANT_ADMIN_PASSWORD overrides password arg.
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const schemaPath = process.argv[2];
const outPath = process.argv[3];
const password =
  process.env.FORMANT_ADMIN_PASSWORD || process.argv[4] || "test123";

if (!schemaPath || !outPath) {
  console.error("Usage: node generate-admin-local.js <schema.json> <output.html> [password]");
  process.exit(1);
}

const rootDir = path.resolve(path.dirname(process.argv[1]), "..");
const templatePath = path.join(rootDir, ".cursor/skills/formant/templates/admin-local.html");

let schema = fs.readFileSync(schemaPath, "utf-8");
schema = JSON.stringify(JSON.parse(schema));
schema = schema.replace(/<\/script>/gi, "</script>");

const parsed = JSON.parse(schema);
const formId = parsed.id || "form";
const formTitle = (parsed.title || "Form")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const hash = crypto.createHash("sha256").update(password).digest("hex");

let t = fs.readFileSync(templatePath, "utf-8");
t = t.replace(/\{\{FORM_ID\}\}/g, formId);
t = t.replace(/\{\{FORM_TITLE\}\}/g, formTitle);
t = t.replace(/\{\{SCHEMA_JSON\}\}/, schema);
t = t.replace(/\{\{ADMIN_PASSWORD_HASH\}\}/g, hash);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, t);

console.log("Generated:", outPath);
console.log("  Open: file://" + path.resolve(outPath));
console.log("  Password:", password);
