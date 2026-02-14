#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Offline (open in browser) ───

HTML_FILE="${1:?Usage: deploy-offline.sh <form.html>}"

# Resolve to absolute path
HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: file not found: $HTML_FILE" >&2
  exit 1
fi

echo ""
echo "  Form ready: $HTML_FILE"
echo ""

# Open in default browser
if command -v xdg-open &>/dev/null; then
  xdg-open "$HTML_FILE"
elif command -v open &>/dev/null; then
  open "$HTML_FILE"
elif command -v start &>/dev/null; then
  start "$HTML_FILE"
else
  echo "  Could not detect a browser opener. Open the file manually:"
  echo "    $HTML_FILE"
fi

echo "  Responses will download as Excel when the form is submitted."
echo ""
