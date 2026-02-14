import { describe, it, expect } from "vitest";
import { buildFormHTML } from "../src/build";
import type { FormSchema } from "@formant/core";

// ─── Fixtures ───

const simpleSchema: FormSchema = {
  id: "test-form",
  title: "Test Form",
  fields: [
    { id: "welcome", type: "welcome", title: "Welcome!" },
    { id: "name", type: "text", title: "What is your name?", required: true },
    { id: "end", type: "ending", title: "Thanks!" },
  ],
};

// ─── Tests ───

describe("buildFormHTML", () => {
  it("returns valid HTML with doctype, html, head, and body", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</html>");
  });

  it("embeds the schema as var __FORMANT_SCHEMA__", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("var __FORMANT_SCHEMA__");
    expect(html).toContain('"test-form"');
    expect(html).toContain('"What is your name?"');
  });

  it("includes React CDN tag", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("unpkg.com/react@19");
  });

  it("includes ReactDOM CDN tag", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("unpkg.com/react-dom@19");
  });

  it("includes SheetJS CDN tag", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("cdn.sheetjs.com/xlsx");
  });

  it("includes CSS with theme variables", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("--ff-bg");
    expect(html).toContain("--ff-accent");
  });

  it("sets the title from the schema", () => {
    const html = buildFormHTML(simpleSchema);
    expect(html).toContain("<title>Test Form</title>");
  });

  it("throws on invalid schema (no fields)", () => {
    const invalid = { id: "bad", title: "Bad" } as unknown as FormSchema;
    expect(() => buildFormHTML(invalid)).toThrow("Invalid schema");
  });

  it("throws on invalid schema (no ending field)", () => {
    const noEnding: FormSchema = {
      id: "no-end",
      title: "No Ending",
      fields: [{ id: "q", type: "text", title: "Q" }],
    };
    expect(() => buildFormHTML(noEnding)).toThrow("Invalid schema");
  });

  it("produces smaller output when minified vs unminified", () => {
    const minified = buildFormHTML(simpleSchema, { minify: true });
    const unminified = buildFormHTML(simpleSchema, { minify: false });
    expect(minified.length).toBeLessThan(unminified.length);
  });

  it("includes bundled JavaScript in the output", () => {
    const html = buildFormHTML(simpleSchema);
    // The bundled JS should contain an IIFE — check for function pattern
    expect(html).toContain("<script>");
    // The output should contain code from the renderer (e.g. the root mount logic)
    expect(html).toContain("root");
  });

  it("escapes HTML in the title", () => {
    const xssSchema: FormSchema = {
      id: "xss",
      title: "<script>alert(1)</script>",
      fields: [
        { id: "w", type: "welcome", title: "Hi" },
        { id: "e", type: "ending", title: "Bye" },
      ],
    };
    const html = buildFormHTML(xssSchema);
    expect(html).not.toContain("<title><script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
