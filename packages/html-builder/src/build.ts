import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FormSchema } from "@formant/core";
import { validateSchema } from "@formant/core";
import { formantStyles } from "../../renderer/src/styles";
import { htmlTemplate } from "./template";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── React CDN globals shim ───
// When esbuild externalises react/react-dom, the IIFE output references
// `require("react")` etc.  This banner injects a `require` function that
// maps those calls to the CDN globals already on `window`.
//
// The jsx-runtime shim adapts the automatic JSX transform's jsx()/jsxs()
// calls to React.createElement, which is what the UMD CDN build exposes.

const requireShim =
  `var require=function(m){` +
  `var R=window.React,D=window.ReactDOM;` +
  `var j={jsx:function(t,p,k){if(k!==void 0){var n={};for(var i in p)n[i]=p[i];n.key=k;return R.createElement(t,n)}return R.createElement(t,p)},` +
  `jsxs:function(t,p,k){if(k!==void 0){var n={};for(var i in p)n[i]=p[i];n.key=k;return R.createElement(t,n)}return R.createElement(t,p)},` +
  `Fragment:R.Fragment};` +
  `if(m==="react")return R;` +
  `if(m==="react/jsx-runtime"||m==="react/jsx-dev-runtime")return j;` +
  `if(m==="react-dom"||m==="react-dom/client")return D;` +
  `throw new Error("Cannot require "+m)};`;

// ─── Public API ───

export interface BuildOptions {
  /** Minify the bundled JS. Default: true */
  minify?: boolean;
  /** Inline React/ReactDOM/SheetJS instead of CDN tags. Default: false */
  inline?: boolean;
}

/**
 * Bundle the renderer into a schema-independent runtime IIFE.
 * The bundle reads window.__FORMANT_SCHEMA__ at load time, so the same
 * runtime works for every form — build it once, inject schemas cheaply
 * (see assembleFormHTML in assemble.ts).
 */
export function buildRuntimeJS(options?: { minify?: boolean }): string {
  const minify = options?.minify ?? true;

  // Create the browser entry point that mounts the Formant component.
  // __FORMANT_SCHEMA__ is a var declared in the HTML before this IIFE runs.
  const rendererDir = path.resolve(__dirname, "../../renderer/src");

  const entryCode = `
import { Formant } from "./Formant";
import { createElement } from "react";

var ReactDOM = window.ReactDOM;
var schema = window.__FORMANT_SCHEMA__;
var initialAnswers = {};
try {
  var params = new URLSearchParams(window.location.search);
  params.forEach(function(v, k) { initialAnswers[k] = v; });
} catch (_) {}
var container = document.getElementById("root");
if (container) {
  var root = ReactDOM.createRoot(container);
  root.render(createElement(Formant, { schema: schema, initialAnswers: initialAnswers }));
}
`;

  // Bundle renderer + core into a single IIFE.
  // React and ReactDOM are externalised — they come from CDN script tags.
  // The banner shim maps require("react") etc. to window globals.
  const result = buildSync({
    stdin: {
      contents: entryCode,
      resolveDir: rendererDir,
      loader: "tsx",
    },
    bundle: true,
    format: "iife",
    target: "es2020",
    minify,
    write: false,
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react/*", "react-dom", "react-dom/*"],
    banner: { js: requireShim },
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    loader: {
      ".tsx": "tsx",
      ".ts": "ts",
    },
  });

  return result.outputFiles[0]!.text;
}

export function buildFormHTML(schema: FormSchema, options?: BuildOptions): string {
  // 1. Validate the schema
  const errors = validateSchema(schema);
  if (errors.length > 0) {
    throw new Error(`Invalid schema:\n${errors.join("\n")}`);
  }

  const minify = options?.minify ?? true;
  const inline = options?.inline ?? false;

  // 2. Bundle the schema-independent runtime
  const bundledJS = buildRuntimeJS({ minify });

  // 3. Generate the final HTML
  const schemaJSON = JSON.stringify(schema);
  return htmlTemplate({
    bundledJS,
    schemaJSON,
    css: formantStyles,
    minify,
    inline,
  });
}
