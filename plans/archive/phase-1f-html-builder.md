# Phase 1F — HTML Builder

## Goal

Implement the build pipeline that takes a `FormSchema` JSON and produces a single, self-contained `.html` file. The HTML includes all CSS, bundled renderer JS, the schema data, and CDN script tags.

## Prerequisites

- Phase 1E-2 complete (full renderer package: Formant component, entry point, styles, submit handlers)
- `@formant/core` and `@formant/renderer` are both buildable
- esbuild is a dependency of `@formant/html-builder`

## Dependency Graph Position

```
Phase 1E-2 ──► ► Phase 1F ◄ ──► Phase 1G (E2E tests)
                              ──► Phase 1-Skill (Claude skill)
                              ──► Phase 3B (service routes — needs builder for form creation)
```

---

## Implementation Spec

### Build Pipeline Overview

```
1. esbuild bundles packages/renderer/src/index.tsx → single JS string (IIFE)
   - Format: IIFE
   - External: react, react-dom (resolved from window globals via CDN)
   - Target: ES2020
   - Minify: true (for production)
   - JSX: automatic (react-jsx)
   - Bundle: true (resolves all internal imports including @formant/core)

2. buildFormHTML() interpolates:
   - CSS from styles.ts into <style>
   - Bundled JS IIFE into <script>
   - Schema JSON into a var declaration
   - CDN script tags for React, ReactDOM, SheetJS

3. Output: single .html file
```

### `packages/html-builder/src/build.ts`

```typescript
import { buildSync } from "esbuild";
import path from "path";
import type { FormSchema } from "@formant/core";
import { validateSchema } from "@formant/core";
import { htmlTemplate } from "./template";

export interface BuildOptions {
  minify?: boolean;           // Default true
  inline?: boolean;           // Default false — when true, inlines React/ReactDOM/SheetJS into HTML
}

export function buildFormHTML(schema: FormSchema, options?: BuildOptions): string {
  // 1. Validate the schema
  const errors = validateSchema(schema);
  if (errors.length > 0) {
    throw new Error(`Invalid schema:\n${errors.join("\n")}`);
  }

  // 2. Bundle the renderer with esbuild
  const result = buildSync({
    entryPoints: [path.resolve(__dirname, "../../renderer/src/index.tsx")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: options?.minify ?? true,
    write: false,              // Return as string, don't write to disk
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react/jsx-runtime"],
    // Map externals to window globals:
    alias: {
      // esbuild will use these when resolving externals
    },
    define: {
      // Ensure process.env.NODE_ENV is set for React production mode
      "process.env.NODE_ENV": '"production"',
    },
    loader: {
      ".tsx": "tsx",
      ".ts": "ts",
    },
  });

  const bundledJS = result.outputFiles[0].text;

  // 3. Handle React external resolution
  // Since React/ReactDOM come from CDN (window globals), we need a shim.
  // esbuild with format: "iife" and external: ["react"] will generate
  // require("react") calls inside the IIFE. We need to provide a shim
  // that maps these to window globals.
  //
  // Alternative approach: use a banner/footer or globalName mapping.
  // The simplest approach: use esbuild's "inject" or a custom plugin
  // to replace react imports with window.React.
  //
  // Practical solution: Create a small shim file that the IIFE wraps:
  const reactShim = `
    var React = window.React;
    var ReactDOM = window.ReactDOM;
    var jsxRuntime = { jsx: React.createElement, jsxs: React.createElement, Fragment: React.Fragment };
  `;
  // Note: the exact approach may need adjustment based on esbuild output.
  // Test this during implementation and adjust the external/alias/inject config.

  // 4. Generate the HTML
  const schemaJSON = JSON.stringify(schema);
  return htmlTemplate({ bundledJS, schemaJSON, minify: options?.minify ?? true });
}
```

**Important esbuild note:** Getting React externals to map to CDN globals in an IIFE requires care. The implementer should:
1. Try the `alias` + `external` approach first
2. If that doesn't work cleanly, use an esbuild plugin that rewrites `require("react")` → `window.React`
3. Or use the `banner` option to define the shim before the bundle
4. Test by opening the generated HTML in a browser — if React isn't found, the shim needs adjustment

### `packages/html-builder/src/template.ts`

```typescript
import { formantStyles } from "@formant/renderer/styles";
// Or import the styles string directly — depends on how renderer exports it

interface TemplateOptions {
  bundledJS: string;
  schemaJSON: string;
  minify: boolean;
}

export function htmlTemplate({ bundledJS, schemaJSON, minify }: TemplateOptions): string {
  // Import the CSS from the renderer's styles.ts
  const css = formantStyles; // The template literal string

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(JSON.parse(schemaJSON).title || "Formant")}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
  <script>
    var __FORMANT_SCHEMA__ = ${schemaJSON};
    ${bundledJS}
  </script>
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

**Schema injection:** `var __FORMANT_SCHEMA__` is declared with `var` (not `const`) before the bundled IIFE. This makes it accessible within the IIFE's scope since `var` hoists to the script scope. The renderer's `index.tsx` reads it via `declare var __FORMANT_SCHEMA__`.

### `packages/html-builder/src/cli.ts`

Stub for future:
```typescript
// TODO: Future phase — CLI entry point
// Usage: formant build schema.json -o form.html
// Will use commander or citty for arg parsing
export {};
```

### `packages/html-builder/src/index.ts`

Public API:
```typescript
export { buildFormHTML, type BuildOptions } from "./build";
```

---

## CDN vs Inline — DECIDED: Configurable (Option C)

`buildFormHTML(schema, options)` supports both modes via the `inline` option:

- `inline: false` (default) — CDN mode. Small files (~50-80KB). React, ReactDOM, and SheetJS loaded from CDN at runtime. Requires internet.
- `inline: true` — Inline mode. Larger files (~700-800KB). React, ReactDOM, and SheetJS source code is inlined directly into the HTML. Truly self-contained, works fully offline.

### Implementation approach:

**CDN mode (default):** Same as current plan — `<script src="...">` tags for React, ReactDOM, SheetJS.

**Inline mode:** The build pipeline must:
1. Read the minified source of React, ReactDOM, and SheetJS from `node_modules` or download from CDN URLs at build time
2. Embed them as inline `<script>` blocks instead of CDN `<script src>` tags
3. The rest of the pipeline is identical (bundled renderer IIFE, schema injection, CSS)

**For MVP:** Implement CDN mode first, then add inline mode in the same phase. The `BuildOptions` interface already has the `inline` field. The only extra work is a function that reads the library source files and embeds them.

```typescript
export interface BuildOptions {
  minify?: boolean;           // Default true
  inline?: boolean;           // Default false — when true, inlines React/ReactDOM/SheetJS
}
```

**Template changes for inline mode:**
- Instead of `<script src="https://unpkg.com/react@19/...">`, emit `<script>/* React 19 production */\n${reactSource}</script>`
- Same for ReactDOM and SheetJS
- Add `react` and `react-dom` as dependencies of `@formant/html-builder` so their production UMD builds can be read from `node_modules`

**Skill should mention this:** When generating forms for email attachment or offline use, set `inline: true`. For web hosting, default CDN mode is preferred for smaller files.

---

## Tests

### `packages/html-builder/__tests__/build.test.ts`

- **Valid HTML output**: call `buildFormHTML` with a simple schema, verify output starts with `<!DOCTYPE html>` and contains `<html>`, `<head>`, `<body>`, `</html>`
- **Schema embedded**: output contains `var __FORMANT_SCHEMA__` with the schema data
- **React CDN tags**: output contains `unpkg.com/react@19`
- **ReactDOM CDN tag**: output contains `unpkg.com/react-dom@19`
- **SheetJS CDN tag**: output contains `cdn.sheetjs.com/xlsx`
- **CSS present**: output contains `--ff-bg` and `--ff-accent` (theme variables)
- **Title set**: output `<title>` contains the schema's title
- **Schema validation**: invalid schema (no fields) → throws error
- **Minification**: with `minify: true`, JS is smaller than with `minify: false`

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `packages/html-builder/src/build.ts` | Replace placeholder with build pipeline |
| `packages/html-builder/src/template.ts` | Replace placeholder with HTML template |
| `packages/html-builder/src/cli.ts` | Replace placeholder with stub |
| `packages/html-builder/src/index.ts` | Replace placeholder with exports |
| `packages/html-builder/__tests__/build.test.ts` | Replace placeholder with tests |
| `packages/html-builder/package.json` | Ensure esbuild dependency is present |

## Completion Criteria

```bash
# TypeScript compiles
pnpm --filter @formant/html-builder exec tsc --noEmit

# Tests pass
pnpm --filter @formant/html-builder test

# Smoke test: generate an HTML file and verify it works
node -e "
  const { buildFormHTML } = require('./packages/html-builder/src/build');
  const html = buildFormHTML({
    id: 'test',
    title: 'Test Form',
    fields: [
      { id: 'welcome', type: 'welcome', title: 'Welcome!' },
      { id: 'name', type: 'text', title: 'What is your name?', required: true },
      { id: 'end', type: 'ending', title: 'Thanks!' }
    ]
  });
  require('fs').writeFileSync('/tmp/test-form.html', html);
  console.log('Generated HTML:', html.length, 'bytes');
"
# Open /tmp/test-form.html in a browser — should render the form
```

- `buildFormHTML(schema)` returns valid HTML string
- HTML includes React 19 + ReactDOM CDN tags
- HTML includes SheetJS CDN tag
- HTML includes inline CSS with all theme variables
- HTML includes bundled renderer JS as IIFE
- Schema is properly embedded as `var __FORMANT_SCHEMA__`
- Schema validation runs before build (invalid schemas throw)
- Unit tests verify HTML structure
- Generated HTML opens in a browser and renders the form

## Open Questions

None — all decisions resolved for this segment.
