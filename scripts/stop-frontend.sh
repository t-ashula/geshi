#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"

sh "$root_dir/scripts/stop-process.sh" \
  frontend \
  "frontend/vite.config.ts"
