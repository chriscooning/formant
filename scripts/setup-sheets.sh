#!/usr/bin/env bash
set -euo pipefail

# ─── Formant — Google Sheets Setup (clasp-assisted) ───

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONNECTOR_SRC="$SCRIPT_DIR/apps-script/sheets-connector.gs"

if [[ ! -f "$CONNECTOR_SRC" ]]; then
  echo "Error: sheets-connector.gs not found at: $CONNECTOR_SRC" >&2
  echo "Make sure you're running this from the formant project root." >&2
  exit 1
fi

# ─── Step 1: Check clasp ───

echo "Checking for Google clasp CLI..."
if ! npx @google/clasp --version &>/dev/null 2>&1; then
  echo "clasp not found. Installing..."
  npm i -g @google/clasp
fi
echo "  ✓ clasp available"
echo ""

# ─── Step 2: Check login ───

echo "Checking Google authentication..."
if ! npx @google/clasp login --status 2>&1 | grep -qi "logged in"; then
  echo "Not logged in. Starting Google login..."
  npx @google/clasp login
fi
echo "  ✓ Authenticated with Google"
echo ""

# ─── Step 3: Get Google Sheet ───

echo "  You need a Google Sheet to collect responses."
echo "  Create one at https://sheets.google.com and copy the URL."
echo ""
read -rp "  Paste your Google Sheet URL: " SHEET_URL

# Extract the spreadsheet ID from the URL
SHEET_ID=$(echo "$SHEET_URL" | grep -oP '/spreadsheets/d/\K[^/]+' || echo "")

if [[ -z "$SHEET_ID" ]]; then
  echo "Error: could not extract spreadsheet ID from URL." >&2
  echo "Expected format: https://docs.google.com/spreadsheets/d/<id>/..." >&2
  exit 1
fi

echo "  Sheet ID: $SHEET_ID"
echo ""

# ─── Step 4: Create Apps Script project ───

CLASP_DIR="$(mktemp -d)"
trap 'rm -rf "$CLASP_DIR"' EXIT

echo "Creating Apps Script project..."
cd "$CLASP_DIR"
npx @google/clasp create --type sheets --parentId "$SHEET_ID" --title "Formant Connector"
echo "  ✓ Project created"
echo ""

# ─── Step 5: Copy connector and push ───

echo "Pushing sheets-connector.gs..."
cp "$CONNECTOR_SRC" "$CLASP_DIR/Code.gs"
npx @google/clasp push --force
echo "  ✓ Code pushed"
echo ""

# ─── Step 6: Deploy as web app ───

echo "Deploying as web app..."
DEPLOY_OUTPUT=$(npx @google/clasp deploy --description "Formant connector" 2>&1)
echo "$DEPLOY_OUTPUT"

DEPLOY_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP '- \K[A-Za-z0-9_-]+(?= @)' || echo "")
SCRIPT_ID=$(grep '"scriptId"' "$CLASP_DIR/.clasp.json" 2>/dev/null | grep -oP '"\K[^"]+(?="[^"]*$)' || echo "")

echo ""
echo "  ═══════════════════════════════════════════════"
echo "  ✓ Apps Script deployed!"
echo ""

if [[ -n "$SCRIPT_ID" ]]; then
  WEBAPP_URL="https://script.google.com/macros/s/$DEPLOY_ID/exec"
  echo "  Web App URL: $WEBAPP_URL"
  echo ""
  echo "  ⚠ IMPORTANT: You must authorize the script once:"
  echo "    1. Open: https://script.google.com/home/projects/$SCRIPT_ID/edit"
  echo "    2. Click 'Run' on any function"
  echo "    3. Click 'Review Permissions' → 'Allow'"
  echo "    4. Or just visit the Web App URL above and approve"
  echo ""
fi

echo "  Add this URL to your form schema under submit.destinations:"
echo ""
echo "    {"
echo "      \"type\": \"sheets\","
echo "      \"url\": \"$WEBAPP_URL\""
echo "    }"
echo ""

# ─── Step 7: Quick test ───

if [[ -n "${WEBAPP_URL:-}" ]]; then
  echo "Testing endpoint with GET request..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$WEBAPP_URL" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" ]]; then
    echo "  ✓ Endpoint responding (HTTP $HTTP_CODE)"
  else
    echo "  ⚠ Endpoint returned HTTP $HTTP_CODE — you may need to authorize first (see above)"
  fi
fi

echo ""
echo "  ═══════════════════════════════════════════════"
echo ""
