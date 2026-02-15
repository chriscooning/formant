#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Cloudflare Workers (full-stack hosting) ───
#
# Upload-only mode: set WORKER_URL to skip Worker deploy and only upload the form.
# Example: WORKER_URL=https://formant.SUBDOMAIN.workers.dev bash scripts/deploy-cloudflare.sh forms/<name>.html

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_DIR="$ROOT_DIR/packages/service"
WRANGLER="pnpm --filter @formant/service exec wrangler"

HTML_FILE="${1:?Usage: deploy-cloudflare.sh <form.html>}"

# Resolve to absolute path
HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: file not found: $HTML_FILE" >&2
  exit 1
fi

# ─── Upload-only mode: WORKER_URL set → skip deploy ───

if [[ -n "${WORKER_URL:-}" ]]; then
  echo "WORKER_URL is set — skipping Worker deploy (upload-only mode)"
  echo "  Worker: $WORKER_URL"
  echo ""
else
  # ─── Step 1: Check wrangler ───

  echo "Checking wrangler..."
  if ! $WRANGLER --version &>/dev/null 2>&1; then
    echo "Error: wrangler not found. Install it with:" >&2
    echo "  pnpm --filter @formant/service add -D wrangler" >&2
    exit 1
  fi

  # ─── Step 2: Check authentication ───

  echo "Checking Cloudflare authentication..."
  if ! $WRANGLER whoami 2>&1 | grep -q "You are logged in"; then
    echo "Not logged in to Cloudflare. Starting login..."
    $WRANGLER login
  fi
  echo ""

  # ─── Step 3: Check D1 database ───

  WRANGLER_TOML="$SERVICE_DIR/wrangler.toml"

  # Read current database_id from wrangler.toml
  CURRENT_DB_ID=$(grep 'database_id' "$WRANGLER_TOML" | head -1 | sed 's/.*= *"\(.*\)"/\1/')

  if [[ -z "$CURRENT_DB_ID" ]]; then
    echo "No D1 database configured. Creating one..."
    echo ""

    # Create the database
    CREATE_OUTPUT=$($WRANGLER d1 create formant-db 2>&1)
    echo "$CREATE_OUTPUT"

    # Parse database_id from output
    DB_ID=$(echo "$CREATE_OUTPUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' || \
            echo "$CREATE_OUTPUT" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

    if [[ -z "$DB_ID" ]]; then
      echo "Error: could not parse database_id from wrangler output." >&2
      echo "Create the database manually and update wrangler.toml" >&2
      exit 1
    fi

    # Patch wrangler.toml with the new database_id
    sed -i "s/database_id = \"\"/database_id = \"$DB_ID\"/" "$WRANGLER_TOML"
    echo ""
    echo "  ✓ Database created: $DB_ID"
    echo "  ✓ Updated wrangler.toml"
    echo ""

    # Run migration
    echo "Running database migration..."
    $WRANGLER d1 execute formant-db --remote --file="$SERVICE_DIR/src/db/schema.sql"
    echo "  ✓ Migration applied"
    echo ""
  else
    echo "  D1 database already configured: $CURRENT_DB_ID"
    echo ""
  fi

  # ─── Step 4: Deploy Worker ───

  echo "Deploying Cloudflare Worker..."
  cd "$SERVICE_DIR"
  DEPLOY_OUTPUT=$($WRANGLER deploy --yes 2>&1)
  echo "$DEPLOY_OUTPUT"

  # Parse worker URL from output
  WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+\.workers\.dev' | head -1)

  if [[ -z "$WORKER_URL" ]]; then
    echo ""
    echo "Error: could not parse Worker URL from output." >&2
    echo "If workers.dev subdomain is not registered, complete onboarding at:" >&2
    echo "  https://dash.cloudflare.com/?to=/:account/workers/onboarding" >&2
    echo ""
    echo "Otherwise, check the output above for errors." >&2
    exit 1
  fi

  echo ""
  echo "  ✓ Worker deployed: $WORKER_URL"
  echo ""

  # Return to project root before form upload (avoids path resolution issues)
  cd "$ROOT_DIR"
fi

# ─── Step 5: Generate API key ───

if command -v uuidgen &>/dev/null; then
  API_KEY=$(uuidgen)
elif command -v openssl &>/dev/null; then
  API_KEY=$(openssl rand -hex 16)
else
  API_KEY=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
fi

# ─── Step 6: POST the form ───

# Ensure we're in project root so paths resolve correctly
cd "$ROOT_DIR"

echo "Uploading form to Cloudflare Worker..."

# Read form HTML
FORM_HTML=$(cat "$HTML_FILE")

# Check for companion JSON schema
JSON_FILE="${HTML_FILE%.html}.json"
if [[ -f "$JSON_FILE" ]]; then
  SCHEMA_JSON=$(cat "$JSON_FILE")
  echo "  Found companion schema: $JSON_FILE"
else
  SCHEMA_JSON="{}"
  echo "  No companion schema JSON found (expected: $JSON_FILE)"
  echo "  Using empty schema — rebuild with 'pnpm formant build' to auto-generate it."
fi

# Build request body as a temp file (avoids shell quoting issues with large HTML)
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# Use node to safely build the JSON payload
node -e "
  const fs = require('fs');
  const html = fs.readFileSync('$HTML_FILE', 'utf-8');
  const schemaPath = '$JSON_FILE';
  let schema = {};
  try { schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8')); } catch {}
  const payload = JSON.stringify({ html, schema });
  fs.writeFileSync('$BODY_FILE', payload);
"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/api/forms" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "@$BODY_FILE")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  FORM_ID=$(echo "$BODY" | node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).id||JSON.parse(d).formId||'')}catch{console.log('')}})" 2>/dev/null || echo "")

  # ─── Generate dashboard ───
  BASENAME=$(basename "$HTML_FILE" .html)
  FORM_TITLE=$(echo "$SCHEMA_JSON" | jq -r '.title // "form"' 2>/dev/null || echo "form")
  TEMPLATE="$ROOT_DIR/.cursor/skills/formant/templates/responses-dashboard.html"
  DASHBOARD_OUT="$ROOT_DIR/forms/${BASENAME}-dashboard.html"
  if [[ -f "$TEMPLATE" ]]; then
    WORKER_URL="$WORKER_URL" FORM_ID="$FORM_ID" FORM_TITLE="$FORM_TITLE" \
    TEMPLATE="$TEMPLATE" DASHBOARD_OUT="$DASHBOARD_OUT" JSON_FILE="$JSON_FILE" \
    node -e '
      const fs = require("fs");
      const path = require("path");
      let schema = "{}";
      try { schema = fs.readFileSync(process.env.JSON_FILE, "utf-8"); } catch {}
      try { schema = JSON.stringify(JSON.parse(schema)); } catch {}
      schema = schema.replace(/<\/script>/gi, "<\\/script>");
      let t = fs.readFileSync(process.env.TEMPLATE, "utf-8");
      t = t.replace(/\{\{WORKER_URL\}\}/g, process.env.WORKER_URL || "");
      t = t.replace(/\{\{FORM_ID\}\}/g, process.env.FORM_ID || "");
      const title = (process.env.FORM_TITLE || "form").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      t = t.replace(/\{\{FORM_TITLE\}\}/g, title);
      t = t.replace(/\{\{SCHEMA_JSON\}\}/, schema);
      fs.mkdirSync(path.dirname(process.env.DASHBOARD_OUT), { recursive: true });
      fs.writeFileSync(process.env.DASHBOARD_OUT, t);
    '
  fi

  echo ""
  echo "  ═══════════════════════════════════════════════"
  echo "  ✓ Form deployed successfully!"
  echo ""
  echo "  Live URL:  $WORKER_URL/f/$FORM_ID"
  echo "  API Key:   $API_KEY"
  echo "  Form ID:   $FORM_ID"
  echo ""
  echo "  Management commands:"
  echo "    # View responses"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/responses/$FORM_ID"
  echo ""
  echo "    # Export as XLSX"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/responses/$FORM_ID/xlsx -o responses.xlsx"
  echo ""
  echo "    # Export as CSV"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/responses/$FORM_ID/csv -o responses.csv"
  echo ""
  echo "    # Delete form"
  echo "    curl -X DELETE -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/forms/$FORM_ID"
  echo ""
  if [[ -f "$TEMPLATE" ]]; then
    echo "  Dashboard: forms/${BASENAME}-dashboard.html (open locally, paste API key to view responses)"
  fi
  echo "  ═══════════════════════════════════════════════"
  echo ""
else
  echo ""
  echo "  Error uploading form (HTTP $HTTP_CODE):" >&2
  echo "  $BODY" >&2
  echo ""
  echo "  Retry upload only (skip Worker deploy):" >&2
  echo "  WORKER_URL=$WORKER_URL bash scripts/deploy-cloudflare.sh $HTML_FILE" >&2
  echo ""
  exit 1
fi
