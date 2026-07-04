// ─── Workspace (Phases W3–W5) ───
// Self-contained admin page served at GET /admin.
//   W3: API-key login + forms list
//   W4: editor — field list, templates, paste-JSON, live preview
//   W5: publish & share via schema-only POST/PUT /api/forms
// Kept as a TS string so it bundles into the Worker with no asset config.
// Visual tokens mirror packages/renderer/src/styles.ts so the admin side
// feels like the same product as the forms.
//
// NOTE: no backticks or "${" inside the HTML — it lives in a template literal.

export const WORKSPACE_HTML: string = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formant — Workspace</title>
  <style>
    :root {
      --ff-bg: #0a0a0c;
      --ff-surface: #0e0e12;
      --ff-surface-hover: #131318;
      --ff-border: #1a1a1f;
      --ff-border-hover: #333;
      --ff-text: #e0e0e0;
      --ff-text-secondary: #666;
      --ff-text-muted: #444;
      --ff-accent: #6c5ce7;
      --ff-accent-hover: #5a4bd1;
      --ff-accent-glow: rgba(108, 92, 231, 0.12);
      --ff-error: #ff6b6b;
      --ff-success: #51cf66;
      --ff-radius: 10px;
      --ff-font-sans: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --ff-font-mono: 'Space Mono', 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
      --ff-transition: 0.2s ease;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --ff-bg: #fafafa;
        --ff-surface: #ffffff;
        --ff-surface-hover: #f5f5f5;
        --ff-border: #e5e5e5;
        --ff-border-hover: #ccc;
        --ff-text: #1a1a1a;
        --ff-text-secondary: #888;
        --ff-text-muted: #aaa;
        --ff-accent-glow: rgba(108, 92, 231, 0.08);
      }
    }
    [data-theme="light"] {
      --ff-bg: #fafafa;
      --ff-surface: #ffffff;
      --ff-surface-hover: #f5f5f5;
      --ff-border: #e5e5e5;
      --ff-border-hover: #ccc;
      --ff-text: #1a1a1a;
      --ff-text-secondary: #888;
      --ff-text-muted: #aaa;
      --ff-accent-glow: rgba(108, 92, 231, 0.08);
    }
    [data-theme="dark"] {
      --ff-bg: #0a0a0c;
      --ff-surface: #0e0e12;
      --ff-surface-hover: #131318;
      --ff-border: #1a1a1f;
      --ff-border-hover: #333;
      --ff-text: #e0e0e0;
      --ff-text-secondary: #666;
      --ff-text-muted: #444;
      --ff-accent-glow: rgba(108, 92, 231, 0.12);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      font-family: var(--ff-font-sans);
      background: var(--ff-bg);
      color: var(--ff-text);
      transition: background var(--ff-transition), color var(--ff-transition);
    }
    button { font-family: inherit; cursor: pointer; }
    input, textarea, select { font-family: inherit; color: var(--ff-text); }

    .hidden { display: none !important; }

    /* ── Shared controls ── */
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 18px;
      letter-spacing: -0.01em;
    }
    .brand-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--ff-accent);
      box-shadow: 0 0 12px var(--ff-accent-glow);
      flex-shrink: 0;
    }
    .btn-primary {
      background: var(--ff-accent);
      color: #fff;
      border: none;
      border-radius: var(--ff-radius);
      font-size: 14px;
      font-weight: 600;
      padding: 9px 18px;
      transition: background var(--ff-transition);
    }
    .btn-primary:hover { background: var(--ff-accent-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--ff-border);
      border-radius: 999px;
      color: var(--ff-text-secondary);
      font-size: 13px;
      padding: 6px 14px;
      transition: border-color var(--ff-transition), color var(--ff-transition);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-ghost:hover { border-color: var(--ff-border-hover); color: var(--ff-text); }
    .theme-toggle {
      width: 32px; height: 32px; padding: 0;
      justify-content: center; font-size: 14px;
    }
    .menu {
      position: absolute;
      z-index: 30;
      background: var(--ff-surface);
      border: 1px solid var(--ff-border-hover);
      border-radius: var(--ff-radius);
      box-shadow: 0 8px 28px rgba(0,0,0,0.25);
      padding: 6px;
      min-width: 200px;
    }
    .menu button {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-radius: 6px;
      color: var(--ff-text);
      font-size: 13.5px;
      padding: 8px 10px;
    }
    .menu button:hover { background: var(--ff-surface-hover); }
    .menu .menu-hint { font-size: 11px; color: var(--ff-text-secondary); display: block; margin-top: 2px; }

    /* ── Login view ── */
    .login-wrap {
      min-height: 100%;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .login-card {
      width: 100%; max-width: 380px;
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 40px 36px;
    }
    .login-card .brand { margin-bottom: 8px; }
    .login-sub { color: var(--ff-text-secondary); font-size: 14px; margin-bottom: 28px; }
    .login-card label {
      display: block;
      font-size: 11px;
      font-family: var(--ff-font-mono);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--ff-text-secondary);
      margin-bottom: 8px;
    }
    .login-card input {
      width: 100%;
      background: transparent;
      border: none;
      border-bottom: 2px solid var(--ff-border-hover);
      font-size: 16px;
      padding: 8px 2px;
      outline: none;
      transition: border-color var(--ff-transition);
    }
    .login-card input:focus { border-bottom-color: var(--ff-accent); }
    .login-error { color: var(--ff-error); font-size: 13px; min-height: 20px; margin-top: 10px; }
    .login-card .btn-primary { width: 100%; margin-top: 10px; padding: 12px 16px; font-size: 15px; }
    .login-hint { margin-top: 20px; font-size: 12px; color: var(--ff-text-secondary); line-height: 1.5; }

    /* ── Workspace list view ── */
    .topbar { border-bottom: 1px solid var(--ff-border); background: var(--ff-surface); }
    .topbar-inner {
      max-width: 880px; margin: 0 auto; padding: 14px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .topbar-actions { display: flex; align-items: center; gap: 8px; position: relative; }
    main { max-width: 880px; margin: 0 auto; padding: 36px 24px 64px; }
    .page-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 20px; position: relative;
    }
    .page-head h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    .page-head-right { display: flex; align-items: center; gap: 14px; }
    .form-count { font-family: var(--ff-font-mono); font-size: 12px; color: var(--ff-text-secondary); }
    .status-line { color: var(--ff-text-secondary); font-size: 14px; padding: 24px 0; }
    .status-line.error { color: var(--ff-error); }
    .form-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .form-card {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 18px 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      transition: border-color var(--ff-transition), background var(--ff-transition);
    }
    .form-card:hover { border-color: var(--ff-border-hover); background: var(--ff-surface-hover); }
    .form-card-main { min-width: 0; }
    .form-title {
      font-size: 16px; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin-bottom: 6px;
    }
    .form-meta {
      display: flex; gap: 14px;
      font-family: var(--ff-font-mono); font-size: 11.5px;
      color: var(--ff-text-secondary); white-space: nowrap;
    }
    .form-meta strong { color: var(--ff-text); font-weight: 600; }
    .form-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .empty-state {
      border: 1px dashed var(--ff-border-hover);
      border-radius: var(--ff-radius);
      padding: 48px 32px; text-align: center;
    }
    .empty-state h2 { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
    .empty-state p { color: var(--ff-text-secondary); font-size: 14px; margin-bottom: 18px; }

    /* ── Editor view ── */
    .editor-shell { display: flex; flex-direction: column; height: 100vh; }
    .editor-topbar {
      border-bottom: 1px solid var(--ff-border);
      background: var(--ff-surface);
      padding: 10px 16px;
      display: flex; align-items: center; gap: 12px;
      flex-shrink: 0;
    }
    .editor-title-input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 16px; font-weight: 600;
      padding: 6px 10px;
      outline: none;
      transition: border-color var(--ff-transition);
    }
    .editor-title-input:hover { border-color: var(--ff-border); }
    .editor-title-input:focus { border-color: var(--ff-accent); }
    .editor-status {
      font-family: var(--ff-font-mono); font-size: 11px;
      color: var(--ff-text-secondary); white-space: nowrap;
    }
    .share-bar {
      background: var(--ff-accent-glow);
      border-bottom: 1px solid var(--ff-border);
      padding: 8px 16px;
      display: flex; align-items: center; gap: 10px;
      font-size: 13px;
      flex-shrink: 0;
    }
    .share-bar .share-url {
      font-family: var(--ff-font-mono); font-size: 12px;
      color: var(--ff-text);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .share-popover {
      border-bottom: 1px solid var(--ff-border);
      background: var(--ff-surface);
      padding: 14px 16px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      flex-shrink: 0;
    }
    .share-popover textarea {
      flex: 1;
      background: var(--ff-bg);
      border: 1px solid var(--ff-border);
      border-radius: 8px;
      font-family: var(--ff-font-mono);
      font-size: 11.5px;
      line-height: 1.5;
      padding: 10px;
      outline: none;
      resize: none;
    }
    .qr-box {
      background: #ffffff;
      border-radius: 8px;
      padding: 6px;
      line-height: 0;
      display: inline-block;
    }
    .share-popover .pane-actions { display: flex; flex-direction: column; gap: 8px; }
    .editor-main {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(340px, 420px) 1fr;
      min-height: 0;
    }
    .editor-panel {
      overflow-y: auto;
      border-right: 1px solid var(--ff-border);
      background: var(--ff-surface);
      padding: 16px;
    }
    .field-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .field-item {
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      background: var(--ff-bg);
      overflow: hidden;
    }
    .field-item.expanded { border-color: var(--ff-accent); }
    .field-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      user-select: none;
    }
    .field-type-badge {
      font-family: var(--ff-font-mono);
      font-size: 9.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ff-accent);
      background: var(--ff-accent-glow);
      border-radius: 4px;
      padding: 3px 6px;
      flex-shrink: 0;
    }
    .field-head-title {
      flex: 1; min-width: 0;
      font-size: 13.5px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .field-head-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .icon-btn {
      background: transparent; border: none;
      color: var(--ff-text-secondary);
      font-size: 13px;
      width: 24px; height: 24px;
      border-radius: 5px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .icon-btn:hover { background: var(--ff-surface-hover); color: var(--ff-text); }
    .icon-btn.danger:hover { color: var(--ff-error); }
    .field-body {
      border-top: 1px solid var(--ff-border);
      padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .prop-row label {
      display: block;
      font-family: var(--ff-font-mono);
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ff-text-secondary);
      margin-bottom: 4px;
    }
    .prop-row input[type="text"], .prop-row input[type="number"], .prop-row textarea {
      width: 100%;
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: 6px;
      font-size: 13px;
      padding: 7px 9px;
      outline: none;
      transition: border-color var(--ff-transition);
      resize: vertical;
    }
    .prop-row input:focus, .prop-row textarea:focus { border-color: var(--ff-accent); }
    .prop-check { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .prop-check input { accent-color: var(--ff-accent); }
    .prop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .add-field-wrap { position: relative; margin-top: 12px; }
    .add-field-btn { width: 100%; justify-content: center; padding: 10px; border-style: dashed; border-radius: var(--ff-radius); }
    .json-panel { display: flex; flex-direction: column; gap: 10px; height: 100%; }
    .json-panel textarea {
      flex: 1;
      min-height: 300px;
      background: var(--ff-bg);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      font-family: var(--ff-font-mono);
      font-size: 12px;
      line-height: 1.5;
      padding: 12px;
      outline: none;
      resize: none;
    }
    .json-panel textarea:focus { border-color: var(--ff-accent); }
    .json-error { color: var(--ff-error); font-size: 12.5px; min-height: 18px; }
    .editor-preview { position: relative; background: var(--ff-bg); min-width: 0; }
    .editor-preview iframe { width: 100%; height: 100%; border: none; display: block; }
    .preview-error {
      position: absolute; top: 12px; left: 12px; right: 12px;
      background: var(--ff-surface);
      border: 1px solid var(--ff-error);
      border-radius: var(--ff-radius);
      color: var(--ff-error);
      font-size: 12.5px;
      padding: 10px 14px;
      white-space: pre-wrap;
      z-index: 10;
    }
    .preview-loading {
      position: absolute; top: 12px; right: 12px;
      font-family: var(--ff-font-mono); font-size: 11px;
      color: var(--ff-text-secondary);
      z-index: 10;
    }

    /* ── Results view ── */
    :root {
      --chart-submissions: #6c5ce7;
      --chart-views: #0d9488;
    }
    @media (prefers-color-scheme: light) {
      :root { --chart-views: #14b8a6; }
    }
    [data-theme="light"] { --chart-views: #14b8a6; }
    [data-theme="dark"] { --chart-views: #0d9488; }

    .results-scroll { flex: 1; overflow-y: auto; }
    .results-main { max-width: 980px; margin: 0 auto; padding: 28px 24px 64px; }
    .results-section { margin-bottom: 28px; }
    .range-row { display: flex; gap: 6px; margin-bottom: 16px; align-items: center; }
    .range-row .spacer { flex: 1; }
    .range-btn.active { border-color: var(--ff-accent); color: var(--ff-text); }
    .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    @media (max-width: 640px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
    .stat-tile {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 14px 16px;
    }
    .stat-tile .stat-label {
      font-family: var(--ff-font-mono);
      font-size: 10px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ff-text-secondary);
      margin-bottom: 6px;
    }
    .stat-tile .stat-value { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    .chart-card {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 16px;
      position: relative;
    }
    .chart-legend {
      display: flex; gap: 16px; align-items: center;
      font-size: 12.5px; color: var(--ff-text-secondary);
      margin-bottom: 10px;
    }
    .chart-legend .chip {
      display: inline-block; width: 10px; height: 10px;
      border-radius: 3px; margin-right: 6px; vertical-align: -1px;
    }
    .chart-legend .spacer { flex: 1; }
    .chart-svg-wrap { position: relative; }
    .chart-svg-wrap svg { display: block; width: 100%; height: auto; }
    .chart-tooltip {
      position: absolute;
      pointer-events: none;
      background: var(--ff-bg);
      border: 1px solid var(--ff-border-hover);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      line-height: 1.6;
      white-space: nowrap;
      z-index: 20;
      display: none;
    }
    .chart-tooltip .tt-date { color: var(--ff-text-secondary); font-family: var(--ff-font-mono); font-size: 10.5px; }
    .data-table-wrap { overflow-x: auto; }
    table.data-table { border-collapse: collapse; width: 100%; font-size: 13px; }
    .data-table th, .data-table td {
      border-bottom: 1px solid var(--ff-border);
      padding: 8px 10px;
      text-align: left;
      max-width: 260px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .data-table th {
      font-family: var(--ff-font-mono);
      font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--ff-text-secondary);
      font-weight: 400;
    }
    .status-badge {
      font-family: var(--ff-font-mono); font-size: 10px;
      border: 1px solid var(--ff-border-hover);
      border-radius: 999px;
      color: var(--ff-text-secondary);
      padding: 2px 8px;
    }
    .responses-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .responses-head h2 { font-size: 16px; font-weight: 600; flex: 1; }
    .responses-head select {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: 999px;
      color: var(--ff-text-secondary);
      font-size: 13px;
      padding: 6px 10px;
      outline: none;
    }
    .load-more-row { text-align: center; padding: 14px 0 0; }
    .results-empty { color: var(--ff-text-secondary); font-size: 14px; padding: 18px 0; }
    .sheets-card {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .sheets-card .sheets-text { flex: 1; min-width: 220px; }
    .sheets-card h3 { font-size: 14.5px; font-weight: 600; margin-bottom: 4px; }
    .sheets-card p { color: var(--ff-text-secondary); font-size: 13px; }
    .sheets-card .connected-mark { color: var(--ff-success); }

    @media (max-width: 760px) {
      .editor-main { grid-template-columns: 1fr; grid-template-rows: 45% 55%; }
      .editor-panel { border-right: none; border-bottom: 1px solid var(--ff-border); }
      .form-card { flex-direction: column; align-items: flex-start; }
      .form-actions { width: 100%; }
    }
  </style>
</head>
<body>

  <!-- ── Login ── -->
  <div id="view-login" class="login-wrap hidden">
    <div class="login-card">
      <div class="brand"><span class="brand-dot"></span>Formant</div>
      <div class="login-sub">Sign in to your workspace</div>
      <form id="login-form">
        <label for="api-key">API key</label>
        <input id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your API key">
        <div id="login-error" class="login-error"></div>
        <button id="login-btn" class="btn-primary" type="submit">Sign in</button>
      </form>
      <div class="login-hint">Your key is stored only in this browser and sent as a Bearer token to this workspace's API.</div>
    </div>
  </div>

  <!-- ── Workspace list ── -->
  <div id="view-workspace" class="hidden">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand"><span class="brand-dot"></span>Formant</div>
        <div class="topbar-actions">
          <button id="theme-toggle" class="btn-ghost theme-toggle" type="button" title="Toggle theme">◐</button>
          <button id="signout-btn" class="btn-ghost" type="button">Sign out</button>
        </div>
      </div>
    </header>
    <main>
      <div class="page-head">
        <h1>Your forms</h1>
        <div class="page-head-right">
          <span id="form-count" class="form-count"></span>
          <button id="new-form-btn" class="btn-primary" type="button">+ New form</button>
        </div>
        <div id="new-form-menu" class="menu hidden" style="top: 48px; right: 0;">
          <button type="button" data-template="blank">Blank form</button>
          <button type="button" data-template="feedback">Customer feedback<span class="menu-hint">5-star rating + comment</span></button>
          <button type="button" data-template="nps">NPS survey<span class="menu-hint">0–10 scale + follow-up</span></button>
          <button type="button" data-template="json">Paste JSON<span class="menu-hint">Use an AI-generated schema</span></button>
        </div>
      </div>
      <div id="list-status" class="status-line hidden"></div>
      <ul id="form-list" class="form-list"></ul>
      <div id="empty-state" class="empty-state hidden">
        <h2>No forms yet</h2>
        <p>Create one right here, or describe it to the AI in your editor and deploy.</p>
        <button id="empty-new-btn" class="btn-primary" type="button">Create your first form</button>
      </div>
    </main>
  </div>

  <!-- ── Editor ── -->
  <div id="view-editor" class="editor-shell hidden">
    <div class="editor-topbar">
      <button id="editor-back" class="btn-ghost" type="button">←</button>
      <input id="editor-title" class="editor-title-input" type="text" placeholder="Untitled form" spellcheck="false">
      <span id="editor-status" class="editor-status"></span>
      <button id="editor-results" class="btn-ghost hidden" type="button">Results</button>
      <button id="json-toggle" class="btn-ghost" type="button">JSON</button>
      <button id="publish-btn" class="btn-primary" type="button">Publish</button>
    </div>
    <div id="share-bar" class="share-bar hidden">
      <span>Live at</span>
      <span id="share-url" class="share-url"></span>
      <button id="share-copy" class="btn-ghost" type="button">Copy link</button>
      <a id="share-open" class="btn-ghost" target="_blank" rel="noopener">Open</a>
      <button id="share-embed" class="btn-ghost" type="button">Embed</button>
      <button id="share-qr" class="btn-ghost" type="button">QR</button>
    </div>
    <div id="share-popover" class="share-popover hidden">
      <div id="embed-pane" class="hidden" style="display: contents;">
        <textarea id="embed-code" readonly rows="3" spellcheck="false"></textarea>
        <div class="pane-actions">
          <button id="embed-copy" class="btn-ghost" type="button">Copy code</button>
        </div>
      </div>
      <div id="qr-pane" class="hidden" style="display: contents;">
        <span id="qr-box" class="qr-box"></span>
        <div class="pane-actions">
          <button id="qr-download" class="btn-ghost" type="button">Download SVG</button>
          <span class="editor-status">Scan to open the form</span>
        </div>
      </div>
    </div>
    <div class="editor-main">
      <div class="editor-panel">
        <div id="fields-panel">
          <ul id="field-list" class="field-list"></ul>
          <div class="add-field-wrap">
            <button id="add-field-btn" class="btn-ghost add-field-btn" type="button">+ Add question</button>
            <div id="add-field-menu" class="menu hidden" style="bottom: 48px; left: 0; right: 0;"></div>
          </div>
        </div>
        <div id="json-panel" class="json-panel hidden">
          <textarea id="json-text" spellcheck="false" placeholder="Paste your form schema JSON here…"></textarea>
          <div id="json-error" class="json-error"></div>
          <button id="json-apply" class="btn-primary" type="button">Apply</button>
        </div>
      </div>
      <div class="editor-preview">
        <div id="preview-loading" class="preview-loading hidden">rendering…</div>
        <div id="preview-error" class="preview-error hidden"></div>
        <iframe id="preview-frame" title="Form preview"></iframe>
      </div>
    </div>
  </div>

  <!-- ── Results ── -->
  <div id="view-results" class="editor-shell hidden">
    <div class="editor-topbar">
      <button id="results-back" class="btn-ghost" type="button">←</button>
      <input id="results-title" class="editor-title-input" type="text" readonly>
      <button id="results-edit" class="btn-ghost" type="button">Edit form</button>
      <a id="results-open" class="btn-ghost" target="_blank" rel="noopener">Open</a>
    </div>
    <div class="results-scroll">
      <div class="results-main">
        <div class="results-section">
          <div class="range-row">
            <button class="btn-ghost range-btn active" type="button" data-days="7">7 days</button>
            <button class="btn-ghost range-btn" type="button" data-days="14">14 days</button>
            <button class="btn-ghost range-btn" type="button" data-days="30">30 days</button>
            <span class="spacer"></span>
            <span id="analytics-status" class="editor-status"></span>
          </div>
          <div id="stat-grid" class="stat-grid"></div>
          <div class="chart-card">
            <div class="chart-legend">
              <span><span class="chip" style="background: var(--chart-submissions)"></span>Submissions</span>
              <span><span class="chip" style="background: var(--chart-views)"></span>Views</span>
              <span class="spacer"></span>
              <button id="chart-table-toggle" class="btn-ghost" type="button">Table</button>
            </div>
            <div id="chart-area" class="chart-svg-wrap"></div>
            <div id="chart-tooltip" class="chart-tooltip"></div>
          </div>
          <div id="dropoff-line" class="results-empty hidden"></div>
        </div>
        <div class="results-section">
          <div id="sheets-card" class="sheets-card hidden"></div>
        </div>
        <div class="results-section">
          <div class="responses-head">
            <h2>Responses</h2>
            <select id="status-filter">
              <option value="completed">Completed</option>
              <option value="in_progress">Partial</option>
              <option value="all">All</option>
            </select>
            <button id="export-csv" class="btn-ghost" type="button">CSV</button>
            <button id="export-xlsx" class="btn-ghost" type="button">Excel</button>
          </div>
          <div id="responses-area" class="data-table-wrap"></div>
          <div class="load-more-row">
            <button id="load-more" class="btn-ghost hidden" type="button">Load more</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
  (function () {
    var KEY_STORAGE = "formant_api_key";
    var THEME_STORAGE = "formant_theme";

    // ── Theme ──
    var savedTheme = null;
    try { savedTheme = localStorage.getItem(THEME_STORAGE); } catch (_) {}
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
    function toggleTheme() {
      var current = document.documentElement.getAttribute("data-theme");
      if (!current) {
        current = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      var next = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_STORAGE, next); } catch (_) {}
    }

    // ── Helpers ──
    function $(id) { return document.getElementById(id); }
    function el(tag, cls, text) {
      var node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }
    function apiKey() {
      try { return localStorage.getItem(KEY_STORAGE) || ""; } catch (_) { return ""; }
    }
    function apiFetch(path, options) {
      options = options || {};
      options.headers = options.headers || {};
      options.headers["Authorization"] = "Bearer " + apiKey();
      if (options.body) options.headers["Content-Type"] = "application/json";
      return fetch(path, options);
    }
    function genFieldId(type) {
      return type + "_" + Math.random().toString(36).slice(2, 7);
    }

    // ── Views ──
    var views = ["view-login", "view-workspace", "view-editor", "view-results"];
    function show(viewId) {
      views.forEach(function (v) {
        $(v).classList.toggle("hidden", v !== viewId);
      });
      if (viewId === "view-login") $("api-key").focus();
    }

    // ── Templates ──
    function tplBlank() {
      return {
        id: genFieldId("form"),
        title: "Untitled form",
        fields: [
          { id: genFieldId("welcome"), type: "welcome", title: "Welcome!", subtitle: "This will only take a minute.", buttonText: "Start" },
          { id: genFieldId("text"), type: "text", title: "First question", required: false, placeholder: "Type your answer…" },
          { id: genFieldId("ending"), type: "ending", title: "Thank you!", subtitle: "Your response has been recorded." }
        ],
        submit: { destinations: [] }
      };
    }
    function tplFeedback() {
      return {
        id: genFieldId("form"),
        title: "Customer feedback",
        fields: [
          { id: genFieldId("welcome"), type: "welcome", title: "We'd love your feedback", subtitle: "Two quick questions — 30 seconds, tops.", buttonText: "Start" },
          { id: genFieldId("rating"), type: "rating", title: "How would you rate your experience?", required: true, max: 5 },
          { id: genFieldId("textarea"), type: "textarea", title: "Anything we could do better?", required: false, placeholder: "Tell us what you think…" },
          { id: genFieldId("ending"), type: "ending", title: "Thanks for helping us improve!" }
        ],
        submit: { destinations: [] }
      };
    }
    function tplNps() {
      return {
        id: genFieldId("form"),
        title: "NPS survey",
        fields: [
          { id: genFieldId("welcome"), type: "welcome", title: "One quick question", subtitle: "Help us understand how we're doing.", buttonText: "Start" },
          { id: genFieldId("scale"), type: "scale", title: "How likely are you to recommend us to a friend?", required: true, min: 0, max: 10, minLabel: "Not likely", maxLabel: "Very likely" },
          { id: genFieldId("textarea"), type: "textarea", title: "What's the main reason for your score?", required: false, placeholder: "Optional…" },
          { id: genFieldId("ending"), type: "ending", title: "Thank you!" }
        ],
        submit: { destinations: [] }
      };
    }
    var TEMPLATES = { blank: tplBlank, feedback: tplFeedback, nps: tplNps };

    // ── Field type catalog ──
    var FIELD_TYPES = [
      { type: "text", label: "Short text" },
      { type: "textarea", label: "Long text" },
      { type: "email", label: "Email" },
      { type: "phone", label: "Phone" },
      { type: "url", label: "Website" },
      { type: "number", label: "Number" },
      { type: "choice", label: "Multiple choice" },
      { type: "multi_choice", label: "Checkboxes" },
      { type: "dropdown", label: "Dropdown" },
      { type: "rating", label: "Rating" },
      { type: "scale", label: "Opinion scale" },
      { type: "yes_no", label: "Yes / No" },
      { type: "date", label: "Date" },
      { type: "statement", label: "Statement" },
      { type: "welcome", label: "Welcome screen" },
      { type: "ending", label: "Ending screen" }
    ];
    var TYPE_LABELS = {};
    FIELD_TYPES.forEach(function (t) { TYPE_LABELS[t.type] = t.label; });

    function newField(type) {
      var f = { id: genFieldId(type), type: type, title: TYPE_LABELS[type] || "New question" };
      if (type === "choice" || type === "multi_choice" || type === "dropdown") {
        f.options = ["Option 1", "Option 2"];
      }
      if (type === "rating") f.max = 5;
      if (type === "scale") { f.min = 0; f.max = 10; }
      if (type === "welcome") { f.title = "Welcome!"; f.buttonText = "Start"; }
      if (type === "ending") { f.title = "Thank you!"; }
      if (type === "statement") { f.buttonText = "Continue"; }
      return f;
    }

    // ── Editor state ──
    var editor = {
      formId: null,
      schema: null,
      expanded: -1,
      jsonMode: false,
      publishedUrl: null,
      previewTimer: null
    };

    function setEditorStatus(text) { $("editor-status").textContent = text || ""; }

    function openEditor(formId, schema, startInJsonMode) {
      editor.formId = formId;
      editor.schema = schema;
      editor.expanded = -1;
      editor.publishedUrl = formId ? "/f/" + formId : null;
      $("editor-title").value = schema.title || "";
      $("publish-btn").textContent = formId ? "Save" : "Publish";
      $("editor-results").classList.toggle("hidden", !formId);
      setEditorStatus(formId ? "" : "draft");
      renderShareBar();
      setJsonMode(!!startInJsonMode, true);
      renderFieldList();
      show("view-editor");
      schedulePreview(0);
    }

    // ── Share bar ──
    function renderShareBar() {
      var bar = $("share-bar");
      closeSharePopover();
      if (!editor.publishedUrl) { bar.classList.add("hidden"); return; }
      var full = location.origin + editor.publishedUrl;
      $("share-url").textContent = full;
      $("share-open").href = editor.publishedUrl;
      bar.classList.remove("hidden");
    }

    var sharePane = null;
    function closeSharePopover() {
      sharePane = null;
      $("share-popover").classList.add("hidden");
      $("embed-pane").classList.add("hidden");
      $("qr-pane").classList.add("hidden");
    }
    function toggleSharePane(pane) {
      if (sharePane === pane) { closeSharePopover(); return; }
      sharePane = pane;
      $("share-popover").classList.remove("hidden");
      $("embed-pane").classList.toggle("hidden", pane !== "embed");
      $("qr-pane").classList.toggle("hidden", pane !== "qr");
      if (pane === "embed") {
        var title = ((editor.schema && editor.schema.title) || "Form").replace(/"/g, "&quot;");
        $("embed-code").value =
          '<iframe src="' + location.origin + editor.publishedUrl +
          '" width="100%" height="620" style="border:none;border-radius:12px" title="' + title + '"></iframe>';
      }
      if (pane === "qr") loadQr();
    }
    var qrSvgText = null;
    function loadQr() {
      var box = $("qr-box");
      box.innerHTML = "";
      qrSvgText = null;
      apiFetch("/api/forms/" + editor.formId + "/qr")
        .then(function (res) {
          if (!res.ok) throw new Error("QR failed (" + res.status + ")");
          return res.text();
        })
        .then(function (svg) {
          qrSvgText = svg;
          box.innerHTML = svg;
        })
        .catch(function (err) {
          box.textContent = err.message;
        });
    }

    // ── Field list rendering ──
    function fieldSummary(f) {
      return f.title || "(untitled)";
    }

    function renderFieldList() {
      var list = $("field-list");
      list.innerHTML = "";
      var fields = editor.schema.fields || [];

      fields.forEach(function (f, i) {
        var li = el("li", "field-item" + (editor.expanded === i ? " expanded" : ""));

        var head = el("div", "field-head");
        head.appendChild(el("span", "field-type-badge", (f.type || "?").replace("_", " ")));
        head.appendChild(el("span", "field-head-title", fieldSummary(f)));

        var actions = el("div", "field-head-actions");
        var upBtn = el("button", "icon-btn", "↑");
        upBtn.type = "button"; upBtn.title = "Move up";
        upBtn.addEventListener("click", function (e) { e.stopPropagation(); moveField(i, -1); });
        var downBtn = el("button", "icon-btn", "↓");
        downBtn.type = "button"; downBtn.title = "Move down";
        downBtn.addEventListener("click", function (e) { e.stopPropagation(); moveField(i, 1); });
        var delBtn = el("button", "icon-btn danger", "×");
        delBtn.type = "button"; delBtn.title = "Delete";
        delBtn.addEventListener("click", function (e) { e.stopPropagation(); deleteField(i); });
        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(delBtn);
        head.appendChild(actions);

        head.addEventListener("click", function () {
          editor.expanded = editor.expanded === i ? -1 : i;
          renderFieldList();
        });
        li.appendChild(head);

        if (editor.expanded === i) {
          li.appendChild(buildFieldBody(f, head));
        }
        list.appendChild(li);
      });
    }

    function propRow(labelText, inputEl) {
      var row = el("div", "prop-row");
      var label = el("label", null, labelText);
      row.appendChild(label);
      row.appendChild(inputEl);
      return row;
    }

    function textInput(value, onChange) {
      var input = el("input");
      input.type = "text";
      input.value = value || "";
      input.addEventListener("input", function () { onChange(input.value); onFieldEdited(); });
      return input;
    }

    function numberInput(value, onChange) {
      var input = el("input");
      input.type = "number";
      if (value !== undefined && value !== null) input.value = String(value);
      input.addEventListener("input", function () {
        var n = parseFloat(input.value);
        onChange(isNaN(n) ? undefined : n);
        onFieldEdited();
      });
      return input;
    }

    function buildFieldBody(f, headEl) {
      var body = el("div", "field-body");

      var titleInput = textInput(f.title, function (v) {
        f.title = v;
        headEl.querySelector(".field-head-title").textContent = fieldSummary(f);
      });
      body.appendChild(propRow("Question", titleInput));

      var subtitleInput = textInput(f.subtitle, function (v) {
        if (v) f.subtitle = v; else delete f.subtitle;
      });
      body.appendChild(propRow("Description (optional)", subtitleInput));

      var t = f.type;

      if (t === "text" || t === "textarea" || t === "email" || t === "phone" || t === "url" || t === "number") {
        var placeholderInput = textInput(f.placeholder, function (v) {
          if (v) f.placeholder = v; else delete f.placeholder;
        });
        body.appendChild(propRow("Placeholder", placeholderInput));
      }

      if (t === "choice" || t === "multi_choice" || t === "dropdown") {
        var optionsArea = el("textarea");
        optionsArea.rows = 4;
        optionsArea.value = (f.options || []).join("\\n");
        optionsArea.addEventListener("input", function () {
          f.options = optionsArea.value.split("\\n").map(function (s) { return s.trim(); }).filter(Boolean);
          onFieldEdited();
        });
        body.appendChild(propRow("Options (one per line)", optionsArea));
      }

      if (t === "rating") {
        body.appendChild(propRow("Max stars", numberInput(f.max || 5, function (v) { f.max = v || 5; })));
      }

      if (t === "scale") {
        var grid = el("div", "prop-grid");
        var minWrap = propRow("Min", numberInput(f.min, function (v) { f.min = v === undefined ? 0 : v; }));
        var maxWrap = propRow("Max", numberInput(f.max, function (v) { f.max = v === undefined ? 10 : v; }));
        grid.appendChild(minWrap);
        grid.appendChild(maxWrap);
        body.appendChild(grid);
        var grid2 = el("div", "prop-grid");
        grid2.appendChild(propRow("Min label", textInput(f.minLabel, function (v) { if (v) f.minLabel = v; else delete f.minLabel; })));
        grid2.appendChild(propRow("Max label", textInput(f.maxLabel, function (v) { if (v) f.maxLabel = v; else delete f.maxLabel; })));
        body.appendChild(grid2);
      }

      if (t === "welcome" || t === "statement") {
        body.appendChild(propRow("Button text", textInput(f.buttonText, function (v) {
          if (v) f.buttonText = v; else delete f.buttonText;
        })));
      }

      if (t !== "welcome" && t !== "statement" && t !== "ending") {
        var check = el("div", "prop-check");
        var checkbox = el("input");
        checkbox.type = "checkbox";
        checkbox.id = "req-" + f.id;
        checkbox.checked = !!f.required;
        checkbox.addEventListener("change", function () {
          f.required = checkbox.checked;
          onFieldEdited();
        });
        var checkLabel = el("label", null, "Required");
        checkLabel.setAttribute("for", checkbox.id);
        check.appendChild(checkbox);
        check.appendChild(checkLabel);
        body.appendChild(check);
      }

      return body;
    }

    function moveField(i, delta) {
      var fields = editor.schema.fields;
      var j = i + delta;
      if (j < 0 || j >= fields.length) return;
      var tmp = fields[i];
      fields[i] = fields[j];
      fields[j] = tmp;
      if (editor.expanded === i) editor.expanded = j;
      else if (editor.expanded === j) editor.expanded = i;
      renderFieldList();
      onFieldEdited();
    }

    function deleteField(i) {
      editor.schema.fields.splice(i, 1);
      if (editor.expanded === i) editor.expanded = -1;
      else if (editor.expanded > i) editor.expanded--;
      renderFieldList();
      onFieldEdited();
    }

    function addField(type) {
      editor.schema.fields = editor.schema.fields || [];
      var fields = editor.schema.fields;
      // Insert before the ending screen if there is one at the tail
      var insertAt = fields.length;
      if (type !== "ending" && fields.length > 0 && fields[fields.length - 1].type === "ending") {
        insertAt = fields.length - 1;
      }
      fields.splice(insertAt, 0, newField(type));
      editor.expanded = insertAt;
      renderFieldList();
      onFieldEdited();
      var list = $("field-list");
      if (list.children[insertAt]) list.children[insertAt].scrollIntoView({ block: "nearest" });
    }

    function onFieldEdited() {
      setEditorStatus("unsaved changes");
      schedulePreview();
    }

    // ── Add-field menu ──
    function buildAddFieldMenu() {
      var menu = $("add-field-menu");
      menu.innerHTML = "";
      FIELD_TYPES.forEach(function (t) {
        var btn = el("button", null, t.label);
        btn.type = "button";
        btn.addEventListener("click", function () {
          menu.classList.add("hidden");
          addField(t.type);
        });
        menu.appendChild(btn);
      });
    }

    // ── JSON mode ──
    function setJsonMode(on, skipSerialize) {
      editor.jsonMode = on;
      $("fields-panel").classList.toggle("hidden", on);
      $("json-panel").classList.toggle("hidden", !on);
      $("json-toggle").textContent = on ? "Fields" : "JSON";
      $("json-error").textContent = "";
      if (on && !skipSerialize) {
        $("json-text").value = JSON.stringify(editor.schema, null, 2);
      }
      if (on && skipSerialize && editor.schema) {
        $("json-text").value = JSON.stringify(editor.schema, null, 2);
      }
    }

    function applyJson() {
      var text = $("json-text").value;
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        $("json-error").textContent = "Not valid JSON: " + err.message;
        return;
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        $("json-error").textContent = "Schema must be a JSON object.";
        return;
      }
      $("json-error").textContent = "";
      editor.schema = parsed;
      editor.expanded = -1;
      $("editor-title").value = parsed.title || "";
      renderFieldList();
      onFieldEdited();
    }

    // ── Preview ──
    function schedulePreview(delay) {
      if (editor.previewTimer) clearTimeout(editor.previewTimer);
      editor.previewTimer = setTimeout(refreshPreview, delay === 0 ? 0 : 600);
    }

    function refreshPreview() {
      if (!editor.schema) return;
      $("preview-loading").classList.remove("hidden");
      apiFetch("/api/preview", {
        method: "POST",
        body: JSON.stringify({ schema: editor.schema })
      })
        .then(function (res) {
          if (res.ok) {
            return res.text().then(function (html) {
              $("preview-error").classList.add("hidden");
              $("preview-frame").srcdoc = html;
            });
          }
          return res.json().then(function (body) {
            $("preview-error").textContent = body.error || "Preview failed.";
            $("preview-error").classList.remove("hidden");
          });
        })
        .catch(function () {
          $("preview-error").textContent = "Could not reach the API for preview.";
          $("preview-error").classList.remove("hidden");
        })
        .then(function () {
          $("preview-loading").classList.add("hidden");
        });
    }

    // ── Publish ──
    function publish() {
      if (!editor.schema) return;
      var btn = $("publish-btn");
      btn.disabled = true;
      var isUpdate = !!editor.formId;
      btn.textContent = isUpdate ? "Saving…" : "Publishing…";

      var request = isUpdate
        ? apiFetch("/api/forms/" + editor.formId, { method: "PUT", body: JSON.stringify({ schema: editor.schema }) })
        : apiFetch("/api/forms", { method: "POST", body: JSON.stringify({ schema: editor.schema }) });

      request
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || ("Failed (" + res.status + ")"));
            return body;
          });
        })
        .then(function (body) {
          if (!isUpdate) {
            editor.formId = body.id;
            editor.publishedUrl = body.url;
            $("editor-results").classList.remove("hidden");
          }
          renderShareBar();
          btn.textContent = "Save";
          setEditorStatus(isUpdate ? "saved ✓" : "published ✓");
        })
        .catch(function (err) {
          setEditorStatus("");
          $("preview-error").textContent = err.message || "Publish failed.";
          $("preview-error").classList.remove("hidden");
          btn.textContent = isUpdate ? "Save" : "Publish";
        })
        .then(function () { btn.disabled = false; });
    }

    // ── Results view ──
    var results = {
      formId: null,
      title: "",
      url: "",
      schema: null,
      days: 7,
      chartMode: "chart",
      status: "completed",
      analytics: null,
      rows: [],
      total: 0
    };
    var PAGE_SIZE = 50;
    var SVGNS = "http://www.w3.org/2000/svg";

    function openResults(formId) {
      results.formId = formId;
      results.days = 7;
      results.chartMode = "chart";
      results.status = "completed";
      results.analytics = null;
      results.rows = [];
      results.total = 0;
      $("status-filter").value = "completed";
      $("chart-table-toggle").textContent = "Table";
      document.querySelectorAll(".range-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-days") === "7");
      });
      $("stat-grid").innerHTML = "";
      $("chart-area").innerHTML = "";
      $("responses-area").innerHTML = "";
      $("dropoff-line").classList.add("hidden");
      $("sheets-card").classList.add("hidden");
      show("view-results");

      apiFetch("/api/forms/" + formId)
        .then(function (res) {
          if (!res.ok) throw new Error("Could not load form (" + res.status + ")");
          return res.json();
        })
        .then(function (body) {
          results.title = body.title || "Untitled form";
          results.url = body.url;
          results.schema = body.schema || {};
          $("results-title").value = results.title;
          $("results-open").href = body.url;
          loadAnalytics();
          loadResponses(true);
          loadSheetsStatus();
        })
        .catch(function (err) {
          $("analytics-status").textContent = err.message;
        });
    }

    // ── Analytics ──
    function loadAnalytics() {
      $("analytics-status").textContent = "loading…";
      apiFetch("/api/responses/" + results.formId + "/analytics?days=" + results.days)
        .then(function (res) {
          if (!res.ok) throw new Error("Analytics failed (" + res.status + ")");
          return res.json();
        })
        .then(function (body) {
          results.analytics = body;
          $("analytics-status").textContent = "";
          renderStats();
          renderChartArea();
          renderDropoff();
        })
        .catch(function (err) {
          $("analytics-status").textContent = err.message;
        });
    }

    function formatDuration(sec) {
      sec = Math.round(sec || 0);
      if (sec < 60) return sec + "s";
      return Math.floor(sec / 60) + "m " + (sec % 60) + "s";
    }

    function statTile(label, value) {
      var tile = el("div", "stat-tile");
      tile.appendChild(el("div", "stat-label", label));
      tile.appendChild(el("div", "stat-value", value));
      return tile;
    }

    function renderStats() {
      var t = results.analytics.totals || {};
      var grid = $("stat-grid");
      grid.innerHTML = "";
      grid.appendChild(statTile("Submissions", String(t.submissions || 0)));
      grid.appendChild(statTile("Views", String(t.views || 0)));
      grid.appendChild(statTile("Completion rate", Math.round(t.completionRate || 0) + "%"));
      grid.appendChild(statTile("Avg time", formatDuration(t.avgDurationSeconds)));
    }

    function renderDropoff() {
      var line = $("dropoff-line");
      var d = results.analytics.highestDropoff;
      if (!d || !d.count) { line.classList.add("hidden"); return; }
      line.textContent = "Highest drop-off: \\u201C" + (d.fieldTitle || d.fieldId) + "\\u201D (" + d.count + " left here)";
      line.classList.remove("hidden");
    }

    function chartDateLabel(iso) {
      var d = new Date(iso + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }

    function svgEl(tag, attrs) {
      var node = document.createElementNS(SVGNS, tag);
      for (var k in attrs) node.setAttribute(k, attrs[k]);
      return node;
    }

    function renderChartArea() {
      var area = $("chart-area");
      area.innerHTML = "";
      var series = (results.analytics && results.analytics.series) || [];
      if (!series.length) {
        area.appendChild(el("div", "results-empty", "No activity in this period yet."));
        return;
      }
      if (results.chartMode === "table") renderChartTable(area, series);
      else renderChart(area, series);
    }

    function renderChartTable(area, series) {
      var wrap = el("div", "data-table-wrap");
      var table = el("table", "data-table");
      var thead = el("thead");
      var hr = el("tr");
      ["Date", "Views", "Submissions"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
      thead.appendChild(hr);
      table.appendChild(thead);
      var tbody = el("tbody");
      series.forEach(function (p) {
        var tr = el("tr");
        tr.appendChild(el("td", null, chartDateLabel(p.date)));
        tr.appendChild(el("td", null, String(p.views || 0)));
        tr.appendChild(el("td", null, String(p.submissions || 0)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      area.appendChild(wrap);
    }

    function renderChart(area, series) {
      var W = 840, H = 240, padL = 40, padR = 28, padT = 12, padB = 26;
      var innerW = W - padL - padR, innerH = H - padT - padB;
      var maxVal = 0;
      series.forEach(function (p) {
        maxVal = Math.max(maxVal, p.views || 0, p.submissions || 0);
      });
      if (maxVal < 4) maxVal = 4;

      var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
      svg.setAttribute("aria-label", "Views and submissions over the last " + results.days + " days");

      function x(i) { return padL + (series.length === 1 ? innerW / 2 : (i * innerW) / (series.length - 1)); }
      function y(v) { return padT + innerH - (v / maxVal) * innerH; }

      // Recessive gridlines + y tick labels (0, mid, max)
      [0, Math.round(maxVal / 2), maxVal].forEach(function (v) {
        var gy = y(v);
        var grid = svgEl("line", { x1: padL, x2: W - padR, y1: gy, y2: gy, "stroke-width": 1 });
        grid.style.stroke = "var(--ff-border)";
        svg.appendChild(grid);
        var label = svgEl("text", { x: padL - 8, y: gy + 3.5, "text-anchor": "end", "font-size": 10 });
        label.style.fill = "var(--ff-text-secondary)";
        label.style.fontFamily = "var(--ff-font-mono)";
        label.textContent = String(v);
        svg.appendChild(label);
      });

      // Sparse x labels: first, middle, last
      var xIdx = series.length > 2 ? [0, Math.floor((series.length - 1) / 2), series.length - 1] : [0, series.length - 1];
      xIdx.forEach(function (i) {
        if (i < 0 || i >= series.length) return;
        var label = svgEl("text", { x: x(i), y: H - 8, "text-anchor": "middle", "font-size": 10 });
        label.style.fill = "var(--ff-text-secondary)";
        label.style.fontFamily = "var(--ff-font-mono)";
        label.textContent = chartDateLabel(series[i].date);
        svg.appendChild(label);
      });

      // Series lines (2px)
      function linePath(key, colorVar) {
        var points = series.map(function (p, i) { return x(i) + "," + y(p[key] || 0); }).join(" ");
        var line = svgEl("polyline", { points: points, fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
        line.style.stroke = colorVar;
        svg.appendChild(line);
      }
      linePath("views", "var(--chart-views)");
      linePath("submissions", "var(--chart-submissions)");

      // Hover layer: crosshair + markers + tooltip
      var crosshair = svgEl("line", { y1: padT, y2: padT + innerH, "stroke-width": 1, visibility: "hidden" });
      crosshair.style.stroke = "var(--ff-border-hover)";
      svg.appendChild(crosshair);
      var dotViews = svgEl("circle", { r: 4, visibility: "hidden", "stroke-width": 2 });
      dotViews.style.fill = "var(--chart-views)";
      dotViews.style.stroke = "var(--ff-surface)";
      svg.appendChild(dotViews);
      var dotSubs = svgEl("circle", { r: 4, visibility: "hidden", "stroke-width": 2 });
      dotSubs.style.fill = "var(--chart-submissions)";
      dotSubs.style.stroke = "var(--ff-surface)";
      svg.appendChild(dotSubs);

      var tooltip = $("chart-tooltip");
      svg.addEventListener("mousemove", function (e) {
        var rect = svg.getBoundingClientRect();
        var relX = ((e.clientX - rect.left) / rect.width) * W;
        var i = Math.round(((relX - padL) / innerW) * (series.length - 1));
        if (series.length === 1) i = 0;
        if (i < 0) i = 0;
        if (i >= series.length) i = series.length - 1;
        var p = series[i];
        var cx = x(i);
        crosshair.setAttribute("x1", cx);
        crosshair.setAttribute("x2", cx);
        crosshair.setAttribute("visibility", "visible");
        dotViews.setAttribute("cx", cx);
        dotViews.setAttribute("cy", y(p.views || 0));
        dotViews.setAttribute("visibility", "visible");
        dotSubs.setAttribute("cx", cx);
        dotSubs.setAttribute("cy", y(p.submissions || 0));
        dotSubs.setAttribute("visibility", "visible");

        tooltip.innerHTML = "";
        tooltip.appendChild(el("div", "tt-date", chartDateLabel(p.date)));
        var subsRow = el("div");
        var subsChip = el("span", "chip");
        subsChip.style.cssText = "display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:var(--chart-submissions)";
        subsRow.appendChild(subsChip);
        subsRow.appendChild(document.createTextNode((p.submissions || 0) + " submissions"));
        tooltip.appendChild(subsRow);
        var viewsRow = el("div");
        var viewsChip = el("span", "chip");
        viewsChip.style.cssText = "display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:var(--chart-views)";
        viewsRow.appendChild(viewsChip);
        viewsRow.appendChild(document.createTextNode((p.views || 0) + " views"));
        tooltip.appendChild(viewsRow);

        var areaRect = area.getBoundingClientRect();
        var pxX = (cx / W) * rect.width + rect.left - areaRect.left;
        tooltip.style.display = "block";
        tooltip.style.left = Math.min(pxX + 12, areaRect.width - 150) + "px";
        tooltip.style.top = "10px";
      });
      svg.addEventListener("mouseleave", function () {
        crosshair.setAttribute("visibility", "hidden");
        dotViews.setAttribute("visibility", "hidden");
        dotSubs.setAttribute("visibility", "hidden");
        tooltip.style.display = "none";
      });

      area.appendChild(svg);
    }

    // ── Responses table ──
    function inputFields(schema) {
      return ((schema && schema.fields) || []).filter(function (f) {
        return f && f.type !== "welcome" && f.type !== "ending" && f.type !== "statement";
      });
    }

    function formatAnswer(value) {
      if (value === null || value === undefined || value === "") return "—";
      if (Array.isArray(value)) return value.join(", ");
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    }

    function loadResponses(reset) {
      if (reset) { results.rows = []; results.total = 0; }
      var q = "?limit=" + PAGE_SIZE + "&offset=" + results.rows.length + "&status=" + results.status;
      apiFetch("/api/responses/" + results.formId + q)
        .then(function (res) {
          if (!res.ok) throw new Error("Responses failed (" + res.status + ")");
          return res.json();
        })
        .then(function (body) {
          results.rows = results.rows.concat(body.responses || []);
          results.total = body.total || 0;
          renderResponses();
        })
        .catch(function (err) {
          $("responses-area").innerHTML = "";
          $("responses-area").appendChild(el("div", "results-empty", err.message));
        });
    }

    function renderResponses() {
      var area = $("responses-area");
      area.innerHTML = "";
      var showStatus = results.status !== "completed";

      if (!results.rows.length) {
        area.appendChild(el("div", "results-empty", "No responses yet. Share the form link to start collecting."));
        $("load-more").classList.add("hidden");
        return;
      }

      var fields = inputFields(results.schema);
      var table = el("table", "data-table");
      var thead = el("thead");
      var hr = el("tr");
      hr.appendChild(el("th", null, "Submitted"));
      if (showStatus) hr.appendChild(el("th", null, "Status"));
      fields.forEach(function (f) { hr.appendChild(el("th", null, f.title || f.id)); });
      thead.appendChild(hr);
      table.appendChild(thead);

      var tbody = el("tbody");
      results.rows.forEach(function (r) {
        var answers = {};
        try { answers = JSON.parse(r.answers_json || "{}"); } catch (_) {}
        var tr = el("tr");
        var when = new Date(r.submitted_at);
        tr.appendChild(el("td", null, isNaN(when.getTime()) ? r.submitted_at : when.toLocaleString()));
        if (showStatus) {
          var badge = el("td");
          badge.appendChild(el("span", "status-badge", r.status === "in_progress" ? "partial" : r.status));
          tr.appendChild(badge);
        }
        fields.forEach(function (f) {
          var cell = el("td", null, formatAnswer(answers[f.id]));
          cell.title = formatAnswer(answers[f.id]);
          tr.appendChild(cell);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      area.appendChild(table);

      $("load-more").classList.toggle("hidden", results.rows.length >= results.total);
    }

    // ── Connect Google Sheet ──
    var SHEETS_DOCS_URL = "https://github.com/chriscooning/formant/blob/main/docs/connect-google-sheet-local.md";
    var sheetsConfigured = null;

    function sheetUrlKey(formId) { return "formant_sheet_" + formId; }

    function hasSheetsDestination(schema) {
      var dests = (schema && schema.submit && schema.submit.destinations) || [];
      return dests.some(function (d) { return d && d.type === "sheets"; });
    }

    function loadSheetsStatus() {
      apiFetch("/api/connect-sheets/status")
        .then(function (res) { return res.ok ? res.json() : { configured: false }; })
        .then(function (body) {
          sheetsConfigured = !!body.configured;
          renderSheetsCard();
        })
        .catch(function () {
          sheetsConfigured = false;
          renderSheetsCard();
        });
    }

    function renderSheetsCard() {
      var card = $("sheets-card");
      card.innerHTML = "";
      if (sheetsConfigured === null || !results.schema) { card.classList.add("hidden"); return; }
      card.classList.remove("hidden");

      var text = el("div", "sheets-text");
      var connected = hasSheetsDestination(results.schema);

      if (connected) {
        var h = el("h3");
        h.appendChild(el("span", "connected-mark", "✓ "));
        h.appendChild(document.createTextNode("Google Sheet connected"));
        text.appendChild(h);
        text.appendChild(el("p", null, "New responses are synced to your spreadsheet."));
        card.appendChild(text);
        var sheetUrl = null;
        try { sheetUrl = localStorage.getItem(sheetUrlKey(results.formId)); } catch (_) {}
        if (sheetUrl) {
          var openSheet = el("a", "btn-ghost", "Open sheet");
          openSheet.href = sheetUrl;
          openSheet.target = "_blank";
          openSheet.rel = "noopener";
          card.appendChild(openSheet);
        }
        var reconnect = el("button", "btn-ghost", "Reconnect");
        reconnect.type = "button";
        reconnect.addEventListener("click", connectSheets);
        card.appendChild(reconnect);
        return;
      }

      text.appendChild(el("h3", null, "Connect a Google Sheet"));
      text.appendChild(el("p", null, "Sync new responses to a spreadsheet you can share."));
      card.appendChild(text);

      if (sheetsConfigured) {
        var connectBtn = el("button", "btn-primary", "Connect Google Sheet");
        connectBtn.type = "button";
        connectBtn.addEventListener("click", connectSheets);
        card.appendChild(connectBtn);
      } else {
        var docsLink = el("a", "btn-ghost", "How to set up");
        docsLink.href = SHEETS_DOCS_URL;
        docsLink.target = "_blank";
        docsLink.rel = "noopener";
        card.appendChild(docsLink);
      }
    }

    function connectSheets() {
      apiFetch("/api/connect-sheets/init", {
        method: "POST",
        body: JSON.stringify({
          redirect_uri: location.origin + location.pathname,
          form_id: results.formId,
          schema: results.schema
        })
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || ("Connect failed (" + res.status + ")"));
            return body;
          });
        })
        .then(function (body) {
          window.location.href = body.auth_url;
        })
        .catch(function (err) {
          $("analytics-status").textContent = err.message;
        });
    }

    // OAuth callback lands back on /admin with a hash fragment:
    //   #url=<webAppUrl>&spreadsheetUrl=<...>&formId=<...>   (success)
    //   #error=<code>[&message=...]                          (failure)
    function parseSheetsCallback() {
      var h = location.hash;
      if (!h || h.length < 2) return null;
      var params = new URLSearchParams(h.slice(1));
      if (params.get("error")) {
        history.replaceState(null, "", location.pathname);
        return { error: params.get("error"), message: params.get("message") || "" };
      }
      if (params.get("url") && params.get("formId")) {
        history.replaceState(null, "", location.pathname);
        return {
          url: params.get("url"),
          spreadsheetUrl: params.get("spreadsheetUrl") || "",
          formId: params.get("formId")
        };
      }
      return null;
    }

    // Persist the new sheets destination into the form schema (the server
    // reassembles the form HTML), then open Results in the connected state.
    function completeSheetsConnection(cb) {
      if (cb.error) {
        setStatus("Google Sheet connection failed: " + cb.error + (cb.message ? " — " + cb.message : ""), true);
        return;
      }
      try { localStorage.setItem(sheetUrlKey(cb.formId), cb.spreadsheetUrl); } catch (_) {}
      apiFetch("/api/forms/" + cb.formId)
        .then(function (res) {
          if (!res.ok) throw new Error("Could not load form (" + res.status + ")");
          return res.json();
        })
        .then(function (body) {
          var schema = body.schema || {};
          var submit = schema.submit || {};
          var dests = (submit.destinations || []).filter(function (d) { return !d || d.type !== "sheets"; });
          dests.push({ type: "sheets", url: cb.url });
          schema.submit = submit;
          submit.destinations = dests;
          return apiFetch("/api/forms/" + cb.formId, {
            method: "PUT",
            body: JSON.stringify({ schema: schema })
          });
        })
        .then(function (res) {
          if (!res.ok) throw new Error("Could not save sheet connection (" + res.status + ")");
          openResults(cb.formId);
        })
        .catch(function (err) {
          setStatus(err.message, true);
        });
    }

    // ── Exports ──
    function downloadExport(format) {
      apiFetch("/api/responses/" + results.formId + "/" + format)
        .then(function (res) {
          if (!res.ok) throw new Error("Export failed (" + res.status + ")");
          return res.blob();
        })
        .then(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = (results.title || "responses").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "." + (format === "xlsx" ? "xlsx" : "csv");
          document.body.appendChild(a);
          a.click();
          a.remove();
        })
        .catch(function (err) {
          $("analytics-status").textContent = err.message;
        });
    }

    // ── Forms list ──
    function formatDate(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function renderForms(forms) {
      var list = $("form-list");
      var empty = $("empty-state");
      var count = $("form-count");
      list.innerHTML = "";
      count.textContent = forms.length === 1 ? "1 form" : forms.length + " forms";

      if (forms.length === 0) {
        empty.classList.remove("hidden");
        return;
      }
      empty.classList.add("hidden");

      forms.forEach(function (f) {
        var li = el("li", "form-card");

        var main = el("div", "form-card-main");
        main.appendChild(el("div", "form-title", f.title || "Untitled form"));

        var meta = el("div", "form-meta");
        var responses = el("span");
        responses.appendChild(el("strong", null, String(Number(f.submit_count || 0))));
        responses.appendChild(document.createTextNode(" responses"));
        var views = el("span");
        views.appendChild(el("strong", null, String(Number(f.view_count || 0))));
        views.appendChild(document.createTextNode(" views"));
        meta.appendChild(responses);
        meta.appendChild(views);
        meta.appendChild(el("span", null, formatDate(f.created_at)));
        main.appendChild(meta);

        var actions = el("div", "form-actions");

        var resultsBtn = el("button", "btn-ghost", "Results");
        resultsBtn.type = "button";
        resultsBtn.addEventListener("click", function () { openResults(f.id); });

        var editBtn = el("button", "btn-ghost", "Edit");
        editBtn.type = "button";
        editBtn.addEventListener("click", function () { loadFormIntoEditor(f.id); });

        var openBtn = el("a", "btn-ghost", "Open");
        openBtn.href = f.url;
        openBtn.target = "_blank";
        openBtn.rel = "noopener";

        var copyBtn = el("button", "btn-ghost", "Copy link");
        copyBtn.type = "button";
        copyBtn.addEventListener("click", function () {
          var link = location.origin + f.url;
          var done = function () {
            copyBtn.textContent = "Copied ✓";
            setTimeout(function () { copyBtn.textContent = "Copy link"; }, 1500);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(done, done);
          } else { done(); }
        });

        actions.appendChild(resultsBtn);
        actions.appendChild(editBtn);
        actions.appendChild(openBtn);
        actions.appendChild(copyBtn);

        li.appendChild(main);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    function setStatus(message, isError) {
      var status = $("list-status");
      if (!message) {
        status.classList.add("hidden");
        return;
      }
      status.textContent = message;
      status.className = "status-line" + (isError ? " error" : "");
    }

    function loadForms() {
      return apiFetch("/api/forms").then(function (res) {
        if (!res.ok) throw new Error("list failed " + res.status);
        return res.json();
      }).then(function (body) {
        renderForms(body.forms || []);
        setStatus("");
      });
    }

    function loadFormIntoEditor(formId) {
      setStatus("Opening form…", false);
      apiFetch("/api/forms/" + formId)
        .then(function (res) {
          if (!res.ok) throw new Error("Could not load form (" + res.status + ")");
          return res.json();
        })
        .then(function (body) {
          setStatus("");
          openEditor(body.id, body.schema || {}, false);
        })
        .catch(function (err) {
          setStatus(err.message, true);
        });
    }

    // ── Auth flow ──
    function signIn(key, fromStored) {
      var btn = $("login-btn");
      var errorLine = $("login-error");
      btn.disabled = true;
      errorLine.textContent = "";

      fetch("/api/forms", { headers: { Authorization: "Bearer " + key } })
        .then(function (res) {
          if (res.status === 401) {
            throw new Error(fromStored ? "" : "That API key was not accepted.");
          }
          if (!res.ok) throw new Error("Something went wrong (" + res.status + "). Try again.");
          return res.json();
        })
        .then(function (body) {
          try { localStorage.setItem(KEY_STORAGE, key); } catch (_) {}
          renderForms(body.forms || []);
          setStatus("");
          show("view-workspace");
        })
        .catch(function (err) {
          try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
          show("view-login");
          errorLine.textContent = err.message || "Could not reach the API.";
        })
        .then(function () { btn.disabled = false; });
    }

    function signOut() {
      try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
      $("api-key").value = "";
      $("login-error").textContent = "";
      show("view-login");
    }

    // ── Wire up ──
    $("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var key = $("api-key").value.trim();
      if (!key) return;
      signIn(key, false);
    });
    $("signout-btn").addEventListener("click", signOut);
    $("theme-toggle").addEventListener("click", toggleTheme);

    function toggleMenu(menuId) {
      $(menuId).classList.toggle("hidden");
    }
    $("new-form-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMenu("new-form-menu");
    });
    $("empty-new-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMenu("new-form-menu");
    });
    $("new-form-menu").addEventListener("click", function (e) {
      var tpl = e.target && e.target.getAttribute("data-template");
      if (!tpl) return;
      $("new-form-menu").classList.add("hidden");
      if (tpl === "json") {
        openEditor(null, tplBlank(), true);
        $("json-text").value = "";
        $("json-text").placeholder = "Paste your AI-generated schema JSON here, then hit Apply.";
      } else {
        openEditor(null, TEMPLATES[tpl](), false);
      }
    });
    document.addEventListener("click", function () {
      $("new-form-menu").classList.add("hidden");
      $("add-field-menu").classList.add("hidden");
    });

    $("editor-back").addEventListener("click", function () {
      show("view-workspace");
      setStatus("Refreshing…", false);
      loadForms().catch(function () { setStatus("Could not refresh forms.", true); });
    });
    $("editor-title").addEventListener("input", function () {
      if (!editor.schema) return;
      editor.schema.title = $("editor-title").value;
      onFieldEdited();
    });
    $("publish-btn").addEventListener("click", publish);
    $("json-toggle").addEventListener("click", function () { setJsonMode(!editor.jsonMode); });
    $("json-apply").addEventListener("click", applyJson);
    $("add-field-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMenu("add-field-menu");
    });
    $("add-field-menu").addEventListener("click", function (e) { e.stopPropagation(); });
    // Results view wiring
    $("results-back").addEventListener("click", function () {
      show("view-workspace");
      loadForms().catch(function () { setStatus("Could not refresh forms.", true); });
    });
    $("results-edit").addEventListener("click", function () {
      loadFormIntoEditor(results.formId);
    });
    $("editor-results").addEventListener("click", function () {
      if (editor.formId) openResults(editor.formId);
    });
    document.querySelectorAll(".range-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        results.days = parseInt(btn.getAttribute("data-days"), 10) || 7;
        document.querySelectorAll(".range-btn").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
        loadAnalytics();
      });
    });
    $("chart-table-toggle").addEventListener("click", function () {
      results.chartMode = results.chartMode === "chart" ? "table" : "chart";
      $("chart-table-toggle").textContent = results.chartMode === "chart" ? "Table" : "Chart";
      renderChartArea();
    });
    $("status-filter").addEventListener("change", function () {
      results.status = $("status-filter").value;
      loadResponses(true);
    });
    $("load-more").addEventListener("click", function () { loadResponses(false); });
    $("export-csv").addEventListener("click", function () { downloadExport("csv"); });
    $("export-xlsx").addEventListener("click", function () { downloadExport("xlsx"); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        $("new-form-menu").classList.add("hidden");
        $("add-field-menu").classList.add("hidden");
      }
    });

    $("share-embed").addEventListener("click", function () { toggleSharePane("embed"); });
    $("share-qr").addEventListener("click", function () { toggleSharePane("qr"); });
    $("embed-copy").addEventListener("click", function () {
      var btn = $("embed-copy");
      var done = function () {
        btn.textContent = "Copied ✓";
        setTimeout(function () { btn.textContent = "Copy code"; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText($("embed-code").value).then(done, done);
      } else { done(); }
    });
    $("qr-download").addEventListener("click", function () {
      if (!qrSvgText) return;
      var blob = new Blob([qrSvgText], { type: "image/svg+xml" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = ((editor.schema && editor.schema.title) || "form").toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-qr.svg";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    $("share-copy").addEventListener("click", function () {
      var link = location.origin + (editor.publishedUrl || "");
      var btn = $("share-copy");
      var done = function () {
        btn.textContent = "Copied ✓";
        setTimeout(function () { btn.textContent = "Copy link"; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, done);
      } else { done(); }
    });

    buildAddFieldMenu();

    // ── Boot ──
    var storedKey = apiKey();
    var sheetsCallback = parseSheetsCallback();
    if (storedKey) {
      show("view-workspace");
      setStatus("Loading your forms…", false);
      signIn(storedKey, true);
      if (sheetsCallback) completeSheetsConnection(sheetsCallback);
    } else {
      show("view-login");
    }
  })();
  </script>
</body>
</html>`;
