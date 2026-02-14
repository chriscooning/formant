#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Cloudflare Workers (full-stack hosting) ───

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
DEPLOY_OUTPUT=$($WRANGLER deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Parse worker URL from output
WORKER_URL=$(echo "$DEPLOY_OUTPUT" | grep -oP 'https://[^\s]+\.workers\.dev' | head -1)

if [[ -z "$WORKER_URL" ]]; then
  echo ""
  echo "Warning: could not parse Worker URL from output." >&2
  echo "Check the output above for your deployment URL." >&2
  read -rp "Enter the Worker URL manually: " WORKER_URL
fi

echo ""
echo "  ✓ Worker deployed: $WORKER_URL"
echo ""

# ─── Step 5: Generate API key ───

if command -v uuidgen &>/dev/null; then
  API_KEY=$(uuidgen)
elif command -v openssl &>/dev/null; then
  API_KEY=$(openssl rand -hex 16)
else
  API_KEY=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
fi

# ─── Step 6: POST the form ───

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

  echo ""
  echo "  ═══════════════════════════════════════════════"
  echo "  ✓ Form deployed successfully!"
  echo ""
  echo "  Live URL:  $WORKER_URL/forms/$FORM_ID"
  echo "  API Key:   $API_KEY"
  echo "  Form ID:   $FORM_ID"
  echo ""
  echo "  Management commands:"
  echo "    # View responses"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/forms/$FORM_ID/responses"
  echo ""
  echo "    # Export as XLSX"
  echo "    curl -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/forms/$FORM_ID/responses/export -o responses.xlsx"
  echo ""
  echo "    # Delete form"
  echo "    curl -X DELETE -H 'Authorization: Bearer $API_KEY' $WORKER_URL/api/forms/$FORM_ID"
  echo "  ═══════════════════════════════════════════════"
  echo ""
else
  echo ""
  echo "  Error uploading form (HTTP $HTTP_CODE):" >&2
  echo "  $BODY" >&2
  exit 1
fi
