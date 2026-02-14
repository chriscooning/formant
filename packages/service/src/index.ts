import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import type { AppEnv } from "./types";

// Re-export types for consumer convenience
export type { Bindings, Variables, AppEnv } from "./types";

// ─── App ───

const app = new Hono<AppEnv>();

// Global CORS — allows all origins including null (for local HTML files)
app.use("*", corsMiddleware());

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── Route stubs — implemented in Phase 3B ───
// POST   /api/forms            — Create a form (auth required)
// GET    /f/:id                — Serve form HTML (public)
// POST   /api/responses/:formId — Submit a response (public)
// GET    /api/responses/:formId — List responses (auth required)
// GET    /api/responses/:formId/xlsx — Export as Excel (auth required)
// DELETE /api/forms/:id        — Delete a form (auth required)

export default app;
