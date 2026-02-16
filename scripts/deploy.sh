#!/usr/bin/env bash
set -euo pipefail

# ─── Formant Deploy — Entry Point & Menu ───
# Dispatches to offline, vercel, or cloudflare deploy scripts.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Parse arguments ───

TARGET=""
HTML_FILE=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:?Error: --target requires a value (offline|vercel|cloudflare)}"
      shift 2
      ;;
    --target=*)
      TARGET="${1#--target=}"
      shift
      ;;
    -h|--help)
      echo ""
      echo "  formant deploy — deploy a built HTML form"
      echo ""
      echo "  Usage:"
      echo "    deploy.sh <form.html> [--target offline|vercel|cloudflare]"
      echo ""
      echo "  Targets:"
      echo "    offline      Open the form in your default browser (responses download as Excel)"
      echo "    vercel       Deploy to Vercel static hosting (optional Google Sheets integration)"
      echo "    cloudflare   Deploy to Cloudflare Workers with built-in response collection"
      echo ""
      echo "  Vercel options:"
      echo "    --with-admin       Include admin panel (form + admin, IndexedDB responses)"
      echo "    --with-sheets      Deploy Worker first, then form + admin with Connect Google Sheet"
      echo "    --admin-password   Admin password for --with-admin (or FORMANT_ADMIN_PASSWORD env)"
      echo ""
      echo "  If --target is omitted, an interactive menu is shown."
      echo ""
      exit 0
      ;;
    -*)
      EXTRA_ARGS+=("$1")
      shift
      ;;
    *)
      if [[ -z "$HTML_FILE" ]]; then
        HTML_FILE="$1"
      else
        EXTRA_ARGS+=("$1")
      fi
      shift
      ;;
  esac
done

if [[ -z "$HTML_FILE" ]]; then
  echo "Error: no HTML file specified" >&2
  echo "Usage: deploy.sh <form.html> [--target offline|vercel|cloudflare]" >&2
  exit 1
fi

# Resolve to absolute path
HTML_FILE="$(cd "$(dirname "$HTML_FILE")" && pwd)/$(basename "$HTML_FILE")"

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: file not found: $HTML_FILE" >&2
  exit 1
fi

# ─── Interactive menu (if no --target) ───

if [[ -z "$TARGET" ]]; then
  echo ""
  echo "  How do you want to deploy $(basename "$HTML_FILE")?"
  echo ""
  echo "  1) Offline    — Open in browser, responses download as Excel"
  echo "  2) Vercel     — Static hosting with a shareable URL"
  echo "  3) Cloudflare — Full-stack hosting with built-in response collection"
  echo ""
  read -rp "  Choose [1/2/3]: " choice

  case "$choice" in
    1) TARGET="offline" ;;
    2) TARGET="vercel" ;;
    3) TARGET="cloudflare" ;;
    *)
      echo "Invalid choice: $choice" >&2
      exit 1
      ;;
  esac
fi

# ─── Dispatch ───

case "$TARGET" in
  offline)
    exec bash "$SCRIPT_DIR/deploy-offline.sh" "$HTML_FILE" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
    ;;
  vercel)
    exec bash "$SCRIPT_DIR/deploy-vercel.sh" "$HTML_FILE" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
    ;;
  cloudflare)
    exec bash "$SCRIPT_DIR/deploy-cloudflare.sh" "$HTML_FILE" "${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}"
    ;;
  *)
    echo "Error: unknown target '$TARGET' (expected: offline, vercel, cloudflare)" >&2
    exit 1
    ;;
esac
