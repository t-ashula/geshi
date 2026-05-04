#!/bin/sh

set -eu

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/../.." && pwd)"
log_dir="$root_dir/tmp/e2e-transcript"
backend_log="$log_dir/backend.log"
frontend_log="$log_dir/frontend.log"
source_server_log="$log_dir/source-server.log"
fake_scribe_log="$log_dir/fake-scribe.log"
observe_worker_log="$log_dir/observe-worker.log"
acquire_worker_log="$log_dir/acquire-worker.log"
transcript_split_worker_log="$log_dir/transcript-split-worker.log"
transcript_chunk_worker_log="$log_dir/transcript-chunk-worker.log"
fixture_audio_path="$log_dir/botchan-8min.mp3"

frontend_port="${E2E_FRONTEND_PORT:-4274}"
backend_port="${E2E_BACKEND_PORT:-3301}"
source_server_port="${E2E_SOURCE_SERVER_PORT:-3502}"
use_real_scribe="${E2E_USE_REAL_SCRIBE:-0}"
scribe_port="${E2E_SCRIBE_PORT:-58001}"
scribe_base_url="${E2E_SCRIBE_BASE_URL:-http://127.0.0.1:$scribe_port}"
storage_root_dir="$root_dir/.data/e2e-transcript-storage"
work_storage_root_dir="$root_dir/.data/e2e-transcript-work-storage"
source_mp3_path="${E2E_BOTCHAN_SOURCE_MP3:-$root_dir/tmp/botchan/botchan_01_natsume_64kb.mp3}"

mkdir -p "$log_dir" "$storage_root_dir" "$work_storage_root_dir"

cleanup() {
  if [ -n "${frontend_pid:-}" ]; then
    kill "$frontend_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${backend_pid:-}" ]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${source_server_pid:-}" ]; then
    kill "$source_server_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${fake_scribe_pid:-}" ]; then
    kill "$fake_scribe_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${observe_worker_pid:-}" ]; then
    kill "$observe_worker_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${acquire_worker_pid:-}" ]; then
    kill "$acquire_worker_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${transcript_split_worker_pid:-}" ]; then
    kill "$transcript_split_worker_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${transcript_chunk_worker_pid:-}" ]; then
    kill "$transcript_chunk_worker_pid" >/dev/null 2>&1 || true
  fi
}

wait_for_test_db() {
  attempts=0

  while [ "$attempts" -lt 30 ]; do
    if docker compose -f test/compose.test.yaml exec -T postgres \
      pg_isready -U geshi -d geshi >/dev/null 2>&1; then
      return 0
    fi

    attempts=$((attempts + 1))
    sleep 1
  done

  echo "postgres did not become ready in time" >&2
  return 1
}

trap cleanup EXIT INT TERM

cd "$root_dir"

if [ ! -f "$source_mp3_path" ]; then
  echo "botchan source mp3 not found: $source_mp3_path" >&2
  exit 1
fi

ffmpeg -y -i "$source_mp3_path" -t 480 -c copy "$fixture_audio_path" >/dev/null 2>&1

make e2e-db-up
wait_for_test_db
make e2e-db-reset
make e2e-db-schema-apply

E2E_SOURCE_SERVER_PORT="$source_server_port" \
E2E_BOTCHAN_AUDIO_PATH="$fixture_audio_path" \
  node --import tsx test/server/main.ts >"$source_server_log" 2>&1 &
source_server_pid=$!

if [ "$use_real_scribe" = "1" ]; then
  sh test/scripts/wait-for-http.sh "$scribe_base_url/docs" 30
else
  E2E_SCRIBE_PORT="$scribe_port" \
    node --import tsx test/server/fake-scribe.ts >"$fake_scribe_log" 2>&1 &
  fake_scribe_pid=$!
  sh test/scripts/wait-for-http.sh "$scribe_base_url/docs" 30
fi

PGDATABASE=geshi_test \
PGPORT=55433 \
PORT="$backend_port" \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
  npm run -s backend:start >"$backend_log" 2>&1 &
backend_pid=$!

PGDATABASE=geshi_test \
PGPORT=55433 \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
  npm run -s worker:observe-source >"$observe_worker_log" 2>&1 &
observe_worker_pid=$!

PGDATABASE=geshi_test \
PGPORT=55433 \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
  npm run -s worker:acquire-content >"$acquire_worker_log" 2>&1 &
acquire_worker_pid=$!

PGDATABASE=geshi_test \
PGPORT=55433 \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
  npm run -s worker:transcript-split >"$transcript_split_worker_log" 2>&1 &
transcript_split_worker_pid=$!

PGDATABASE=geshi_test \
PGPORT=55433 \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
  npm run -s worker:transcript-chunk >"$transcript_chunk_worker_log" 2>&1 &
transcript_chunk_worker_pid=$!

GESHI_BACKEND_ORIGIN="http://127.0.0.1:$backend_port" \
  npm run frontend:dev -- --host 127.0.0.1 --port "$frontend_port" >"$frontend_log" 2>&1 &
frontend_pid=$!

sh test/scripts/wait-for-http.sh "http://127.0.0.1:$source_server_port/feeds/botchan.xml" 30
sh test/scripts/wait-for-http.sh "http://127.0.0.1:$backend_port/api/v1/sources" 30
sh test/scripts/wait-for-http.sh "http://127.0.0.1:$frontend_port" 30

E2E_FRONTEND_URL="http://127.0.0.1:$frontend_port" \
E2E_TRANSCRIPT_SOURCE_FEED_URL="http://127.0.0.1:$source_server_port/feeds/botchan.xml" \
  npx playwright test --config test/playwright.config.ts test/cases/transcript.spec.ts
