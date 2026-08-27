#!/usr/bin/env bash
set -euo pipefail
categories=(expiredAuthSessions revokedAuthSessions completedDsarRecords generatedDsarExports postgresBackups suppressionLedgerEntries identifierAuditLogs)
printf 'TIMERS\n'
enabled=0;active=0
for category in "${categories[@]}";do
  timer="agm-retention-${category}.timer"
  [[ "$(systemctl is-enabled "$timer")" == enabled ]]&&enabled=$((enabled+1))
  [[ "$(systemctl is-active "$timer")" == active ]]&&active=$((active+1))
  systemctl show "$timer" -p Id -p NextElapseUSecRealtime -p LastTriggerUSec --value | tr '\n' ' ';printf '\n'
done
printf 'enabled=%s active=%s\n' "$enabled" "$active"
test "$enabled" = 7;test "$active" = 7
test "$(systemctl show agm-retention@expiredAuthSessions.service -p Restart --value)" = no

printf 'POLICY_AND_FLAGS\n'
printf '7167b5e0fdea785771168c9062c62adc6f54e433b0081976412790ff234d358e  /opt/agm/production/retention/retention-policy.production-authorized.json\n'|sha256sum -c -
if grep -Eq '^(RETENTION_ENGINE_ENABLED|RETENTION_EXECUTE)=true$' /opt/agm/production/secrets/agm-production.env;then exit 1;fi
printf 'legacy_execution_flags=false\n'

printf 'PROOFS\n'
for category in "${categories[@]}";do
  proof="$(find /opt/agm/production/retention/evidence -maxdepth 1 -type f -name "*-${category}.jsonl" -printf '%T@ %p\n'|sort -rn|awk 'NR==1{print $2}')"
  test "$(stat -c %a "$proof")" = 600
  grep '"state":"COMPLETED"' "$proof"|tail -n 1
done

printf 'DATABASE\n'
docker exec -i agm-postgres sh -lc 'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object('transaction_read_only',current_setting('transaction_read_only'),'users',(SELECT count(*) FROM "User"),'auth_sessions',(SELECT count(*) FROM "AuthSession"),'dsar',(SELECT count(*) FROM "DataSubjectRequest"),'audit_events',(SELECT count(*) FROM "AuditEvent"));
ROLLBACK;
SQL
printf 'FILES\n'
printf 'backups=%s exports=%s\n' "$(find /opt/agm/backups/daily -maxdepth 1 -type f -name 'agm-postgres-*.dump'|wc -l)" "$(find /opt/agm/production/dsar/exports -mindepth 1 -maxdepth 1|wc -l)"
docker exec agm-production-api node /app/apps/api/dsar-foundation/verify-foundation.mjs

printf 'RUNTIME\n'
for endpoint in live ready;do code="$(curl -sS -o /dev/null -w '%{http_code}' "https://api.agmcockpit.com/api/v1/health/$endpoint")";printf '%s=%s\n' "$endpoint" "$code";test "$code" = 200;done
code="$(curl -sS -o /dev/null -w '%{http_code}' https://api.agmcockpit.com/api/v1/data-rights/me/export)";printf 'dsar_public=%s\n' "$code";test "$code" = 404
printf 'POST_ACTIVATION=PASS\n'
