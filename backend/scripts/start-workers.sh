#!/bin/sh

set -eu

npm run -s worker:acquire-content &
acquire_pid=$!

npm run -s worker:observe-source &
observe_pid=$!

npm run -s worker:periodic-crawl &
periodic_pid=$!

cleanup() {
  kill "$acquire_pid" "$observe_pid" "$periodic_pid" 2>/dev/null || true
}

trap cleanup INT TERM

wait "$acquire_pid" "$observe_pid" "$periodic_pid"
