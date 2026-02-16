#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  Setting up Formant..."
echo ""

# Enable pnpm if not already available
if ! command -v pnpm &>/dev/null; then
  echo "  Enabling pnpm via corepack..."
  corepack enable pnpm
fi

pnpm install

echo ""
echo "  ✓ Ready!"
echo ""
echo "  Open this project in Cursor and ask:"
echo "    \"I want to create a feedback form\""
echo ""
echo "  Forms are built from JSON. Build before opening:"
echo "    pnpm formant build forms/simple-form.json -o forms/simple-form.html"
echo ""
