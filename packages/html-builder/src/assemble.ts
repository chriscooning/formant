// ─── Pure Form Assembly ───
// Composes a prebuilt runtime bundle (see buildRuntimeJS in build.ts) and a
// schema into a self-contained HTML form. No Node.js APIs — safe to import
// from Cloudflare Workers, Vercel Edge, or the browser.

import type { FormSchema } from "@formant/core";
import { validateSchema } from "@formant/core";
import { formantStyles } from "../../renderer/src/styles";

// ─── CDN URLs ───

export const REACT_CDN = "https://unpkg.com/react@18/umd/react.production.min.js";
export const REACT_DOM_CDN = "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js";
export const SHEETJS_CDN = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

export const CDN_LIB_SCRIPTS = `  <script src="${REACT_CDN}"></script>
  <script src="${REACT_DOM_CDN}"></script>
  <script src="${SHEETJS_CDN}"></script>`;

// ─── Helpers ───

export function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Shell ───

export interface ShellOptions {
  /** Serialized schema JSON, injected as var __FORMANT_SCHEMA__ */
  schemaJSON: string;
  /** Prebuilt schema-independent runtime bundle (IIFE) */
  runtimeJs: string;
  /** Full CSS for the form */
  css: string;
  /** Library <script> tags (CDN or inline source) */
  libScripts: string;
}

/**
 * The HTML skeleton shared by every built form. The page title comes from
 * the schema's title field.
 */
export function formShellHTML({ schemaJSON, runtimeJs, css, libScripts }: ShellOptions): string {
  const parsed: unknown = JSON.parse(schemaJSON);
  const title = escapeHTML(
    (typeof parsed === "object" &&
    parsed !== null &&
    "title" in parsed &&
    typeof (parsed as Record<string, unknown>).title === "string"
      ? (parsed as Record<string, string>).title
      : "Formant") as string,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
${libScripts}
  <script>
    var __FORMANT_SCHEMA__ = ${schemaJSON};
    ${runtimeJs}
  </script>
</body>
</html>`;
}

// ─── Public API ───

export interface AssembleOptions {
  /** Prebuilt runtime bundle from buildRuntimeJS (or dist/formant-runtime.js) */
  runtimeJs: string;
  /** Override the form CSS. Default: bundled Formant styles */
  css?: string;
  /** Override library script tags. Default: React/ReactDOM/SheetJS from CDN */
  libScripts?: string;
}

/**
 * Assemble a form HTML document from a schema and a prebuilt runtime bundle.
 * Pure string work — equivalent to buildFormHTML (CDN mode) without esbuild,
 * so it can run where esbuild can't (Workers, browsers).
 */
export function assembleFormHTML(schema: FormSchema, options: AssembleOptions): string {
  const errors = validateSchema(schema);
  if (errors.length > 0) {
    throw new Error(`Invalid schema:\n${errors.join("\n")}`);
  }

  return formShellHTML({
    schemaJSON: JSON.stringify(schema),
    runtimeJs: options.runtimeJs,
    css: options.css ?? formantStyles,
    libScripts: options.libScripts ?? CDN_LIB_SCRIPTS,
  });
}
