#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
start_worker_script="$root_dir/scripts/start-worker.sh"
stop_worker_script="$root_dir/scripts/stop-worker.sh"
started_workers=""

cleanup_on_error() {
  for worker_name in $started_workers; do
    sh "$stop_worker_script" "$worker_name" >/dev/null 2>&1 || true
  done
}

trap cleanup_on_error EXIT INT TERM

for worker_name in \
  acquire-content \
  observe-source \
  periodic-crawl \
  recording-scheduler \
  transcript-split \
  transcript-chunk
do
  sh "$start_worker_script" "$worker_name"
  started_workers="$started_workers $worker_name"
done

trap - EXIT INT TERM
