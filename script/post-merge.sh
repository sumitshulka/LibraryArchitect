#!/usr/bin/env bash
set -euo pipefail

# Keep post-merge setup non-interactive because the runner closes stdin.
npm install --no-audit --no-fund
npm run build