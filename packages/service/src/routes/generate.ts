import { Hono } from "hono";
import Anthropic from "@anthropic-ai/sdk";
import { validateSchema } from "@formant/core";
import type { FormSchema } from "@formant/core";
import type { AppEnv } from "../types";
import { requireAuth } from "../middleware/auth";

const generateApp = new Hono<AppEnv>();

const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_TURNS = 40;

// Condensed schema reference for the model — mirrors @formant/core's types.
const SYSTEM_PROMPT = `You are the form copilot inside Formant, a one-question-at-a-time form product (like Typeform). You collaborate with the user to create and refine JSON form schemas.

Respond with ONLY a JSON object — no markdown fences, no commentary:
{"reply": "<one or two short conversational sentences>", "schema": <full form schema object, or null>}

- "reply" is shown in the chat. Use it to confirm what you changed, suggest one improvement, or ask ONE clarifying question.
- "schema" is the COMPLETE updated form schema (never a fragment/diff). Set it to null only when you are asking a clarifying question instead of making changes.
- Bias toward action: draft something reasonable and ask at most one follow-up in "reply". Only return schema:null when the request is truly too ambiguous to act on.
- When a "Current schema" is provided, treat it as the working form: apply the requested changes and return the full schema with everything else preserved (ids, field order, unrelated fields).
- When a "Focused field" is indicated, the user is working on that specific question: apply changes to that field unless they clearly ask for something broader.

Form schema shape:
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
- Keep forms focused: 3–8 questions unless asked for more.
- Mark a field required only when it clearly must be answered.
- Write titles conversationally, addressed to the respondent.
- Preserve existing field ids when editing; invent new snake_case ids for new fields.
- submit.destinations must be preserved as-is (or [] on a new form) — the server wires up response delivery.`;

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in response");
  return JSON.parse(text.slice(start, end + 1));
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface GenerateResult {
  reply?: string;
  schema?: FormSchema | null;
  errors?: string[];
}

async function runGeneration(
  client: Anthropic,
  model: string,
  turns: ChatTurn[],
): Promise<GenerateResult> {
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }));

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
      return { errors: ["The request was declined. Try rephrasing."] };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let parsed: { reply?: unknown; schema?: unknown };
    try {
      parsed = extractJson(text) as { reply?: unknown; schema?: unknown };
    } catch {
      return { errors: ["The model did not return valid JSON. Try again."] };
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply : "";

    // Clarifying question — no schema changes this turn
    if (parsed.schema === null || parsed.schema === undefined) {
      if (!reply) return { errors: ["The model returned neither a schema nor a reply."] };
      return { reply, schema: null };
    }

    const errors = validateSchema(parsed.schema as FormSchema);
    if (errors.length === 0) {
      return { reply, schema: parsed.schema as FormSchema };
    }

    messages.push(
      { role: "assistant", content: text },
      {
        role: "user",
        content:
          `That schema failed validation with these errors:\n${errors.join("\n")}\n` +
          `Respond with the corrected {"reply", "schema"} JSON object only.`,
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

// ─── POST /api/generate — Conversational schema generation (auth required) ───
// Body: { messages: [{role, content}...], schema?: current form, field_id?: focus }
//   or legacy { description: "..." }.
// Returns: { message: "<assistant reply>", schema: <full schema> | null }

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

  // Normalize input: chat history, or legacy single description
  let turns: ChatTurn[] = [];
  if (Array.isArray(body.messages)) {
    turns = (body.messages as unknown[])
      .filter(
        (m): m is ChatTurn =>
          !!m &&
          typeof m === "object" &&
          ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant") &&
          typeof (m as ChatTurn).content === "string",
      )
      .slice(-MAX_TURNS);
  } else if (typeof body.description === "string" && body.description.trim()) {
    turns = [{ role: "user", content: `Create a form: ${body.description.trim()}` }];
  }

  if (turns.length === 0 || turns[turns.length - 1]!.role !== "user") {
    return c.json({ error: "messages must end with a user message" }, 400);
  }
  const totalChars = turns.reduce((n, t) => n + t.content.length, 0);
  if (totalChars > 60000) {
    return c.json({ error: "conversation is too long — start a new chat" }, 400);
  }

  // Inject working context into the latest user turn (system prompt stays static)
  const schema = body.schema && typeof body.schema === "object" ? body.schema : null;
  const fieldId = typeof body.field_id === "string" ? body.field_id : null;
  if (schema || fieldId) {
    const last = turns[turns.length - 1]!;
    const context =
      (schema ? `Current schema:\n${JSON.stringify(schema)}\n\n` : "") +
      (fieldId ? `Focused field: "${fieldId}" — the user is editing this question.\n\n` : "");
    turns = [...turns.slice(0, -1), { role: "user", content: context + last.content }];
  }

  const client = new Anthropic({ apiKey });
  const model = c.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  try {
    const result = await runGeneration(client, model, turns);
    if (result.errors) {
      return c.json({ error: `Could not generate a valid form: ${result.errors.join("; ")}` }, 422);
    }
    return c.json({ message: result.reply, schema: result.schema });
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
