import React from "react";
import { createRoot } from "react-dom/client";
import { Formant } from "./Formant";
import type { FormSchema } from "@formant/core";

// Schema is injected by the HTML builder as a global variable
// before this IIFE executes in the generated HTML
declare const __FORMANT_SCHEMA__: FormSchema;

function parseUrlParams(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    params.forEach((v, k) => {
      out[k] = v;
    });
  } catch {
    // ignore
  }
  return out;
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    React.createElement(Formant, {
      schema: __FORMANT_SCHEMA__,
      initialAnswers: parseUrlParams(),
    })
  );
}
