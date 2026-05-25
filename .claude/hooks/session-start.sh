#!/bin/bash
set -euo pipefail

# Only run in Claude Code on the web (remote) sessions; local users manage
# their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/services/api"

# Install deps (also runs `prisma generate` via the package "prepare" script).
# Idempotent: safe to re-run on resume/clear/compact.
npm install --no-fund --no-audit
npx prisma generate
