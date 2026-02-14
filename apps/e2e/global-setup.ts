// Before all tests, generate HTML files from fixture schemas
import { buildFormHTML } from "@formant/html-builder";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const fixturesDir = path.join(__dirname, "fixtures");
  const outputDir = path.join(__dirname, "generated");

  fs.mkdirSync(outputDir, { recursive: true });

  const fixtures = [
    "simple-form.json",
    "branching-form.json",
    "full-form.json",
    "submit-form.json",
  ];

  for (const fixture of fixtures) {
    const schema = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, fixture), "utf-8"),
    );
    const html = buildFormHTML(schema);
    const outName = fixture.replace(".json", ".html");
    fs.writeFileSync(path.join(outputDir, outName), html);
  }

  console.log(
    `[global-setup] Generated ${fixtures.length} HTML files in ${outputDir}`,
  );
}
