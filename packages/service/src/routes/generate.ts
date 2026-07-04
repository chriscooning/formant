import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { validateSchema } from "@formant/core";
import type { FormSchema } from "@formant/core";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";

const generateApp = new Hono<AppEnv>();

const DEFAULT_MODEL = "claude-opus-4-8";

// Condensed schema reference for the model — mirrors @formant/core's types.
const SYSTEM_PROMPT = `You generate JSON form schemas for Formant, a one-question-at-a-time form product (like Typeform). Given a plain-language description, respond with ONLY a JSON object — no markdown fences, no commentary.

Schema shape:
{
  "id": "kebab-case-id",
  "title": "Form title",
  "fields": [ ...fields... ],
  "submit": { "destinations": [] }
}

Every field has: id (unique, snake_case), type, title. Optional: subtitle, required (boolean; not on welcome/statement/ending).

Field types and their extra properties:
- welcome: buttonText — use as the first field with an inviting title/subtitle
- text, email, phone, url: placeholder
- textarea: placeholder, rows
- number: placeholder, min, max, step
- choice (single select), multi_choice (checkboxes), dropdown: options (array of strings; 2+ entries)
- rating: max (default 5 stars)
- scale: min, max (e.g. 0–10), minLabel, maxLabel — use for NPS-style questions
- yes_no: yesLabel, noLabel
- date: minDate, maxDate ("YYYY-MM-DD")
- statement: buttonText — informational interstitial, no answer
- ending: showSummary — REQUIRED as the last field, with a thank-you title

Rules:
- Always include exactly one welcome field first and one ending field last.
- Keep forms focused: 3–8 questions unless the description demands more.
- Mark a field required only when the description implies it must be answered.
- Write titles conversationally, addressed to the respondent.
- submit.destinations must be [] — the server wires up response delivery.`;

function extractJson(text: string): unknown {
  // Tolerate accidental markdown fences or leading prose
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

async function generateSchema(
  client: Anthropic,
  model: string,
  description: string,
): Promise<{ schema?: FormSchema; errors?: string[] }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Create a form: ${description}` },
  ];

  // Up to one repair round: feed validation errors back to the model
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { errors: ["The request was declined. Try rephrasing the description."] };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: unknown;
    try {
      parsed = extractJson(text);
    } catch {
      return { errors: ["The model did not return valid JSON. Try again."] };
    }

    const errors = validateSchema(parsed as FormSchema);
    if (errors.length === 0) {
      return { schema: parsed as FormSchema };
    }

    // Ask the model to repair its own output once
    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          `That schema failed validation with these errors:\n${errors.join("\n")}\n` +
          `Respond with the corrected JSON object only.`,
      },
    );
    if (attempt === 1) return { errors };
  }
  return { errors: ["Generation failed."] };
}

// ─── GET /api/generate/status — Is Create with AI configured? ───

generateApp.get("/api/generate/status", (c) => {
  return c.json({ configured: !!c.env.ANTHROPIC_API_KEY });
});

// ─── POST /api/generate — Description → validated form schema (auth required) ───

generateApp.post("/api/generate", requireAuth(), async (c) => {
  const apiKey = c.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Create with AI is not configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) {
    return c.json({ error: "description is required" }, 400);
  }
  if (description.length > 4000) {
    return c.json({ error: "description is too long (max 4000 characters)" }, 400);
  }

  const client = new Anthropic({ apiKey });
  const model = c.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const result = await generateSchema(client, model, description);
    if (!result.schema) {
      return c.json(
        { error: `Could not generate a valid form: ${(result.errors ?? []).join("; ")}` },
        422,
      );
    }
    return c.json({ schema: result.schema });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return c.json({ error: "The configured Anthropic API key was rejected" }, 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return c.json({ error: "The AI service is rate-limited right now — try again shortly" }, 502);
    }
    if (err instanceof Anthropic.APIError) {
      return c.json({ error: `AI request failed (${err.status})` }, 502);
    }
    return c.json({ error: "Could not reach the AI service" }, 502);
  }
});

export { generateApp };
