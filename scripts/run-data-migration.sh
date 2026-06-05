#!/bin/sh

set -eu

if [ "$#" -ne 1 ]; then
  echo "usage: sh scripts/run-data-migration.sh <migration-sql-path>" >&2
  exit 1
fi

root_dir=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
migration_path="$1"

case "$migration_path" in
  /*) ;;
  *) migration_path="$root_dir/$migration_path" ;;
esac

if [ ! -f "$migration_path" ]; then
  echo "migration file not found: $migration_path" >&2
  exit 1
fi

compose_file="${COMPOSE_FILE_PATH:-compose.yaml}"
postgres_service="${POSTGRES_SERVICE_NAME:-postgres}"
db_name="${DB_NAME:-geshi}"
db_user="${DB_USER:-geshi}"

docker compose -f "$compose_file" exec -T "$postgres_service" \
  psql -v ON_ERROR_STOP=1 -U "$db_user" -d "$db_name" \
  < "$migration_path"
