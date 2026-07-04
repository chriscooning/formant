// ─── Workspace Shell (Phase W3) ───
// Self-contained admin page served at GET /admin. API-key login + forms list.
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
    input { font-family: inherit; }

    .hidden { display: none !important; }

    /* ── Login view ── */
    .login-wrap {
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .login-card {
      width: 100%;
      max-width: 380px;
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 40px 36px;
    }
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
    }
    .login-card .brand { margin-bottom: 8px; }
    .login-sub {
      color: var(--ff-text-secondary);
      font-size: 14px;
      margin-bottom: 28px;
    }
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
      color: var(--ff-text);
      font-size: 16px;
      padding: 8px 2px;
      outline: none;
      transition: border-color var(--ff-transition);
    }
    .login-card input:focus { border-bottom-color: var(--ff-accent); }
    .login-error {
      color: var(--ff-error);
      font-size: 13px;
      min-height: 20px;
      margin-top: 10px;
    }
    .btn-primary {
      width: 100%;
      margin-top: 10px;
      background: var(--ff-accent);
      color: #fff;
      border: none;
      border-radius: var(--ff-radius);
      font-size: 15px;
      font-weight: 600;
      padding: 12px 16px;
      transition: background var(--ff-transition);
    }
    .btn-primary:hover { background: var(--ff-accent-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: default; }
    .login-hint {
      margin-top: 20px;
      font-size: 12px;
      color: var(--ff-text-secondary);
      line-height: 1.5;
    }

    /* ── Workspace view ── */
    .topbar {
      border-bottom: 1px solid var(--ff-border);
      background: var(--ff-surface);
    }
    .topbar-inner {
      max-width: 880px;
      margin: 0 auto;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .topbar-actions { display: flex; align-items: center; gap: 8px; }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--ff-border);
      border-radius: 999px;
      color: var(--ff-text-secondary);
      font-size: 13px;
      padding: 6px 14px;
      transition: border-color var(--ff-transition), color var(--ff-transition);
    }
    .btn-ghost:hover { border-color: var(--ff-border-hover); color: var(--ff-text); }
    .theme-toggle {
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    main {
      max-width: 880px;
      margin: 0 auto;
      padding: 36px 24px 64px;
    }
    .page-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 20px;
    }
    .page-head h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; }
    .form-count {
      font-family: var(--ff-font-mono);
      font-size: 12px;
      color: var(--ff-text-secondary);
    }

    .status-line {
      color: var(--ff-text-secondary);
      font-size: 14px;
      padding: 24px 0;
    }
    .status-line.error { color: var(--ff-error); }

    .form-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .form-card {
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: var(--ff-radius);
      padding: 18px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      transition: border-color var(--ff-transition), background var(--ff-transition);
    }
    .form-card:hover { border-color: var(--ff-border-hover); background: var(--ff-surface-hover); }
    .form-card-main { min-width: 0; }
    .form-title {
      font-size: 16px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 6px;
    }
    .form-meta {
      display: flex;
      gap: 14px;
      font-family: var(--ff-font-mono);
      font-size: 11.5px;
      color: var(--ff-text-secondary);
      white-space: nowrap;
    }
    .form-meta strong { color: var(--ff-text); font-weight: 600; }
    .form-actions { display: flex; gap: 8px; flex-shrink: 0; }

    .empty-state {
      border: 1px dashed var(--ff-border-hover);
      border-radius: var(--ff-radius);
      padding: 48px 32px;
      text-align: center;
    }
    .empty-state h2 { font-size: 17px; font-weight: 600; margin-bottom: 8px; }
    .empty-state p { color: var(--ff-text-secondary); font-size: 14px; margin-bottom: 18px; }
    .empty-state code {
      display: inline-block;
      font-family: var(--ff-font-mono);
      font-size: 12.5px;
      background: var(--ff-surface);
      border: 1px solid var(--ff-border);
      border-radius: 6px;
      padding: 10px 14px;
      color: var(--ff-text);
    }

    @media (max-width: 560px) {
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

  <!-- ── Workspace ── -->
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
        <span id="form-count" class="form-count"></span>
      </div>
      <div id="list-status" class="status-line hidden"></div>
      <ul id="form-list" class="form-list"></ul>
      <div id="empty-state" class="empty-state hidden">
        <h2>No forms yet</h2>
        <p>Describe a form to the AI in your editor, then deploy it here.</p>
        <code>pnpm formant deploy forms/my-form.html --target cloudflare</code>
      </div>
    </main>
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

    // ── View switching ──
    var viewLogin = document.getElementById("view-login");
    var viewWorkspace = document.getElementById("view-workspace");
    function showLogin() {
      viewLogin.classList.remove("hidden");
      viewWorkspace.classList.add("hidden");
      document.getElementById("api-key").focus();
    }
    function showWorkspace() {
      viewWorkspace.classList.remove("hidden");
      viewLogin.classList.add("hidden");
    }

    // ── API ──
    function fetchForms(apiKey) {
      return fetch("/api/forms", {
        headers: { Authorization: "Bearer " + apiKey },
      });
    }

    // ── Rendering ──
    function formatDate(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function renderForms(forms) {
      var list = document.getElementById("form-list");
      var empty = document.getElementById("empty-state");
      var count = document.getElementById("form-count");
      list.innerHTML = "";
      count.textContent = forms.length === 1 ? "1 form" : forms.length + " forms";

      if (forms.length === 0) {
        empty.classList.remove("hidden");
        return;
      }
      empty.classList.add("hidden");

      forms.forEach(function (f) {
        var li = document.createElement("li");
        li.className = "form-card";

        var main = document.createElement("div");
        main.className = "form-card-main";

        var title = document.createElement("div");
        title.className = "form-title";
        title.textContent = f.title || "Untitled form";
        main.appendChild(title);

        var meta = document.createElement("div");
        meta.className = "form-meta";
        var responses = document.createElement("span");
        responses.innerHTML = "<strong>" + Number(f.submit_count || 0) + "</strong> responses";
        var views = document.createElement("span");
        views.innerHTML = "<strong>" + Number(f.view_count || 0) + "</strong> views";
        var created = document.createElement("span");
        created.textContent = formatDate(f.created_at);
        meta.appendChild(responses);
        meta.appendChild(views);
        meta.appendChild(created);
        main.appendChild(meta);

        var actions = document.createElement("div");
        actions.className = "form-actions";

        var openBtn = document.createElement("a");
        openBtn.className = "btn-ghost";
        openBtn.style.textDecoration = "none";
        openBtn.style.display = "inline-flex";
        openBtn.style.alignItems = "center";
        openBtn.textContent = "Open";
        openBtn.href = f.url;
        openBtn.target = "_blank";
        openBtn.rel = "noopener";

        var copyBtn = document.createElement("button");
        copyBtn.className = "btn-ghost";
        copyBtn.type = "button";
        copyBtn.textContent = "Copy link";
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

        actions.appendChild(openBtn);
        actions.appendChild(copyBtn);

        li.appendChild(main);
        li.appendChild(actions);
        list.appendChild(li);
      });
    }

    function setStatus(message, isError) {
      var status = document.getElementById("list-status");
      if (!message) {
        status.classList.add("hidden");
        return;
      }
      status.textContent = message;
      status.className = "status-line" + (isError ? " error" : "");
    }

    // ── Auth flow ──
    function signIn(apiKey, fromStored) {
      var btn = document.getElementById("login-btn");
      var errorLine = document.getElementById("login-error");
      btn.disabled = true;
      errorLine.textContent = "";

      fetchForms(apiKey)
        .then(function (res) {
          if (res.status === 401) {
            throw new Error(fromStored ? "" : "That API key was not accepted.");
          }
          if (!res.ok) throw new Error("Something went wrong (" + res.status + "). Try again.");
          return res.json();
        })
        .then(function (body) {
          try { localStorage.setItem(KEY_STORAGE, apiKey); } catch (_) {}
          renderForms(body.forms || []);
          setStatus("");
          showWorkspace();
        })
        .catch(function (err) {
          try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
          showLogin();
          errorLine.textContent = err.message || "Could not reach the API.";
        })
        .then(function () { btn.disabled = false; });
    }

    function signOut() {
      try { localStorage.removeItem(KEY_STORAGE); } catch (_) {}
      document.getElementById("api-key").value = "";
      document.getElementById("login-error").textContent = "";
      showLogin();
    }

    // ── Wire up ──
    document.getElementById("login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var key = document.getElementById("api-key").value.trim();
      if (!key) return;
      signIn(key, false);
    });
    document.getElementById("signout-btn").addEventListener("click", signOut);
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

    // ── Boot ──
    var storedKey = null;
    try { storedKey = localStorage.getItem(KEY_STORAGE); } catch (_) {}
    if (storedKey) {
      showWorkspace();
      setStatus("Loading your forms…", false);
      signIn(storedKey, true);
    } else {
      showLogin();
    }
  })();
  </script>
</body>
</html>`;
