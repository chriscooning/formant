import fs from "node:fs";
import { createRequire } from "node:module";
import { formShellHTML, CDN_LIB_SCRIPTS, SHEETJS_CDN } from "./assemble";

const require = createRequire(import.meta.url);

// ─── Types ───

export interface TemplateOptions {
  bundledJS: string;
  schemaJSON: string;
  css: string;
  minify: boolean;
  inline: boolean;
}

// ─── Helpers ───

/**
 * Read a library file from node_modules for inline mode.
 * Uses require.resolve to correctly find the file through pnpm's linking.
 */
function readLibSource(packagePath: string): string {
  const resolved = require.resolve(packagePath);
  return fs.readFileSync(resolved, "utf-8");
}

// ─── Template ───

export function htmlTemplate({ bundledJS, schemaJSON, css, inline }: TemplateOptions): string {
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
          "Add them as dependencies or use inline: false (CDN mode).",
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
    libScripts = CDN_LIB_SCRIPTS;
  }

  return formShellHTML({
    schemaJSON,
    runtimeJs: bundledJS,
    css,
    libScripts,
  });
}
