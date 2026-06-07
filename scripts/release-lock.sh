#!/bin/bash
# Release the mutual exclusion lock, but only if it belongs to us.
# Usage: trap 'bash scripts/release-lock.sh $$' EXIT
#   The $$ (PID of the calling shell) is passed as $1.

LOCK_FILE="${LOCK_FILE:-_temp/build.lock}"
EXPECTED_PID="$1"

if [ ! -f "$LOCK_FILE" ]; then
  exit 0
fi

# Lock file format: first line = PID, second line = description
current_pid=$(head -1 "$LOCK_FILE" 2>/dev/null)
if [ "$current_pid" = "$EXPECTED_PID" ]; then
  rm -f "$LOCK_FILE"
fi
