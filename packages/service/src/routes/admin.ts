import { Hono } from "hono";
import type { AppEnv } from "../types";
import { WORKSPACE_HTML } from "../admin/workspace-html";

const adminApp = new Hono<AppEnv>();

// ─── GET /admin — Workspace UI (public page; API key entered client-side) ───

adminApp.get("/admin", (c) => c.html(WORKSPACE_HTML, 200, { "Cache-Control": "no-store" }));

export { adminApp };
