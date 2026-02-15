#!/usr/bin/env bash
# Generate admin-local.html with placeholder values for manual verification.
# Usage: bash scripts/verify-admin-local.sh [schema.json]
# Output: forms/<basename>-admin.html
# Password: test123 (or FORMANT_ADMIN_PASSWORD)

set -e
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="${1:-$ROOT_DIR/forms/simple-form.json}"
BASENAME=$(basename "$SCHEMA" .json)
OUT="$ROOT_DIR/forms/${BASENAME}-admin.html"

node "$ROOT_DIR/scripts/generate-admin-local.js" "$SCHEMA" "$OUT"
