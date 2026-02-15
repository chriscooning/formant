#!/usr/bin/env -S npx tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { buildFormHTML } from "./build";
import { buildAdminHTML, hashAdminPassword } from "./buildLocal";
import type { FormSchema } from "@formant/core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Arg parsing (zero dependencies) ───

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`
  formant — build self-contained HTML forms from JSON schemas

  Usage:
    formant build <schema.json> [-o <output.html>] [--no-minify] [--inline] [--local]
    formant preview <schema.json> [--no-minify] [--inline]
    formant deploy <form.html> [--target offline|vercel|cloudflare]

  Commands:
    build     Compile a schema JSON file into a standalone HTML form
    preview   Build and immediately open in the default browser
    deploy    Deploy a built form (interactive menu or --target to skip)

  Options:
    -o, --output <file>   Output path (default: <schema-name>.html next to the JSON)
    --no-minify           Skip JS minification (useful for debugging)
    --inline              Inline React/ReactDOM instead of CDN script tags
    --local               Local/kiosk mode: form + admin panel, IndexedDB storage
    --admin-password <p>  Admin password for --local (or FORMANT_ADMIN_PASSWORD env)
    --target <target>     Deploy target: offline, vercel, or cloudflare

  Examples:
    formant build feedback.json
    formant build feedback.json -o dist/feedback.html
    formant build forms/simple-form.json --local
    formant preview survey.json
    formant deploy forms/feedback.html
    formant deploy forms/feedback.html --target cloudflare
`);
}

function parseArgs(argv: string[]): {
  schemaPath: string;
  output: string | null;
  minify: boolean;
  inline: boolean;
  local: boolean;
  adminPassword: string | null;
} {
  let schemaPath: string | null = null;
  let output: string | null = null;
  let minify = true;
  let inline = false;
  let local = false;
  let adminPassword: string | null = null;

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
    } else if (arg === "--local") {
      local = true;
    } else if (arg === "--admin-password") {
      adminPassword = argv[++i] ?? null;
      if (!adminPassword) {
        console.error("Error: --admin-password requires a value");
        process.exit(1);
      }
    } else if (!arg.startsWith("-")) {
      schemaPath = arg;
    }
  }

  if (!schemaPath) {
    console.error("Error: no schema file specified");
    usage();
    process.exit(1);
  }

  return { schemaPath, output, minify, inline, local, adminPassword };
}

function ensureLocalDestination(schema: FormSchema): FormSchema {
  const destinations = schema.submit?.destinations ?? [];
  const hasLocal = destinations.some((d) => d && d.type === "local");
  if (hasLocal) return schema;

  const updated: FormSchema = {
    ...schema,
    submit: {
      ...schema.submit,
      destinations: [...destinations, { type: "local" }],
    },
  };
  return updated;
}

function buildForm(argv: string[]): string {
  const { schemaPath, output, minify, inline, local, adminPassword } =
    parseArgs(argv);

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

  if (local) {
    const password =
      adminPassword ?? process.env.FORMANT_ADMIN_PASSWORD ?? null;
    if (!password) {
      console.error(
        "Error: --local requires admin password. Set FORMANT_ADMIN_PASSWORD or use --admin-password <p>",
      );
      process.exit(1);
    }
    schema = ensureLocalDestination(schema as FormSchema);
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

  // Auto-copy source schema JSON alongside the output HTML
  const schemaOutPath = outPath.replace(/\.html$/, ".json");
  if (schemaOutPath !== outPath) {
    fs.copyFileSync(resolved, schemaOutPath);
    console.log(`Schema copied to ${schemaOutPath}`);
  }

  const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`Done — ${sizeKB} KB written to ${outPath}`);

  if (local) {
    const adminPasswordResolved =
      adminPassword ?? process.env.FORMANT_ADMIN_PASSWORD ?? "";
    const adminHash = hashAdminPassword(adminPasswordResolved);
    const adminSchema = schema as FormSchema;
    const adminHtml = buildAdminHTML(adminSchema, adminHash);
    const adminOutPath = outPath.replace(/\.html$/, "-admin.html");
    fs.writeFileSync(adminOutPath, adminHtml);
    const adminSizeKB = (Buffer.byteLength(adminHtml) / 1024).toFixed(1);
    console.log(`Admin panel — ${adminSizeKB} KB written to ${adminOutPath}`);
  }

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

  case "deploy": {
    // Delegate to scripts/deploy.sh, forwarding all remaining args
    const deployScript = path.resolve(
      __dirname,
      "../../../scripts/deploy.sh",
    );
    const deployArgs = args.slice(1).map((a) => JSON.stringify(a)).join(" ");
    try {
      execSync(`bash ${JSON.stringify(deployScript)} ${deployArgs}`, {
        stdio: "inherit",
      });
    } catch {
      process.exit(1);
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
