#!/bin/sh

set -eu

url="$1"
timeout_seconds="${2:-30}"
elapsed=0

while [ "$elapsed" -lt "$timeout_seconds" ]; do
  if curl -fsS "$url" >/dev/null 2>&1; then
    exit 0
  fi

  sleep 1
  elapsed=$((elapsed + 1))
done

echo "Timed out waiting for $url" >&2
exit 1
