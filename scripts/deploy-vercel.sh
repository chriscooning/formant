#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Vercel (static hosting) ───
#
# Options:
#   --with-admin       Include admin panel (form + admin, IndexedDB responses)
#   --with-sheets      Deploy Worker first, form + admin with Connect Google Sheet
#   --with-backend     Deploy Vercel API (service-vercel) + Postgres, upload form, generate dashboard
#   --admin-password   Admin password for --with-admin (or FORMANT_ADMIN_PASSWORD env)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE_VERCEL_DIR="$ROOT_DIR/packages/service-vercel"

HTML_FILE="${1:?Usage: deploy-vercel.sh <form.html> [--with-admin] [--with-sheets] [--with-backend] [--admin-password <p>]}"
shift

WITH_ADMIN=false
WITH_SHEETS=false
WITH_BACKEND=false
ADMIN_PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-admin)
      WITH_ADMIN=true
      shift
      ;;
    --with-sheets)
      WITH_SHEETS=true
      shift
      ;;
    --with-backend)
      WITH_BACKEND=true
      shift
      ;;
    --admin-password)
      ADMIN_PASSWORD="${2:?Error: --admin-password requires a value}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Resolve to absolute path
HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: file not found: $HTML_FILE" >&2
  exit 1
fi

# ─── Check Vercel CLI ───

if ! command -v vercel &>/dev/null; then
  echo "Vercel CLI not found."
  read -rp "Install it now with 'npm i -g vercel'? (Y/n): " install_choice
  if [[ "${install_choice:-Y}" =~ ^[Yy] ]]; then
    npm i -g vercel
  else
    echo "Aborting — install vercel CLI and try again." >&2
    exit 1
  fi
fi

# ─── Check authentication ───

echo "Checking Vercel authentication..."
if ! vercel whoami &>/dev/null 2>&1; then
  echo "Not logged in to Vercel. Starting login..."
  vercel login
fi
echo "Authenticated as: $(vercel whoami 2>/dev/null)"
echo ""

# ─── Phase: --with-backend → deploy Vercel API + upload form ───

API_URL=""
FORM_ID=""
API_KEY=""
PATCHED_HTML=""

if [[ "$WITH_BACKEND" == true ]]; then
  if [[ ! -d "$SERVICE_VERCEL_DIR" ]]; then
    echo "Error: packages/service-vercel not found." >&2
    exit 1
  fi

  # Companion schema required
  JSON_FILE="${HTML_FILE%.html}.json"
  if [[ ! -f "$JSON_FILE" ]]; then
    echo "Error: schema not found: $JSON_FILE (required for --with-backend)" >&2
    echo "Run: pnpm formant build forms/<name>.json -o forms/<name>.html" >&2
    exit 1
  fi

  echo "Deploying Vercel API (service-vercel)..."
  cd "$SERVICE_VERCEL_DIR"
  API_DEPLOY_OUT="$ROOT_DIR/.deploy-api-out-$$"
  trap 'rm -f "$API_DEPLOY_OUT"' EXIT
  if ! vercel deploy --yes 2>&1 | tee "$API_DEPLOY_OUT"; then
    echo "Error: Vercel API deploy failed." >&2
    exit 1
  fi
  API_URL=$(grep -oE 'https://[^[:space:]]+\.vercel\.app' "$API_DEPLOY_OUT" 2>/dev/null | head -1)
  if [[ -z "$API_URL" ]]; then
    echo "Error: could not parse API URL from deploy output." >&2
    exit 1
  fi
  echo ""
  echo "  ✓ API deployed: $API_URL"
  echo ""

  # Run migrations if POSTGRES_URL available
  if [[ -n "${POSTGRES_URL:-}" ]] && command -v psql &>/dev/null; then
    echo "Running Postgres migrations..."
    if psql "$POSTGRES_URL" -f "$SERVICE_VERCEL_DIR/src/db/schema.sql" 2>/dev/null; then
      echo "  ✓ Migrations applied"
    else
      echo "  Note: Run migrations manually: psql \$POSTGRES_URL -f packages/service-vercel/src/db/schema.sql"
    fi
    echo ""
  else
    echo "  Note: Ensure POSTGRES_URL is set in Vercel project. Run migrations:"
    echo "    cd packages/service-vercel && vercel env pull && psql \$POSTGRES_URL -f src/db/schema.sql"
    echo ""
  fi

  # Generate API key and form ID
  if command -v uuidgen &>/dev/null; then
    API_KEY=$(uuidgen)
    FORM_ID=$(uuidgen | tr -d '-' | head -c 12)
  elif command -v openssl &>/dev/null; then
    API_KEY=$(openssl rand -hex 16)
    FORM_ID=$(openssl rand -hex 6)
  else
    API_KEY=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
    FORM_ID=$(head -c 12 /dev/urandom | xxd -p | tr -d '\n')
  fi

  # Patch schema with service destination
  PATCHED_SCHEMA_FILE="$(mktemp)"
  node -e "
    const fs = require('fs');
    let schema;
    try { schema = JSON.parse(fs.readFileSync(process.env.JSON_FILE, 'utf-8')); } catch(e) { process.exit(1); }
    const dest = { type: 'service', formId: process.env.FORM_ID, endpoint: process.env.API_URL };
    schema.submit = schema.submit || {};
    schema.submit.destinations = schema.submit.destinations || [];
    const existing = schema.submit.destinations.filter(d => d.type !== 'service');
    schema.submit.destinations = [...existing, dest];
    fs.writeFileSync(process.env.OUT, JSON.stringify(schema));
  " JSON_FILE="$JSON_FILE" FORM_ID="$FORM_ID" API_URL="$API_URL" OUT="$PATCHED_SCHEMA_FILE"

  # Patch HTML: replace __FORMANT_SCHEMA__ with patched schema
  PATCHED_HTML="$ROOT_DIR/.formant-patched-$$.html"
  node -e "
    const fs = require('fs');
    const html = fs.readFileSync(process.env.HTML_FILE, 'utf-8');
    const schema = fs.readFileSync(process.env.PATCHED_SCHEMA_FILE, 'utf-8').replace(/<\\\\/script>/gi, '<\\\\/script>');
    const marker = 'var __FORMANT_SCHEMA__ = ';
    const idx = html.indexOf(marker);
    if (idx === -1) { console.error('Could not find __FORMANT_SCHEMA__ in HTML'); process.exit(1); }
    const end = html.indexOf(';', idx + marker.length);
    if (end === -1) { process.exit(1); }
    const newHtml = html.slice(0, idx) + marker + schema + html.slice(end);
    fs.writeFileSync(process.env.PATCHED_HTML, newHtml);
  " HTML_FILE="$HTML_FILE" PATCHED_SCHEMA_FILE="$PATCHED_SCHEMA_FILE" PATCHED_HTML="$PATCHED_HTML"

  # Upload form
  echo "Uploading form to API..."
  cd "$ROOT_DIR"
  BODY_FILE="$(mktemp)"
  node -e "
    const fs = require('fs');
    const html = fs.readFileSync(process.env.PATCHED_HTML, 'utf-8');
    const schema = JSON.parse(fs.readFileSync(process.env.PATCHED_SCHEMA_FILE, 'utf-8'));
    fs.writeFileSync(process.env.BODY_FILE, JSON.stringify({ html, schema, id: process.env.FORM_ID }));
  " PATCHED_HTML="$PATCHED_HTML" PATCHED_SCHEMA_FILE="$PATCHED_SCHEMA_FILE" BODY_FILE="$BODY_FILE" FORM_ID="$FORM_ID"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/forms" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "@$BODY_FILE")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
    echo "Error uploading form (HTTP $HTTP_CODE): $BODY" >&2
    exit 1
  fi

  echo "  ✓ Form uploaded"
  echo ""

  # Generate dashboard
  BASENAME=$(basename "$HTML_FILE" .html)
  FORM_TITLE=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.env.F,'utf8')).title||'form')}catch{console.log('form')}" F="$PATCHED_SCHEMA_FILE" 2>/dev/null || echo "form")
  TEMPLATE="$ROOT_DIR/.cursor/skills/formant/templates/responses-dashboard.html"
  DASHBOARD_OUT="$ROOT_DIR/forms/${BASENAME}-dashboard.html"
  if [[ -f "$TEMPLATE" ]]; then
    CONNECT_SHEETS_DOCS_URL="${CONNECT_SHEETS_DOCS_URL:-https://github.com/chriscooning/formant/blob/main/docs/connect-google-sheet-local.md}"
    node -e "
      const fs = require('fs');
      const path = require('path');
      let schema = fs.readFileSync(process.env.PATCHED_SCHEMA_FILE, 'utf-8').replace(/<\\\\/script>/gi, '<\\\\/script>');
      let t = fs.readFileSync(process.env.TEMPLATE, 'utf-8');
      t = t.replace(/\{\{WORKER_URL\}\}/g, process.env.API_URL || '');
      t = t.replace(/\{\{FORM_ID\}\}/g, process.env.FORM_ID || '');
      t = t.replace(/\{\{CONNECT_SHEETS_DOCS_URL\}\}/g, process.env.CONNECT_SHEETS_DOCS_URL || '');
      const title = (process.env.FORM_TITLE || 'form').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
      t = t.replace(/\{\{FORM_TITLE\}\}/g, title);
      t = t.replace(/\{\{SCHEMA_JSON\}\}/, schema);
      fs.mkdirSync(path.dirname(process.env.DASHBOARD_OUT), { recursive: true });
      fs.writeFileSync(process.env.DASHBOARD_OUT, t);
    " TEMPLATE="$TEMPLATE" DASHBOARD_OUT="$DASHBOARD_OUT" API_URL="$API_URL" FORM_ID="$FORM_ID" FORM_TITLE="$FORM_TITLE" PATCHED_SCHEMA_FILE="$PATCHED_SCHEMA_FILE" CONNECT_SHEETS_DOCS_URL="$CONNECT_SHEETS_DOCS_URL"
  fi

  # Use patched HTML for static deploy
  HTML_FILE="$PATCHED_HTML"

  echo "  ═══════════════════════════════════════════════"
  echo "  ✓ Backend deployed successfully!"
  echo ""
  echo "  Live URL:  $API_URL/f/$FORM_ID"
  echo "  API Key:   $API_KEY"
  echo "  Form ID:   $FORM_ID"
  echo ""
  echo "  Management commands:"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $API_URL/api/responses/$FORM_ID"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $API_URL/api/responses/$FORM_ID/xlsx -o responses.xlsx"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $API_URL/api/responses/$FORM_ID/csv -o responses.csv"
  echo "    curl -X DELETE -H 'Authorization: Bearer $API_KEY' $API_URL/api/forms/$FORM_ID"
  echo ""
  echo "  Dashboard: forms/${BASENAME}-dashboard.html (open locally, paste API key)"
  echo "  ═══════════════════════════════════════════════"
  echo ""
fi

# ─── Phase B: --with-sheets → deploy Worker first ───

if [[ "$WITH_SHEETS" == true ]]; then
  echo "Deploying Cloudflare Worker first (required for Connect Google Sheet)..."
  if [[ -z "${WORKER_URL:-}" ]]; then
    DEPLOY_CF_OUT="$ROOT_DIR/.deploy-cf-out-$$"
    trap 'rm -f "$DEPLOY_CF_OUT"' EXIT
    if ! WORKER_ONLY=1 bash "$SCRIPT_DIR/deploy-cloudflare.sh" "$HTML_FILE" 2>&1 | tee "$DEPLOY_CF_OUT"; then
      echo "Error: Cloudflare deploy failed. Run 'wrangler login' if needed." >&2
      exit 1
    fi
    WORKER_URL=$(grep -oE 'https://[^[:space:]]+\.workers\.dev' "$DEPLOY_CF_OUT" | head -1)
    if [[ -z "$WORKER_URL" ]]; then
      echo "Error: could not parse Worker URL. Set WORKER_URL manually and retry." >&2
      exit 1
    fi
    rm -f "$DEPLOY_CF_OUT"
    trap - EXIT
  else
    echo "Using existing WORKER_URL: $WORKER_URL"
  fi
  echo ""
fi

# ─── Ensure form + admin when --with-admin or --with-sheets ───

ADMIN_HTML=""
if [[ "$WITH_ADMIN" == true || "$WITH_SHEETS" == true ]]; then
  SCHEMA_JSON="${HTML_FILE%.html}.json"
  ADMIN_HTML="${HTML_FILE%.html}-admin.html"

  if [[ ! -f "$ADMIN_HTML" ]]; then
    if [[ ! -f "$SCHEMA_JSON" ]]; then
      echo "Error: schema not found: $SCHEMA_JSON (required to build admin)" >&2
      echo "Run: pnpm formant build forms/<name>.json --local" >&2
      exit 1
    fi
    if [[ -z "$ADMIN_PASSWORD" && -z "${FORMANT_ADMIN_PASSWORD:-}" ]]; then
      echo "Error: admin password required. Set FORMANT_ADMIN_PASSWORD or use --admin-password <p>" >&2
      exit 1
    fi
    echo "Building form + admin..."
    export FORMANT_ADMIN_PASSWORD="${ADMIN_PASSWORD:-$FORMANT_ADMIN_PASSWORD}"
    [[ "$WITH_SHEETS" == true && -n "${WORKER_URL:-}" ]] && export FORMANT_API_URL="$WORKER_URL"
    pnpm formant build "$SCHEMA_JSON" --local -o "$HTML_FILE"
  fi

  if [[ ! -f "$ADMIN_HTML" ]]; then
    echo "Error: admin not found after build: $ADMIN_HTML" >&2
    exit 1
  fi
fi

# ─── Deploy ───

TMPDIR="$(mktemp -d)"
cleanup_backend() {
  rm -f "${PATCHED_HTML:-}" "${PATCHED_SCHEMA_FILE:-}" "${BODY_FILE:-}" "${API_DEPLOY_OUT:-}"
}
trap 'rm -rf "$TMPDIR"; [[ "${WITH_BACKEND:-false}" == true ]] && cleanup_backend' EXIT

# Use lowercase dir name — Vercel uses it for project name and rejects uppercase
DEPLOY_DIR="$TMPDIR/formant-form"
mkdir -p "$DEPLOY_DIR"
cp "$HTML_FILE" "$DEPLOY_DIR/index.html"

if [[ -n "$ADMIN_HTML" && -f "$ADMIN_HTML" ]]; then
  cp "$ADMIN_HTML" "$DEPLOY_DIR/admin.html"
fi

# Minimal Vercel config — static SPA, single page
cat > "$DEPLOY_DIR/vercel.json" <<'VERCEL'
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false
}
VERCEL

echo "Deploying $(basename "$HTML_FILE") to Vercel..."
echo ""

cd "$DEPLOY_DIR"
# --yes and --non-interactive use defaults for first-time project setup.
# In non-interactive mode Vercel requires --scope; we try without first, then
# parse action_required/missing_scope and retry with the first available scope.
# For CI, set VERCEL_ORG_ID (or VERCEL_SCOPE) to skip scope detection.
VERCEL_SCOPE="${VERCEL_ORG_ID:-${VERCEL_SCOPE:-}}"

deploy_with_scope() {
  if [[ -n "$VERCEL_SCOPE" ]]; then
    vercel --yes --non-interactive --scope "$VERCEL_SCOPE"
  else
    vercel --yes --non-interactive
  fi
}

if ! deploy_with_scope >"$TMPDIR/vercel.out" 2>&1; then
  # In non-interactive mode, Vercel may return action_required/missing_scope and
  # ignores --scope when it detects non-TTY. Use `script` to fake a TTY so
  # --scope is respected. Parse scope slug from the suggested command.
  SCOPE=$(grep "vercel" "$TMPDIR/vercel.out" 2>/dev/null | grep -oE '\-\-scope [a-zA-Z0-9_-]+' | head -1 | awk '{print $2}')
  if [[ -n "$SCOPE" ]]; then
    echo "Using scope: $SCOPE (set VERCEL_ORG_ID to skip this)"
    # script -q -c "cmd" /dev/null runs cmd in a pty so Vercel accepts --scope
    if command -v script &>/dev/null; then
      script -q -c "vercel link --yes --scope $SCOPE && vercel --yes --non-interactive" /dev/null | tee "$TMPDIR/vercel.out"
    else
      echo "Install 'script' (bsdutils) for non-interactive deploy, or run in a real terminal." >&2
      exit 1
    fi
  else
    cat "$TMPDIR/vercel.out"
    echo ""
    echo "For non-interactive deploys, set VERCEL_ORG_ID or VERCEL_SCOPE to your team/org ID."
    exit 1
  fi
else
  cat "$TMPDIR/vercel.out"
fi

echo ""
echo "  ✓ Deployed. URL is shown above."
echo "  To deploy to production: vercel --prod --yes"
echo ""

# ─── Post-deploy instructions for admin / sheets ───

VERCEL_URL=$(grep -oE 'https://[^[:space:]]+\.vercel\.app' "$TMPDIR/vercel.out" 2>/dev/null | head -1)

if [[ -n "$ADMIN_HTML" && -n "$VERCEL_URL" ]]; then
  echo "  Form:  $VERCEL_URL/"
  echo "  Admin: $VERCEL_URL/admin.html"
  echo ""
  if [[ "$WITH_SHEETS" == true ]]; then
    echo "  Next: Open admin, unlock, and click Connect Google Sheet."
    echo "  Add your Vercel URL to Google Cloud OAuth: Authorized JavaScript origins"
    echo "  See: docs/connect-google-sheet-local.md (Production section)"
    echo ""
  else
    echo "  Responses stored in IndexedDB. Open admin to view, export CSV/XLSX."
    echo ""
  fi
fi

# ─── Optional Google Sheets setup (interactive only, form-only deploy) ───

if [[ -t 0 && -z "$ADMIN_HTML" ]]; then
  read -rp "Set up Google Sheets for response collection? (y/N): " sheets_choice
  if [[ "${sheets_choice:-N}" =~ ^[Yy] ]]; then
    exec bash "$SCRIPT_DIR/setup-sheets.sh"
  fi
fi
if [[ -z "$ADMIN_HTML" ]]; then
  echo "  Responses download as Excel by default. Set up Sheets later with: bash scripts/setup-sheets.sh"
  echo ""
fi
