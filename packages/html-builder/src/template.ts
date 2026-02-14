import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ─── CDN URLs ───

const REACT_CDN = "https://unpkg.com/react@18/umd/react.production.min.js";
const REACT_DOM_CDN =
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js";
const SHEETJS_CDN =
  "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

// ─── Types ───

export interface TemplateOptions {
  bundledJS: string;
  schemaJSON: string;
  css: string;
  minify: boolean;
  inline: boolean;
}

// ─── Helpers ───

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Read a library file from node_modules for inline mode.
 * Uses require.resolve to correctly find the file through pnpm's linking.
 */
function readLibSource(packagePath: string): string {
  const resolved = require.resolve(packagePath);
  return fs.readFileSync(resolved, "utf-8");
}

// ─── Template ───

export function htmlTemplate({
  bundledJS,
  schemaJSON,
  css,
  minify,
  inline,
}: TemplateOptions): string {
  const parsed: unknown = JSON.parse(schemaJSON);
  const title = escapeHTML(
    (typeof parsed === "object" &&
      parsed !== null &&
      "title" in parsed &&
      typeof (parsed as Record<string, unknown>).title === "string"
      ? (parsed as Record<string, string>).title
      : "Formant") as string,
  );

  let libScripts: string;

  if (inline) {
    // Inline mode: embed library source directly into the HTML
    let reactSrc: string;
    let reactDomSrc: string;
    try {
      reactSrc = readLibSource("react/umd/react.production.min.js");
      reactDomSrc = readLibSource("react-dom/umd/react-dom.production.min.js");
    } catch {
      throw new Error(
        "Inline mode requires react and react-dom to be installed. " +
          'Add them as dependencies or use inline: false (CDN mode).',
      );
    }

    // SheetJS may or may not be installed locally
    let sheetjsTag: string;
    try {
      const sheetjsSrc = readLibSource("xlsx/dist/xlsx.full.min.js");
      sheetjsTag = `  <script>${sheetjsSrc}</script>`;
    } catch {
      // Fall back to CDN for SheetJS if not installed locally
      sheetjsTag = `  <script src="${SHEETJS_CDN}"></script>`;
    }

    libScripts = `  <script>${reactSrc}</script>
  <script>${reactDomSrc}</script>
${sheetjsTag}`;
  } else {
    // CDN mode (default): load libraries from CDN at runtime
    libScripts = `  <script src="${REACT_CDN}"></script>
  <script src="${REACT_DOM_CDN}"></script>
  <script src="${SHEETJS_CDN}"></script>`;
  }

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
    ${bundledJS}
  </script>
</body>
</html>`;
}
