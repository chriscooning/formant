import React from "react";
import { createRoot } from "react-dom/client";
import { Formant } from "./Formant";
import type { FormSchema } from "@formant/core";

// Schema is injected by the HTML builder as a global variable
// before this IIFE executes in the generated HTML
declare const __FORMANT_SCHEMA__: FormSchema;

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    React.createElement(Formant, { schema: __FORMANT_SCHEMA__ })
  );
}
