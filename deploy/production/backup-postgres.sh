#!/bin/sh
set -eu

umask 077

backup_dir=/backups
retention_count="${AGM_BACKUP_RETENTION_COUNT:-7}"
lock_dir="${backup_dir}/.agm-backup.lock"

fail() {
  printf 'AGM_BACKUP status=failed reason=%s\n' "$1" >&2
  exit 1
}

case "$retention_count" in
  ''|*[!0-9]*|0) fail "retention_count_must_be_a_positive_integer" ;;
esac

for required_name in PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE; do
  eval "required_value=\${$required_name:-}"
  [ -n "$required_value" ] || fail "${required_name}_is_required"
done

[ -d "$backup_dir" ] || fail "backup_directory_missing"

if ! mkdir "$lock_dir" 2>/dev/null; then
  fail "backup_already_running"
fi

temporary_dump=
temporary_manifest=
cleanup() {
  [ -z "$temporary_dump" ] || rm -f -- "$temporary_dump"
  [ -z "$temporary_manifest" ] || rm -f -- "$temporary_manifest"
  rmdir "$lock_dir" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

pg_isready --quiet || fail "postgres_not_ready"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="agm-postgres-${timestamp}"
temporary_dump="${backup_dir}/.${base_name}.dump.partial"
final_dump="${backup_dir}/${base_name}.dump"
temporary_manifest="${backup_dir}/.${base_name}.sha256.partial"
final_manifest="${backup_dir}/${base_name}.sha256"

pg_dump \
  --format custom \
  --compress 6 \
  --no-owner \
  --no-privileges \
  --file "$temporary_dump"

[ -s "$temporary_dump" ] || fail "empty_dump"
pg_restore --list "$temporary_dump" >/dev/null || fail "pg_restore_list_validation_failed"

dump_hash="$(sha256sum "$temporary_dump" | awk '{print $1}')"
printf '%s  %s\n' "$dump_hash" "$(basename "$final_dump")" >"$temporary_manifest"

mv -- "$temporary_dump" "$final_dump"
temporary_dump=
mv -- "$temporary_manifest" "$final_manifest"
temporary_manifest=
chmod 0600 "$final_dump" "$final_manifest"

set -- "$backup_dir"/agm-postgres-*.dump
if [ -e "$1" ]; then
  dump_count="$(find "$backup_dir" -maxdepth 1 -type f -name 'agm-postgres-*.dump' | wc -l | tr -d ' ')"
  while [ "$dump_count" -gt "$retention_count" ]; do
    expired_dump="$(find "$backup_dir" -maxdepth 1 -type f -name 'agm-postgres-*.dump' -printf '%T@ %p\n' | sort -n | head -n 1 | cut -d' ' -f2-)"
    [ -n "$expired_dump" ] || fail "unable_to_select_expired_dump"
    expired_manifest="${expired_dump%.dump}.sha256"
    rm -f -- "$expired_dump" "$expired_manifest"
    dump_count=$((dump_count - 1))
  done
fi

trap - EXIT INT TERM
rmdir "$lock_dir"
printf 'AGM_BACKUP status=success file=%s sha256=%s size_bytes=%s\n' \
  "$final_dump" \
  "$dump_hash" \
  "$(stat -c '%s' "$final_dump")"

