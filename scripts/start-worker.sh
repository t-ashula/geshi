#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: sh scripts/start-worker.sh <worker-name>" >&2
  exit 2
fi

worker_name="$1"
root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
start_process_script="$root_dir/scripts/start-process.sh"

case "$worker_name" in
  acquire-content)
    process_name="worker-acquire-content"
    worker_entrypoint="backend/src/workers/acquire-content/main.ts"
    ;;
  observe-source)
    process_name="worker-observe-source"
    worker_entrypoint="backend/src/workers/observe-source/main.ts"
    ;;
  periodic-crawl)
    process_name="worker-periodic-crawl"
    worker_entrypoint="backend/src/workers/periodic-crawl/main.ts"
    ;;
  periodic-source-detection)
    process_name="worker-periodic-source-detection"
    worker_entrypoint="backend/src/workers/periodic-source-detection/main.ts"
    ;;
  recording-scheduler)
    process_name="worker-recording-scheduler"
    worker_entrypoint="backend/src/workers/recording-scheduler/main.ts"
    ;;
  transcript-chunk)
    process_name="worker-transcript-chunk"
    worker_entrypoint="backend/src/workers/transcript-chunk/main.ts"
    ;;
  transcript-split)
    process_name="worker-transcript-split"
    worker_entrypoint="backend/src/workers/transcript-split/main.ts"
    ;;
  *)
    echo "unknown worker: $worker_name" >&2
    exit 2
    ;;
esac

sh "$start_process_script" \
  "$process_name" \
  node --import tsx "$root_dir/$worker_entrypoint"
