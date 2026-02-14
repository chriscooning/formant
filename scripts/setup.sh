#!/bin/bash
set -euo pipefail

echo "Setting up Formant..."
pnpm install
pnpm build
echo "Done!"
