#!/bin/bash
# Acquire a mutual exclusion lock for build/test commands.
# If another build/test is already running, retries every 30s for up to 5 minutes.
#
# Usage: bash scripts/acquire-lock.sh <description>
#   <description> is shown in the retry message (e.g. "build", "API测试")
#
# Then set an EXIT trap to release:
#   trap 'bash scripts/release-lock.sh $$' EXIT

LOCK_FILE="${LOCK_FILE:-_temp/build.lock}"
DESC="${1:-未知任务}"
MAX_RETRIES="${MAX_RETRIES:-10}"           # 10 × 30s = 300s = 5 分钟
RETRY_INTERVAL="${RETRY_INTERVAL:-30}"

# Ensure parent directory exists
mkdir -p "$(dirname "$LOCK_FILE")"

retry_count=0
while [ $retry_count -lt $MAX_RETRIES ]; do
  if [ -f "$LOCK_FILE" ]; then
    # Read PID (first line) from lock file
    lock_pid=$(head -1 "$LOCK_FILE" 2>/dev/null)

    if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
      lock_desc=$(tail -1 "$LOCK_FILE" 2>/dev/null)
      echo "其他进程正在${lock_desc:-运行}，尝试${RETRY_INTERVAL}秒后重新获取" >&2
      sleep "$RETRY_INTERVAL"
      retry_count=$((retry_count + 1))
      continue
    fi
    # Stale lock (process no longer alive), remove it
    rm -f "$LOCK_FILE"
  fi

  # Acquire lock: first line = PID, second line = description
  echo "$$" > "$LOCK_FILE"
  echo "$DESC" >> "$LOCK_FILE"
  return 0
done

lock_desc=$(tail -1 "$LOCK_FILE" 2>/dev/null)
echo "等待超时（5分钟），其他进程正在${lock_desc:-运行}，请稍后再试" >&2
return 1
