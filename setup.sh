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
echo "  Building demo form (bake sale — shows all field types)..."
pnpm formant build forms/bake-sale.json -o forms/bake-sale.html
echo ""
echo "  ✓ Ready!"
echo ""
echo "  Preview the demo:"
echo "    pnpm formant deploy forms/bake-sale.html --target offline"
echo ""
echo "  Or open in Cursor and ask:"
echo "    \"I want to create a feedback form\""
echo "    \"I want a form that matches my site's branding\" (provide URL when asked)"
echo ""
