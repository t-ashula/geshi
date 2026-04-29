#!/bin/sh

set -eu

root_dir="$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)"
log_dir="$root_dir/tmp/e2e"
backend_log="$log_dir/backend.log"
frontend_log="$log_dir/frontend.log"
source_server_log="$log_dir/source-server.log"
observe_worker_log="$log_dir/observe-worker.log"
acquire_worker_log="$log_dir/acquire-worker.log"

frontend_port="${E2E_FRONTEND_PORT:-4173}"
backend_port="${E2E_BACKEND_PORT:-3000}"
source_server_port="${E2E_SOURCE_SERVER_PORT:-3401}"
storage_root_dir="$root_dir/.data/e2e-storage"

mkdir -p "$log_dir" "$storage_root_dir"

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

  if [ -n "${worker_pid:-}" ]; then
    kill "$worker_pid" >/dev/null 2>&1 || true
  fi

  if [ -n "${acquire_worker_pid:-}" ]; then
    kill "$acquire_worker_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

cd "$root_dir"

make e2e-db-up
make e2e-db-reset
make e2e-db-schema-apply

E2E_SOURCE_SERVER_PORT="$source_server_port" \
  node --import tsx test/server/main.ts >"$source_server_log" 2>&1 &
source_server_pid=$!

PGDATABASE=geshi_test \
PORT="$backend_port" \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
npm run -s backend:start >"$backend_log" 2>&1 &
backend_pid=$!

PGDATABASE=geshi_test \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
npm run -s worker:observe-source >"$observe_worker_log" 2>&1 &
worker_pid=$!

PGDATABASE=geshi_test \
GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
npm run -s worker:acquire-content >"$acquire_worker_log" 2>&1 &
acquire_worker_pid=$!

npm run frontend:dev -- --host 127.0.0.1 --port "$frontend_port" >"$frontend_log" 2>&1 &
frontend_pid=$!

sh test/scripts/wait-for-http.sh "http://127.0.0.1:$source_server_port/feeds/podcast.xml" 30
sh test/scripts/wait-for-http.sh "http://127.0.0.1:$backend_port/api/v1/sources" 30
sh test/scripts/wait-for-http.sh "http://127.0.0.1:$frontend_port" 30

E2E_FRONTEND_URL="http://127.0.0.1:$frontend_port" \
E2E_SOURCE_FEED_URL="http://127.0.0.1:$source_server_port/feeds/podcast.xml" \
npx playwright test --config test/playwright.config.ts
