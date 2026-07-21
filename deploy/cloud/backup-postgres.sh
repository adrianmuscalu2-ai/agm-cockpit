#!/usr/bin/env bash
set -euo pipefail

umask 077

backup_dir="${AGM_BACKUP_DIR:-/opt/agm/backups/daily}"
postgres_container="${AGM_POSTGRES_CONTAINER:-app-postgres-1}"
retention_count="${AGM_BACKUP_RETENTION_COUNT:-7}"
minimum_free_kib="${AGM_BACKUP_MINIMUM_FREE_KIB:-1048576}"
lock_file="${AGM_BACKUP_LOCK_FILE:-/run/lock/agm-postgres-backup.lock}"

fail() {
  printf 'AGM_BACKUP status=failed reason=%s\n' "$1" >&2
  exit 1
}

require_positive_integer() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[1-9][0-9]*$ ]] || fail "${name}_must_be_a_positive_integer"
}

require_positive_integer "retention_count" "$retention_count"
require_positive_integer "minimum_free_kib" "$minimum_free_kib"

[[ "$backup_dir" == /opt/agm/backups/* ]] || fail "backup_directory_outside_approved_root"

install -d -o root -g root -m 0750 "$backup_dir"
touch "$lock_file"
chmod 0600 "$lock_file"

exec 9>"$lock_file"
flock --nonblock 9 || fail "backup_already_running"

docker inspect "$postgres_container" >/dev/null 2>&1 || fail "postgres_container_not_found"
[[ "$(docker inspect --format='{{.State.Health.Status}}' "$postgres_container")" == "healthy" ]] \
  || fail "postgres_container_not_healthy"

postgres_user="$(docker exec "$postgres_container" printenv POSTGRES_USER)"
postgres_database="$(docker exec "$postgres_container" printenv POSTGRES_DB)"

[[ "$postgres_user" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]] || fail "invalid_postgres_user"
[[ "$postgres_database" =~ ^[A-Za-z_][A-Za-z0-9_.-]*$ ]] || fail "invalid_postgres_database"

available_kib="$(df --output=avail "$backup_dir" | tail -n 1 | tr -d ' ')"
[[ "$available_kib" =~ ^[0-9]+$ ]] || fail "unable_to_measure_free_space"
(( available_kib >= minimum_free_kib )) || fail "insufficient_free_space"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
base_name="agm-postgres-${timestamp}"
temporary_dump="${backup_dir}/.${base_name}.dump.partial"
final_dump="${backup_dir}/${base_name}.dump"
temporary_manifest="${backup_dir}/.${base_name}.sha256.partial"
final_manifest="${backup_dir}/${base_name}.sha256"

cleanup() {
  rm -f -- "$temporary_dump" "$temporary_manifest"
}
trap cleanup EXIT

docker exec "$postgres_container" \
  pg_dump \
  --username "$postgres_user" \
  --dbname "$postgres_database" \
  --format custom \
  --compress 6 \
  --no-owner \
  --no-privileges \
  >"$temporary_dump"

[[ -s "$temporary_dump" ]] || fail "empty_dump"
docker exec -i "$postgres_container" pg_restore --list <"$temporary_dump" >/dev/null \
  || fail "pg_restore_list_validation_failed"

dump_hash="$(sha256sum "$temporary_dump" | awk '{print $1}')"
printf '%s  %s\n' "$dump_hash" "$(basename "$final_dump")" >"$temporary_manifest"

mv -- "$temporary_dump" "$final_dump"
mv -- "$temporary_manifest" "$final_manifest"
chmod 0600 "$final_dump" "$final_manifest"

mapfile -t retained_dumps < <(
  find "$backup_dir" -maxdepth 1 -type f -name 'agm-postgres-*.dump' -printf '%T@ %p\n' \
    | sort -rn \
    | awk '{print $2}'
)

if (( ${#retained_dumps[@]} > retention_count )); then
  for expired_dump in "${retained_dumps[@]:retention_count}"; do
    [[ "$expired_dump" == "$backup_dir"/agm-postgres-*.dump ]] \
      || fail "retention_path_outside_approved_pattern"
    expired_manifest="${expired_dump%.dump}.sha256"
    rm -f -- "$expired_dump" "$expired_manifest"
  done
fi

trap - EXIT
printf 'AGM_BACKUP status=success file=%s sha256=%s size_bytes=%s\n' \
  "$final_dump" \
  "$dump_hash" \
  "$(stat -c '%s' "$final_dump")"
