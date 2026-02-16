import { Hono } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { formsApp } from "./routes/forms";
import { responsesApp } from "./routes/responses";
import { exportApp } from "./routes/export";
import { connectSheetsApp } from "./routes/connect-sheets";
import type { AppEnv } from "./types";

// Re-export types for consumer convenience
export type { Bindings, Variables, AppEnv } from "./types";
export type { DbAdapter, FormRow, ResponseRow, AnalyticsResult } from "./db/interface";
export { D1Adapter } from "./db/d1-adapter";
export { hashApiKey } from "./middleware/auth";

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
app.route("/", connectSheetsApp);

export default app;
