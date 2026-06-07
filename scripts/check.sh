#!/bin/bash
# Incremental check wrapper for `pnpm run check`
# Only processes files that changed since last successful check.
#
# Usage:
#   pnpm run check                   — incremental (only changed files)
#   FORCE_CHECK=1 pnpm run check     — force full check on everything
#   rm -rf node_modules/.cache/clawgoal-check  — reset cache
#
# Cache: node_modules/.cache/clawgoal-check/stamp

set -euo pipefail

CACHE_DIR="node_modules/.cache/clawgoal-check"
STAMP_FILE="$CACHE_DIR/stamp"
TMP_FILE="_temp/check-changed.tmp"
mkdir -p "$CACHE_DIR" _temp

# ── FORCE_CHECK: skip cache, full run ──────────────────────────────────────

if [ -n "${FORCE_CHECK:-}" ]; then
  echo "🔍 FORCE_CHECK: full check (all files)..."
  vue-tsc --noEmit -p tsconfig.check.json
  eslint "packages/*/src/**/*.{ts,tsx,vue}" --fix
  prettier --write --log-level warn "packages/*/src/**/*.{ts,tsx,vue}"
  touch "$STAMP_FILE"
  exit 0
fi

# ── First run: no stamp yet, full check ────────────────────────────────────

if [ ! -f "$STAMP_FILE" ]; then
  echo "🔍 First run: full check (all files)..."
  vue-tsc --noEmit -p tsconfig.check.json
  eslint "packages/*/src/**/*.{ts,tsx,vue}" --fix
  prettier --write --log-level warn "packages/*/src/**/*.{ts,tsx,vue}"
  touch "$STAMP_FILE"
  exit 0
fi

# ── Incremental: find files changed since last stamp ───────────────────────

find packages/ui* -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.vue' \) \
  -newer "$STAMP_FILE" -print0 2>/dev/null > "$TMP_FILE" || true

if [ ! -s "$TMP_FILE" ]; then
  rm -f "$TMP_FILE"
  echo "✓ No changed files since last check"
  exit 0
fi

FILE_COUNT=$(tr -cd '\0' < "$TMP_FILE" | wc -c | tr -d ' ')
echo "🔍 $FILE_COUNT file(s) changed:"

# vue-tsc (uses tsbuildinfo incremental internally)
echo "  vue-tsc --noEmit ..."
vue-tsc --noEmit -p tsconfig.check.json

# eslint + prettier on changed files only
echo "  eslint --fix ($FILE_COUNT files)..."
xargs -0 eslint --fix < "$TMP_FILE"

echo "  prettier --write ($FILE_COUNT files)..."
xargs -0 prettier --write --log-level warn < "$TMP_FILE"

# Update stamp (after eslint+prettier so their mtime changes are captured)
touch "$STAMP_FILE"
rm -f "$TMP_FILE"
