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

# ─── Deploy ───

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

# Use lowercase dir name — Vercel uses it for project name and rejects uppercase
DEPLOY_DIR="$TMPDIR/formant-form"
mkdir -p "$DEPLOY_DIR"
cp "$HTML_FILE" "$DEPLOY_DIR/index.html"

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
      script -q -c "vercel link --yes --scope $SCOPE && vercel --yes --non-interactive" /dev/null
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

# ─── Optional Google Sheets setup (interactive only) ───

if [[ -t 0 ]]; then
  read -rp "Set up Google Sheets for response collection? (y/N): " sheets_choice
  if [[ "${sheets_choice:-N}" =~ ^[Yy] ]]; then
    exec bash "$SCRIPT_DIR/setup-sheets.sh"
  fi
fi
echo ""
echo "  Responses download as Excel by default. Set up Sheets later with: bash scripts/setup-sheets.sh"
echo ""
