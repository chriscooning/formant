// ─── Server-Side Form Assembly ───
// Assembles form HTML from a schema inside the Worker, using the embedded
// schema-independent runtime. This is what lets the workspace publish forms
// without any local build step.

import type { FormSchema } from "@formant/core";
import { assembleFormHTML } from "@formant/html-builder/src/assemble";
import { RUNTIME_JS } from "../generated/runtime-embed";

/**
 * Ensure the schema submits responses back to this service. Replaces any
 * existing service destination (the form id must match the stored row) and
 * leaves other destinations (webhook, sheets, …) intact. No endpoint means
 * same-origin — correct for forms served from /f/:id.
 */
export function withServiceDestination(
  schema: Record<string, unknown>,
  formId: string,
): Record<string, unknown> {
  const submit = (schema.submit ?? {}) as Record<string, unknown>;
  const destinations = Array.isArray(submit.destinations)
    ? (submit.destinations as Record<string, unknown>[])
    : [];
  const others = destinations.filter((d) => !d || d.type !== "service");
  return {
    ...schema,
    submit: {
      ...submit,
      destinations: [...others, { type: "service", formId }],
    },
  };
}

/**
 * Assemble a hosted form's HTML. Throws Error("Invalid schema:\n…") on
 * validation failure — callers translate that into a 400.
 */
export function assembleHostedFormHTML(schema: unknown): string {
  return assembleFormHTML(schema as FormSchema, { runtimeJs: RUNTIME_JS });
}
