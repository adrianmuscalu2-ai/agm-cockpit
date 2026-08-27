#!/usr/bin/env bash
set -euo pipefail
printf 'CONTAINER\n'
docker inspect agm-production-api --format 'image={{.Config.Image}} running={{.State.Running}} health={{.State.Health.Status}} image_id={{.Image}}'
printf 'SECRET_NAMES\n'
sed 's/=.*//' /opt/agm/production/secrets/agm-production.env | grep -E '^(DSAR_|RETENTION_)' || true
printf 'DATABASE\n'
docker exec -i agm-postgres sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'transaction_read_only',current_setting('transaction_read_only'),
  'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')),
  'migrations',(SELECT count(*) FROM "_prisma_migrations" WHERE migration_name IN ('20260816090000_refresh_families_and_dsar','20260816190000_add_dsar_external_and_subject_index')),
  'users',(SELECT count(*) FROM "User"),
  'auth_sessions',(SELECT count(*) FROM "AuthSession"),
  'audit_events',(SELECT count(*) FROM "AuditEvent")
);
ROLLBACK;
SQL
printf 'SCHEDULER\n'
systemctl list-unit-files --no-pager --no-legend | awk 'tolower($1) ~ /retention|lifecycle/ {count++} END {print "retention_units=" count+0}'
printf 'HEALTH\n'
for endpoint in live ready; do
  code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "https://api.agmcockpit.com/api/v1/health/$endpoint")"
  printf '%s=%s\n' "$endpoint" "$code"
done
