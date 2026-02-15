#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Vercel (static hosting) ───

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

HTML_FILE="${1:?Usage: deploy-vercel.sh <form.html>}"

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

# ─── Non-TTY guard ───
# Vercel CLI v50+ requires an interactive terminal for first-time project
# setup / scope selection. In non-TTY environments (CI, subprocess, Cursor
# agent shell) it returns a JSON "action_required" blob instead of deploying.

if [[ ! -t 0 ]]; then
  echo ""
  echo "ERROR: Vercel deploy requires an interactive terminal for first-time project setup."
  echo ""
  echo "Run this command directly in your terminal:"
  echo ""
  echo "  pnpm formant deploy $1 --target vercel"
  echo ""
  echo "Or deploy manually:"
  echo ""
  echo "  DEPLOY_DIR=\$(mktemp -d)"
  echo "  cp $(cd "$(dirname "$1")" && pwd)/$(basename "$1") \"\$DEPLOY_DIR/index.html\""
  echo "  cd \"\$DEPLOY_DIR\" && vercel"
  echo ""
  exit 1
fi

# ─── Deploy ───

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

cp "$HTML_FILE" "$TMPDIR/index.html"

# Minimal Vercel config — static SPA, single page
cat > "$TMPDIR/vercel.json" <<'VERCEL'
{
  "version": 2,
  "cleanUrls": true,
  "trailingSlash": false
}
VERCEL

echo "Deploying $(basename "$HTML_FILE") to Vercel..."
echo ""

cd "$TMPDIR"
DEPLOY_URL=$(vercel --yes 2>&1 | tail -1)

echo ""
echo "  ✓ Deployed to: $DEPLOY_URL"
echo ""
echo "  To deploy to production, run:"
echo "    vercel --prod --yes"
echo ""

# ─── Optional Google Sheets setup ───

read -rp "Set up Google Sheets for response collection? (y/N): " sheets_choice
if [[ "${sheets_choice:-N}" =~ ^[Yy] ]]; then
  exec bash "$SCRIPT_DIR/setup-sheets.sh"
else
  echo ""
  echo "  No problem — responses will download as Excel by default."
  echo "  You can set up Sheets later with: bash scripts/setup-sheets.sh"
  echo ""
fi
