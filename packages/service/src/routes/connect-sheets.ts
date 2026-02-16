/**
 * Connect Google Sheet — OAuth flow and Apps Script deployment
 *
 * Flow: init → oauth (redirect to Google) → callback (exchange code, create sheet, deploy script)
 */

import { Hono } from "hono";
import type { AppEnv } from "../types";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/script.deployments",
  "https://www.googleapis.com/auth/script.projects",
].join(" ");

const NON_INPUT_TYPES = new Set(["welcome", "statement", "ending"]);

function getInputFields(schema: { fields?: Array<{ id: string; type?: string; title?: string }> }): Array<{ id: string; title: string }> {
  const fields = schema?.fields ?? [];
  return fields
    .filter((f) => f && typeof f.type === "string" && !NON_INPUT_TYPES.has(f.type))
    .map((f) => ({ id: f!.id, title: f!.title || f!.id }));
}

function buildSheetHeaders(schema: { fields?: Array<{ id: string; type?: string; title?: string }> }): string[] {
  const inputFields = getInputFields(schema);
  const headers = inputFields.map((f) => f.title);
  headers.push("_formId", "_submittedAt", "_duration", "_completionRate");
  return headers;
}

function randomBase64Url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const connectSheetsApp = new Hono<AppEnv>();

// ─── POST /api/connect-sheets/init ───

connectSheetsApp.post("/api/connect-sheets/init", async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.json({ error: "Connect Google Sheet is not configured" }, 503);
  }

  let body: { redirect_uri?: string; form_id?: string; schema?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const redirectUri = typeof body.redirect_uri === "string" ? body.redirect_uri : null;
  const formId = typeof body.form_id === "string" ? body.form_id : null;
  const schema = body.schema && typeof body.schema === "object" ? body.schema : null;

  if (!redirectUri || !formId || !schema) {
    return c.json({ error: "redirect_uri, form_id, and schema are required" }, 400);
  }

  const state = randomBase64Url(24);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const origin = new URL(c.req.url).origin;
  const callbackUrl = `${origin}/api/connect-sheets/callback`;

  await c.env.db.insertOAuthSession({
    state,
    formId,
    schemaJson: JSON.stringify(schema),
    redirectUri,
    codeVerifier,
  });

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&access_type=offline` +
    `&prompt=consent`;

  return c.json({ auth_url: authUrl, state });
});

// ─── GET /api/connect-sheets/callback ───

connectSheetsApp.get("/api/connect-sheets/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    const redirectUri = c.req.query("redirect_uri") ?? "";
    return c.redirect(`${redirectUri}#error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !state) {
    return c.json({ error: "Missing code or state" }, 400);
  }

  const row = await c.env.db.getAndDeleteOAuthSession(state);

  if (!row) {
    return c.json({ error: "Invalid or expired state" }, 400);
  }

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.redirect(`${row.redirectUri}#error=server_config`, 302);
  }

  const origin = new URL(c.req.url).origin;
  const callbackUrl = `${origin}/api/connect-sheets/callback`;

  // Exchange code for token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: row.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: callbackUrl,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return c.redirect(`${row.redirectUri}#error=token_exchange&message=${encodeURIComponent(errText)}`, 302);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  const accessToken = tokenData.access_token;

  let schema: { fields?: Array<{ id: string; type?: string; title?: string }> };
  try {
    schema = JSON.parse(row.schemaJson) as typeof schema;
  } catch {
    return c.redirect(`${row.redirectUri}#error=invalid_schema`, 302);
  }

  // 1. Create spreadsheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: "Form Responses" },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    return c.redirect(`${row.redirectUri}#error=create_sheet&message=${encodeURIComponent(errText)}`, 302);
  }

  const createData = (await createRes.json()) as { spreadsheetId: string; spreadsheetUrl?: string };
  const spreadsheetId = createData.spreadsheetId;
  const spreadsheetUrl = createData.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Add header row
  const headers = buildSheetHeaders(schema);
  const range = `Sheet1!A1:${columnLetter(headers.length)}1`;
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [headers] }),
    },
  );

  if (!updateRes.ok) {
    // Non-fatal: sheet exists, script will still work
  }

  // 3. Create Apps Script project
  const scriptRes = await fetch("https://script.googleapis.com/v1/projects", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: "Formant Sheets Connector" }),
  });

  if (!scriptRes.ok) {
    const errText = await scriptRes.text();
    return c.redirect(`${row.redirectUri}#error=create_script&message=${encodeURIComponent(errText)}`, 302);
  }

  const scriptData = (await scriptRes.json()) as { scriptId: string };
  const scriptId = scriptData.scriptId;

  // 4. Add script content
  const scriptSource = CONNECTOR_SCRIPT.replace("{{SPREADSHEET_ID}}", spreadsheetId);
  const appsscriptManifest = JSON.stringify({
    timeZone: "America/New_York",
    dependencies: {},
    exceptionLogging: "STACKDRIVER",
    webapp: {
      access: "ANYONE",
      executeAs: "USER_DEPLOYING",
    },
  });

  const contentRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: [
        { name: "Code", type: "SERVER_JS", source: scriptSource },
        { name: "appsscript", type: "JSON", source: appsscriptManifest },
      ],
    }),
  });

  if (!contentRes.ok) {
    const errText = await contentRes.text();
    return c.redirect(`${row.redirectUri}#error=script_content&message=${encodeURIComponent(errText)}`, 302);
  }

  // 5. Create version from content
  const versionRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/versions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ description: "Formant connector v1" }),
  });

  if (!versionRes.ok) {
    const errText = await versionRes.text();
    return c.redirect(`${row.redirectUri}#error=version&message=${encodeURIComponent(errText)}`, 302);
  }

  const versionData = (await versionRes.json()) as { versionNumber?: number };
  const versionNumber = versionData.versionNumber ?? 1;

  // 6. Create deployment
  const deployRes = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      versionNumber,
      manifestFileName: "appsscript",
      description: "Formant web app",
    }),
  });

  if (!deployRes.ok) {
    const errText = await deployRes.text();
    return c.redirect(`${row.redirectUri}#error=deploy&message=${encodeURIComponent(errText)}`, 302);
  }

  const deployData = (await deployRes.json()) as { deployment?: { entryPoints?: Array<{ webApp?: { url: string } }> } };
  const webAppUrl =
    deployData.deployment?.entryPoints?.[0]?.webApp?.url ??
    `https://script.google.com/macros/s/${scriptId}/exec`;

  // 7. Redirect to admin with success
  const fragment = `url=${encodeURIComponent(webAppUrl)}&spreadsheetUrl=${encodeURIComponent(spreadsheetUrl)}&formId=${encodeURIComponent(row.formId)}`;
  return c.redirect(`${row.redirectUri}#${fragment}`, 302);
});

function columnLetter(n: number): string {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s || "A";
}

const CONNECTOR_SCRIPT = `/**
 * Formant — Google Sheets Connector (Standalone)
 * Uses SPREADSHEET_ID injected at deploy time.
 */
var SPREADSHEET_ID = "{{SPREADSHEET_ID}}";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getActiveSheet();
    var metaKeys = [];
    var answerKeys = [];
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].charAt(0) === "_") metaKeys.push(keys[i]);
      else answerKeys.push(keys[i]);
    }
    var orderedKeys = answerKeys.concat(metaKeys);
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      sheet.appendRow(orderedKeys);
    } else {
      var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      orderedKeys = existingHeaders.filter(function (h) { return h !== ""; });
      for (var j = 0; j < keys.length; j++) {
        if (orderedKeys.indexOf(keys[j]) === -1) {
          orderedKeys.push(keys[j]);
          sheet.getRange(1, orderedKeys.length).setValue(keys[j]);
        }
      }
    }
    var row = [];
    for (var k = 0; k < orderedKeys.length; k++) {
      var value = data[orderedKeys[k]];
      if (value === undefined || value === null) row.push("");
      else if (Array.isArray(value)) row.push(value.join(", "));
      else row.push(value);
    }
    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ status: "ok", row: sheet.getLastRow() })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", message: "Formant Sheets Connector is active" })).setMimeType(ContentService.MimeType.JSON);
}
`;
// Actually the bind order is wrong - it should be state, form_id, schema_json, redirect_uri, code_verifier
// And we're binding formId, JSON.stringify(schema), redirectUri, codeVerifier - missing state!
// Let me fix that.