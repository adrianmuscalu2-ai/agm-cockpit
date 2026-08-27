#!/usr/bin/env bash
set -euo pipefail

api='agm-production-api'
db='agm-postgres'
backup_dir='/opt/agm/backups/daily'
env_file='/opt/agm/production/secrets/agm-production.env'

printf 'UTC=%s\n' "$(date -u +%FT%TZ)"
printf 'HOST=Production-Hetzner(masked)\n'
printf 'DISK\n'
df -Pk /opt/agm | awk 'NR==2 {printf "available_kib=%s used_percent=%s\n",$4,$5}'
printf 'CONTAINERS\n'
docker inspect "$api" --format 'api_running={{.State.Running}} api_health={{.State.Health.Status}} image_id={{.Image}} image_ref={{.Config.Image}}'
docker inspect "$db" --format 'db_running={{.State.Running}} db_health={{.State.Health.Status}}'
printf 'CONFIG_HASHES\n'
sha256sum /opt/agm/production/compose.production.yml /etc/systemd/system/agm-production-api.service 2>/dev/null || true
printf 'SECRET_BOUNDARY\n'
stat -c 'path=masked-secret-store owner=%U group=%G mode=%a type=%F' "$env_file"
sed 's/=.*//' "$env_file" | grep -E '^(DSAR_|RETENTION_|DATABASE_URL)' || true
printf 'SCHEDULERS\n'
systemctl list-unit-files --no-pager --no-legend | awk 'tolower($1) ~ /retention|lifecycle/ {print $1,$2; count++} END {printf "retention_lifecycle_units=%d\n",count+0}'
printf 'BACKUP\n'
latest="$(find "$backup_dir" -maxdepth 1 -type f -name 'agm-postgres-*.dump' -printf '%T@ %p\n' | sort -rn | awk 'NR==1 {print $2}')"
[[ -n "$latest" ]]
manifest="${latest%.dump}.sha256"
[[ -f "$manifest" ]]
(cd "$backup_dir" && sha256sum -c "$(basename "$manifest")")
docker exec -i "$db" pg_restore --list < "$latest" >/dev/null
printf 'backup_verified=true backup_sha256=%s backup_size_bytes=%s backup_age_seconds=%s\n' \
  "$(sha256sum "$latest" | awk '{print $1}')" "$(stat -c %s "$latest")" "$(( $(date +%s) - $(stat -c %Y "$latest") ))"
printf 'DATABASE\n'
docker exec -i "$db" sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object('transaction_read_only',current_setting('transaction_read_only'),'connections',count(*)) FROM pg_stat_activity WHERE datname=current_database();
SELECT json_build_object('migrations',COALESCE(json_agg(migration_name ORDER BY finished_at),'[]'::json)) FROM "_prisma_migrations" WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL;
SELECT json_build_object('relevant_tables',COALESCE(json_agg(table_name ORDER BY table_name),'[]'::json)) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex');
SELECT json_build_object('auth_columns',json_agg(column_name ORDER BY ordinal_position)) FROM information_schema.columns WHERE table_schema='public' AND table_name='AuthSession';
SELECT json_build_object('protected_counts',json_build_object('users',(SELECT count(*) FROM "User"),'auth_sessions',(SELECT count(*) FROM "AuthSession"),'audit_events',(SELECT count(*) FROM "AuditEvent")));
ROLLBACK;
SQL
printf 'PUBLIC_HEALTH\n'
for endpoint in health/live health/ready; do
  code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "https://api.agmcockpit.com/api/v1/$endpoint")"
  printf '%s=%s\n' "$endpoint" "$code"
done
