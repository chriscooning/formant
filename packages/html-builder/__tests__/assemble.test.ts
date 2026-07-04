import { describe, it, expect } from "vitest";
import { buildFormHTML, buildRuntimeJS } from "../src/build";
import { assembleFormHTML } from "../src/assemble";
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

// ─── buildRuntimeJS ───

describe("buildRuntimeJS", () => {
  it("produces a schema-independent bundle", () => {
    const runtime = buildRuntimeJS();
    expect(runtime).toContain("__FORMANT_SCHEMA__");
    expect(runtime).not.toContain("test-form");
  });

  it("is identical across schemas (build once, reuse everywhere)", () => {
    expect(buildRuntimeJS()).toBe(buildRuntimeJS());
  });

  it("produces smaller output when minified", () => {
    const minified = buildRuntimeJS({ minify: true });
    const unminified = buildRuntimeJS({ minify: false });
    expect(minified.length).toBeLessThan(unminified.length);
  });
});

// ─── assembleFormHTML ───

describe("assembleFormHTML", () => {
  it("matches buildFormHTML output byte-for-byte (CDN mode, minified)", () => {
    const runtime = buildRuntimeJS({ minify: true });
    const assembled = assembleFormHTML(simpleSchema, { runtimeJs: runtime });
    const built = buildFormHTML(simpleSchema, { minify: true });
    expect(assembled).toBe(built);
  });

  it("matches buildFormHTML output byte-for-byte (CDN mode, unminified)", () => {
    const runtime = buildRuntimeJS({ minify: false });
    const assembled = assembleFormHTML(simpleSchema, { runtimeJs: runtime });
    const built = buildFormHTML(simpleSchema, { minify: false });
    expect(assembled).toBe(built);
  });

  it("throws on invalid schema", () => {
    const invalid = { id: "bad", title: "Bad" } as unknown as FormSchema;
    expect(() => assembleFormHTML(invalid, { runtimeJs: "/* runtime */" })).toThrow(
      "Invalid schema",
    );
  });

  it("supports overriding library scripts", () => {
    const assembled = assembleFormHTML(simpleSchema, {
      runtimeJs: "/* runtime */",
      libScripts: '  <script src="/local/react.js"></script>',
    });
    expect(assembled).toContain("/local/react.js");
    expect(assembled).not.toContain("unpkg.com");
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
    const html = assembleFormHTML(xssSchema, { runtimeJs: "/* runtime */" });
    expect(html).not.toContain("<title><script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
