#!/usr/bin/env bash
set -euo pipefail

HTML_FILE="${1:?Usage: deploy-vercel.sh <form.html>}"

# Resolve to absolute path
HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: file not found: $HTML_FILE" >&2
  exit 1
fi

# Create a temp project directory
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

# Deploy (--yes skips confirmation prompts)
cd "$TMPDIR"
npx vercel --yes

echo ""
echo "Done. To deploy to production, run:"
echo "  npx vercel --prod --yes"
echo ""
echo "in the same project, or re-run this script and add --prod."
