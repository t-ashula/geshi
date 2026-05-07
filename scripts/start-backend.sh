#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"

sh "$root_dir/scripts/start-process.sh" \
  backend \
  node --import tsx "$root_dir/backend/src/index.ts"
