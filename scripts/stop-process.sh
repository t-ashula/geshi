#!/bin/sh

set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: sh scripts/stop-process.sh <name> [expected-command-fragment]" >&2
  exit 2
fi

name="$1"
expected_fragment="${2:-}"

root_dir="$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)"
pid_file="$root_dir/.geshi/pid/$name.pid"

if [ ! -f "$pid_file" ]; then
  echo "process is not running: $name"
  exit 0
fi

pid="$(cat "$pid_file" 2>/dev/null || true)"

if [ -z "$pid" ]; then
  rm -f "$pid_file"
  echo "removed empty pid file: $name"
  exit 0
fi

if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$pid_file"
  echo "removed stale pid file: $name"
  exit 0
fi

if [ -n "$expected_fragment" ]; then
  command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"

  case "$command_line" in
    *"$expected_fragment"*)
      ;;
    *)
      rm -f "$pid_file"
      echo "pid file did not match expected process; removed pid file: $name" >&2
      exit 1
      ;;
  esac
fi

kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true

attempt=0
while kill -0 "$pid" 2>/dev/null; do
  attempt=$((attempt + 1))

  if [ "$attempt" -ge 30 ]; then
    break
  fi

  sleep 1
done

if kill -0 "$pid" 2>/dev/null; then
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
fi

attempt=0
while kill -0 "$pid" 2>/dev/null; do
  attempt=$((attempt + 1))

  if [ "$attempt" -ge 5 ]; then
    echo "failed to stop process: $name (pid $pid)" >&2
    exit 1
  fi

  sleep 1
done

rm -f "$pid_file"
echo "stopped $name"
