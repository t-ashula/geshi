#!/bin/sh

set -eu

if [ "$#" -lt 2 ]; then
  echo "usage: sh scripts/start-process.sh <name> <command> [args...]" >&2
  exit 2
fi

name="$1"
shift

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
pid_dir="$root_dir/.geshi/pid"
log_dir="$root_dir/.geshi/logs"
pid_file="$pid_dir/$name.pid"
log_file="$log_dir/$name.log"

mkdir -p "$pid_dir" "$log_dir"

if [ -f "$pid_file" ]; then
  existing_pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "process is already running: $name (pid $existing_pid)" >&2
    exit 1
  fi

  rm -f "$pid_file"
fi

nohup "$@" >"$log_file" 2>&1 &
pid="$!"
printf '%s\n' "$pid" >"$pid_file"

sleep 1

if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$pid_file"
  echo "process exited during startup: $name" >&2
  if [ -f "$log_file" ]; then
    echo "--- $log_file (tail) ---" >&2
    tail -n 40 "$log_file" >&2 || true
    echo "--- end log tail ---" >&2
  fi
  exit 1
fi

echo "started $name (pid $pid)"
echo "log: $log_file"
