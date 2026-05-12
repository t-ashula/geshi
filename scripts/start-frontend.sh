#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
frontend_host="${GESHI_FRONTEND_HOST:-127.0.0.1}"
frontend_port="${GESHI_FRONTEND_PORT:-5173}"

sh "$root_dir/scripts/start-process.sh" \
  frontend \
  "$root_dir/node_modules/.bin/vite" \
  --config "$root_dir/frontend/vite.config.ts" \
  --host "$frontend_host" \
  --port "$frontend_port" \
  --strictPort
