#!/usr/bin/env -S npx tsx
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { buildFormHTML } from "./build";

// ─── Arg parsing (zero dependencies) ───

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`
  formant — build self-contained HTML forms from JSON schemas

  Usage:
    formant build <schema.json> [-o <output.html>] [--no-minify] [--inline]
    formant preview <schema.json> [--no-minify] [--inline]

  Commands:
    build     Compile a schema JSON file into a standalone HTML form
    preview   Build and immediately open in the default browser

  Options:
    -o, --output <file>   Output path (default: <schema-name>.html next to the JSON)
    --no-minify           Skip JS minification (useful for debugging)
    --inline              Inline React/ReactDOM instead of CDN script tags

  Examples:
    formant build feedback.json
    formant build feedback.json -o dist/feedback.html
    formant preview survey.json
`);
}

function parseArgs(argv: string[]): {
  schemaPath: string;
  output: string | null;
  minify: boolean;
  inline: boolean;
} {
  let schemaPath: string | null = null;
  let output: string | null = null;
  let minify = true;
  let inline = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-o" || arg === "--output") {
      output = argv[++i] ?? null;
      if (!output) {
        console.error("Error: -o/--output requires a file path argument");
        process.exit(1);
      }
    } else if (arg === "--no-minify") {
      minify = false;
    } else if (arg === "--inline") {
      inline = true;
    } else if (!arg.startsWith("-")) {
      schemaPath = arg;
    }
  }

  if (!schemaPath) {
    console.error("Error: no schema file specified");
    usage();
    process.exit(1);
  }

  return { schemaPath, output, minify, inline };
}

function buildForm(argv: string[]): string {
  const { schemaPath, output, minify, inline } = parseArgs(argv);

  const resolved = path.resolve(schemaPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: file not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  let schema: unknown;
  try {
    schema = JSON.parse(raw);
  } catch {
    console.error(`Error: invalid JSON in ${resolved}`);
    process.exit(1);
  }

  console.log(`Building form from ${path.basename(resolved)}...`);

  // buildFormHTML validates the schema and throws on errors
  const html = buildFormHTML(schema as Parameters<typeof buildFormHTML>[0], {
    minify,
    inline,
  });

  // Determine output path
  const outPath = output
    ? path.resolve(output)
    : resolved.replace(/\.json$/, ".html");

  // Ensure output directory exists
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, html);

  const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`Done — ${sizeKB} KB written to ${outPath}`);

  return outPath;
}

// ─── Command dispatch ───

switch (command) {
  case "build": {
    buildForm(args.slice(1));
    break;
  }

  case "preview": {
    const outPath = buildForm(args.slice(1));
    console.log("Opening in browser...");
    try {
      // Linux: xdg-open, macOS: open, Windows: start
      const opener =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      execSync(`${opener} ${JSON.stringify(outPath)}`, { stdio: "ignore" });
    } catch {
      console.log(`Could not open browser. Open manually: ${outPath}`);
    }
    break;
  }

  case "-h":
  case "--help":
  case "help":
  case undefined: {
    usage();
    break;
  }

  default: {
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
  }
}
