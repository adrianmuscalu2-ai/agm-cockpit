#!/usr/bin/env bash
set -euo pipefail
api='agm-production-api'
db='agm-postgres'
env_file='/opt/agm/production/secrets/agm-production.env'
dsar_dir='/opt/agm/production/dsar'

printf 'IDENTITY\n'
docker inspect "$api" --format 'image={{.Config.Image}} image_id={{.Image}} running={{.State.Running}} health={{.State.Health.Status}} user={{.Config.User}}'
printf 'PERMISSIONS\n'
stat -c 'secret_store owner=%U group=%G mode=%a' "$env_file"
stat -c 'dsar_root owner=%U group=%G mode=%a' "$dsar_dir"
stat -c 'ledger owner=%U group=%G mode=%a' "$dsar_dir/suppression-ledger.jsonl"
printf 'SECRET_BOUNDARY\n'
key="$(sed -n 's/^DSAR_SUPPRESSION_LEDGER_KEY=//p' "$env_file")"
[[ -n "$key" ]]
fingerprint="$(printf '%s' "$key" | sha256sum | cut -c1-16)"
image_env_matches="$(docker image inspect agm-api:dsar-foundation-20260816-r1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Fxc "DSAR_SUPPRESSION_LEDGER_KEY=$key" || true)"
release_matches="$({ grep -RFl --exclude='*.env' -- "$key" /opt/agm/production/releases/AGM-CHG-20260816-DSAR-FOUNDATION-01 2>/dev/null || true; } | wc -l)"
log_matches="$({ docker logs "$api" 2>&1 || true; journalctl -u agm-production-api.service --no-pager 2>/dev/null || true; } | grep -Fc -- "$key" || true)"
printf 'key_fingerprint=%s image_matches=%s release_matches=%s log_matches=%s\n' "$fingerprint" "$image_env_matches" "$release_matches" "$log_matches"
test "$image_env_matches" = 0
test "$release_matches" = 0
test "$log_matches" = 0
key=''

printf 'FOUNDATION\n'
docker exec "$api" node /app/apps/api/dsar-foundation/verify-foundation.mjs
test "$(find "$dsar_dir/exports" -mindepth 1 -maxdepth 1 | wc -l)" = 0

printf 'DATABASE\n'
docker exec -i "$db" sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'transaction_read_only',current_setting('transaction_read_only'),
  'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')),
  'indexes',(SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')),
  'public_table_privileges',(SELECT count(*) FROM information_schema.table_privileges WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex') AND grantee='PUBLIC'),
  'rows',json_build_object(
    'DataSubjectRequest',(SELECT count(*) FROM "DataSubjectRequest"),
    'DataRightsExternalRequest',(SELECT count(*) FROM "DataRightsExternalRequest"),
    'SubjectDataIndex',(SELECT count(*) FROM "SubjectDataIndex")
  ),
  'protected_counts',json_build_object('users',(SELECT count(*) FROM "User"),'auth_sessions',(SELECT count(*) FROM "AuthSession"),'audit_events',(SELECT count(*) FROM "AuditEvent"))
);
ROLLBACK;
SQL

printf 'FAIL_CLOSED_RUNTIME\n'
code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' https://api.agmcockpit.com/api/v1/data-rights/me/export)"
printf 'unauthenticated_dsar_export_http=%s\n' "$code"
test "$code" = 404
for endpoint in health/live health/ready; do
  test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "https://api.agmcockpit.com/api/v1/$endpoint")" = 200
done
test "$(systemctl list-unit-files --no-pager --no-legend | awk 'tolower($1) ~ /retention|lifecycle/ {count++} END {print count+0}')" = 0
if docker inspect "$api" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^(RETENTION_ENGINE_ENABLED|RETENTION_EXECUTE)=true$'; then exit 1; fi
printf 'health_live=200 health_ready=200 retention_jobs=DISABLED export_artifacts=0\n'
