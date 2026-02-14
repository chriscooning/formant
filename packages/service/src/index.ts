import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { formsApp } from "./routes/forms";
import { responsesApp } from "./routes/responses";
import { exportApp } from "./routes/export";
import type { AppEnv } from "./types";

// Re-export types for consumer convenience
export type { Bindings, Variables, AppEnv } from "./types";

// ─── App ───

const app = new Hono<AppEnv>();

// Global CORS — allows all origins including null (for local HTML files)
app.use("*", corsMiddleware());

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// ─── Mount route groups ───
app.route("/", formsApp);
app.route("/", responsesApp);
app.route("/", exportApp);

export default app;
