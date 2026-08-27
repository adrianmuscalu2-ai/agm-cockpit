#!/bin/sh
set -eu

fail() {
  printf 'AGM_RESTORE_REHEARSAL status=failed reason=%s\n' "$1" >&2
  exit 1
}

for required_name in PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE AGM_RESTORE_DUMP AGM_EXPECTED_MIGRATION_COUNT; do
  eval "required_value=\${$required_name:-}"
  [ -n "$required_value" ] || fail "${required_name}_is_required"
done

case "$AGM_RESTORE_DUMP" in
  /backups/agm-postgres-*.dump) ;;
  *) fail "dump_path_outside_approved_pattern" ;;
esac

[ -f "$AGM_RESTORE_DUMP" ] || fail "dump_not_found"
pg_restore --list "$AGM_RESTORE_DUMP" >/dev/null || fail "invalid_dump"
pg_isready --quiet || fail "postgres_not_ready"

rehearsal_db="agm_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
  dropdb --if-exists --force "$rehearsal_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

createdb "$rehearsal_db"
pg_restore \
  --dbname "$rehearsal_db" \
  --no-owner \
  --no-privileges \
  --exit-on-error \
  "$AGM_RESTORE_DUMP"

migration_count="$(
  psql \
    --dbname "$rehearsal_db" \
    --tuples-only \
    --no-align \
    --command "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;"
)"
incomplete_count="$(
  psql \
    --dbname "$rehearsal_db" \
    --tuples-only \
    --no-align \
    --command "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"
)"

[ "$migration_count" -eq "$AGM_EXPECTED_MIGRATION_COUNT" ] || fail "unexpected_migration_count"
[ "$incomplete_count" -eq 0 ] || fail "incomplete_migrations_present"

dropdb --force "$rehearsal_db"
trap - EXIT INT TERM
printf 'AGM_RESTORE_REHEARSAL status=success migrations=%s incomplete=%s\n' \
  "$migration_count" \
  "$incomplete_count"
