#!/usr/bin/env bash
# Guard against deploying non-main branches to Vercel production.
# Run this before any `vercel --prod` or `vercel deploy --prod` command.
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [ "$BRANCH" != "main" ]; then
  echo "BLOCKED: Cannot deploy to production from branch '$BRANCH'."
  echo "Production deploys must come from 'main' via git integration."
  echo "If you need to force a CLI deploy, checkout main first."
  exit 1
fi

echo "OK: On branch 'main' — production deploy allowed."
