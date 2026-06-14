#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
stop_worker_script="$root_dir/scripts/stop-worker.sh"

for worker_name in \
  acquire-content \
  observe-source \
  periodic-crawl \
  periodic-source-detection \
  recording-scheduler \
  transcript-split \
  transcript-chunk
do
  sh "$stop_worker_script" "$worker_name"
done
