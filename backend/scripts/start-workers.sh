#!/bin/sh

set -eu

npm run -s worker:acquire-content &
acquire_pid=$!

npm run -s worker:observe-source &
observe_pid=$!

npm run -s worker:periodic-crawl &
periodic_pid=$!

npm run -s worker:transcript-split &
transcript_split_pid=$!

npm run -s worker:transcript-chunk &
transcript_chunk_pid=$!

cleanup() {
  kill "$acquire_pid" "$observe_pid" "$periodic_pid" "$transcript_split_pid" "$transcript_chunk_pid" 2>/dev/null || true
}

trap cleanup INT TERM

wait "$acquire_pid" "$observe_pid" "$periodic_pid" "$transcript_split_pid" "$transcript_chunk_pid"
