#!/usr/bin/env bash
#
# tests/sql/run.sh
#
# Applies the Supabase shim and then every migration, in order, to a
# throwaway database — then runs the RLS and privilege assertions against it.
#
# The migrations are applied verbatim. Nothing here re-states the schema, so
# the tests cannot drift away from what actually ships.
#
# Connection comes from the standard PG* variables:
#   PGHOST (default 127.0.0.1)  PGPORT (default 5432)
#   PGUSER (default postgres)   PGPASSWORD
#
# Needs PostGIS, because 0001 does.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"

DB="lavage_test_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database \"$DB\";"
trap 'psql -q -d postgres -c "drop database if exists \"$DB\";" >/dev/null 2>&1 || true' EXIT

run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }

echo "--- Supabase shim"
run "$ROOT/tests/sql/shim.sql"

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "--- $(basename "$migration")"
  run "$migration"
done

# Each suite runs inside its own transaction, which is then rolled back, so
# suites cannot collide over fixtures — profiles.phone is unique, and two
# suites picking the same test number would otherwise fail whichever ran
# second. It also means the order of this loop carries no meaning.
for suite in "$ROOT"/tests/sql/*.test.sql; do
  echo "--- $(basename "$suite")"
  psql -v ON_ERROR_STOP=1 --single-transaction -d "$DB" -f "$suite" -c 'rollback;'
done
