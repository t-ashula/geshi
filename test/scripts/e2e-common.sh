#!/bin/sh

set -eu

e2e_root_dir() {
  CDPATH='' cd -- "$(dirname "$0")/../.." && pwd
}

e2e_init_cleanup() {
  e2e_cleanup_pids=""
}

e2e_register_pid() {
  e2e_cleanup_pids="${e2e_cleanup_pids} $1"
}

e2e_cleanup() {
  for pid in $e2e_cleanup_pids; do
    kill "$pid" >/dev/null 2>&1 || true
  done
}

e2e_wait_for_test_db() {
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

e2e_prepare_db() {
  make e2e-db-up
  e2e_wait_for_test_db
  make e2e-db-reset
  make e2e-db-schema-apply
}

e2e_start_source_server() {
  E2E_SOURCE_SERVER_PORT="$1" \
  node --import tsx test/server/main.ts >"$2" 2>&1 &
  pid=$!
  e2e_register_pid "$pid"
  printf '%s' "$pid"
}

e2e_start_backend() {
  backend_port="$1"
  storage_root_dir="$2"
  work_storage_root_dir="$3"
  log_file="$4"

  PGDATABASE=geshi_test \
  PGPORT=55433 \
  PORT="$backend_port" \
  GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
  GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
    npm run -s backend:start >"$log_file" 2>&1 &
  pid=$!
  e2e_register_pid "$pid"
  printf '%s' "$pid"
}

e2e_start_worker() {
  worker_script="$1"
  storage_root_dir="$2"
  work_storage_root_dir="$3"
  log_file="$4"

  PGDATABASE=geshi_test \
  PGPORT=55433 \
  GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
  GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
    npm run -s "$worker_script" >"$log_file" 2>&1 &
  pid=$!
  e2e_register_pid "$pid"
  printf '%s' "$pid"
}

e2e_start_worker_with_scribe() {
  worker_script="$1"
  storage_root_dir="$2"
  work_storage_root_dir="$3"
  scribe_base_url="$4"
  log_file="$5"

  PGDATABASE=geshi_test \
  PGPORT=55433 \
  GESHI_STORAGE_ROOT_DIR="$storage_root_dir" \
  GESHI_WORK_STORAGE_ROOT_DIR="$work_storage_root_dir" \
  GESHI_SCRIBE_BASE_URL="$scribe_base_url" \
    npm run -s "$worker_script" >"$log_file" 2>&1 &
  pid=$!
  e2e_register_pid "$pid"
  printf '%s' "$pid"
}

e2e_start_frontend() {
  backend_port="$1"
  frontend_port="$2"
  log_file="$3"

  GESHI_BACKEND_ORIGIN="http://127.0.0.1:$backend_port" \
    npm run frontend:dev -- --host 127.0.0.1 --port "$frontend_port" >"$log_file" 2>&1 &
  pid=$!
  e2e_register_pid "$pid"
  printf '%s' "$pid"
}
