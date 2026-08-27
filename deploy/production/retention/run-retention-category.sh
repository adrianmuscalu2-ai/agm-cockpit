#!/usr/bin/env bash
set -euo pipefail
umask 077

readonly category="${1:-}"
readonly policy='/opt/agm/production/retention/retention-policy.production-authorized.json'
readonly policy_sha='7167b5e0fdea785771168c9062c62adc6f54e433b0081976412790ff234d358e'
readonly env_file='/opt/agm/production/secrets/agm-production.env'
readonly runner='/opt/agm/production/retention/retention-file-category.mjs'
readonly evidence_dir='/opt/agm/production/retention/evidence'
readonly api='agm-production-api'
readonly db='agm-postgres'
readonly image='agm-api:dsar-foundation-20260816-r1'
readonly backup_dir='/opt/agm/backups/daily'
readonly dsar_dir='/opt/agm/production/dsar'

case "$category" in
  expiredAuthSessions|revokedAuthSessions|completedDsarRecords|generatedDsarExports|postgresBackups|suppressionLedgerEntries|identifierAuditLogs) ;;
  *) printf 'RETENTION_STOP reason=CATEGORY_NOT_ALLOWED\n' >&2; exit 1;;
esac
printf '%s  %s\n' "$policy_sha" "$policy" | sha256sum -c - >/dev/null
grep -q '"productionActivationAuthorized": true' "$policy"
if grep -Eq '^(RETENTION_ENGINE_ENABLED|RETENTION_EXECUTE)=true$' "$env_file"; then printf 'RETENTION_STOP reason=LEGACY_EXECUTION_FLAG_PRESENT\n' >&2; exit 1; fi
install -d -o root -g root -m 0700 "$evidence_dir"
exec 9>/run/lock/agm-retention-production.lock
flock --wait 30 9 || { printf 'RETENTION_STOP reason=GLOBAL_LOCK_BUSY\n' >&2; exit 1; }

run_id="$(date -u +%Y%m%dT%H%M%SZ)-${category}"
proof="$evidence_dir/${run_id}.jsonl"
started="$(date -u +%FT%TZ)"
failure() { printf '{"contract":"agm-retention-proof.v1","runId":"%s","category":"%s","state":"FAILED","at":"%s","contentIncluded":false}\n' "$run_id" "$category" "$(date -u +%FT%TZ)" >> "$proof";chmod 0600 "$proof"; }
trap failure ERR

docker exec "$api" node /app/apps/api/dsar-foundation/verify-foundation.mjs >/dev/null
printf '{"contract":"agm-retention-proof.v1","runId":"%s","category":"%s","state":"PRECHECK_LEDGER_PASS","at":"%s","policySha256":"%s","contentIncluded":false}\n' "$run_id" "$category" "$started" "$policy_sha" >> "$proof"

batch_for() { case "$1" in expiredAuthSessions|revokedAuthSessions|completedDsarRecords|identifierAuditLogs)echo 10;;generatedDsarExports|suppressionLedgerEntries)echo 5;;postgresBackups)echo 2;;esac; }
batch="$(batch_for "$category")"

psql_query() { printf '%s\n' "$1" | docker exec -i "$db" sh -lc 'exec psql -X -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At'; }
database_precheck() {
  case "$category" in
    expiredAuthSessions) psql_query 'SELECT count(*) FILTER (WHERE s."expiresAt"<=CURRENT_TIMESTAMP-interval '\''24 hours'\'' AND s."revokedAt" IS NULL AND u."legalRetentionReason" IS NULL AND (u."retentionUntil" IS NULL OR u."retentionUntil"<=CURRENT_TIMESTAMP))||'\''|'\''||count(*) FILTER (WHERE s."expiresAt"<=CURRENT_TIMESTAMP-interval '\''24 hours'\'' AND s."revokedAt" IS NULL AND (u."legalRetentionReason" IS NOT NULL OR u."retentionUntil">CURRENT_TIMESTAMP))||'\''|0'\'' FROM "AuthSession" s JOIN "User" u ON u.id=s."userId";';;
    revokedAuthSessions) psql_query 'SELECT count(*) FILTER (WHERE s."revokedAt"<=CURRENT_TIMESTAMP-interval '\''30 days'\'' AND u."legalRetentionReason" IS NULL AND (u."retentionUntil" IS NULL OR u."retentionUntil"<=CURRENT_TIMESTAMP))||'\''|'\''||count(*) FILTER (WHERE s."revokedAt"<=CURRENT_TIMESTAMP-interval '\''30 days'\'' AND (u."legalRetentionReason" IS NOT NULL OR u."retentionUntil">CURRENT_TIMESTAMP))||'\''|0'\'' FROM "AuthSession" s JOIN "User" u ON u.id=s."userId";';;
    completedDsarRecords) psql_query 'SELECT count(*) FILTER (WHERE d."completedAt"<date_trunc('\''year'\'',CURRENT_TIMESTAMP)-interval '\''3 years'\'' AND COALESCE(d.metadata->>'\''legalHold'\'','\''false'\'')!='\''true'\'' AND COALESCE(d.metadata->>'\''incidentHold'\'','\''false'\'')!='\''true'\'' AND u."legalRetentionReason" IS NULL AND (u."retentionUntil" IS NULL OR u."retentionUntil"<=CURRENT_TIMESTAMP))||'\''|'\''||count(*) FILTER (WHERE d."completedAt"<date_trunc('\''year'\'',CURRENT_TIMESTAMP)-interval '\''3 years'\'' AND (d.metadata->>'\''legalHold'\''='\''true'\'' OR d.metadata->>'\''incidentHold'\''='\''true'\'' OR u."legalRetentionReason" IS NOT NULL OR u."retentionUntil">CURRENT_TIMESTAMP))||'\''|'\''||count(*) FILTER (WHERE (d.metadata?'\''legalHold'\'' AND jsonb_typeof(d.metadata->'\''legalHold'\'')!='\''boolean'\'') OR (d.metadata?'\''incidentHold'\'' AND jsonb_typeof(d.metadata->'\''incidentHold'\'')!='\''boolean'\'')) FROM "DataSubjectRequest" d JOIN "User" u ON u.id=d."requestedByUserId";';;
    identifierAuditLogs) psql_query 'SELECT count(*) FILTER (WHERE a."occurredAt"<=CURRENT_TIMESTAMP-interval '\''90 days'\'' AND COALESCE(a.metadata->>'\''legalHold'\'','\''false'\'')!='\''true'\'' AND COALESCE(a.metadata->>'\''incidentHold'\'','\''false'\'')!='\''true'\'' AND (u.id IS NULL OR (u."legalRetentionReason" IS NULL AND (u."retentionUntil" IS NULL OR u."retentionUntil"<=CURRENT_TIMESTAMP))))||'\''|'\''||count(*) FILTER (WHERE a."occurredAt"<=CURRENT_TIMESTAMP-interval '\''90 days'\'' AND (a.metadata->>'\''legalHold'\''='\''true'\'' OR a.metadata->>'\''incidentHold'\''='\''true'\'' OR u."legalRetentionReason" IS NOT NULL OR u."retentionUntil">CURRENT_TIMESTAMP))||'\''|'\''||count(*) FILTER (WHERE (a.metadata?'\''legalHold'\'' AND jsonb_typeof(a.metadata->'\''legalHold'\'')!='\''boolean'\'') OR (a.metadata?'\''incidentHold'\'' AND jsonb_typeof(a.metadata->'\''incidentHold'\'')!='\''boolean'\'')) FROM "AuditEvent" a LEFT JOIN "User" u ON u.id=a."actorUserId";';;
  esac
}

database_execute() {
  local expected="$1"
  case "$category" in
    expiredAuthSessions) psql_query "BEGIN;LOCK TABLE \"AuthSession\" IN SHARE ROW EXCLUSIVE MODE;LOCK TABLE \"User\" IN SHARE MODE;SET LOCAL agm.expected_eligible='$expected';DO \$guard\$ DECLARE actual bigint;BEGIN SELECT count(*) INTO actual FROM \"AuthSession\" s JOIN \"User\" u ON u.id=s.\"userId\" WHERE s.\"expiresAt\"<=CURRENT_TIMESTAMP-interval '24 hours' AND s.\"revokedAt\" IS NULL AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP);IF actual<>current_setting('agm.expected_eligible')::bigint THEN RAISE EXCEPTION 'ELIGIBILITY_CHANGED_FAIL_CLOSED';END IF;END \$guard\$;WITH candidates AS MATERIALIZED(SELECT s.id FROM \"AuthSession\" s JOIN \"User\" u ON u.id=s.\"userId\" WHERE s.\"expiresAt\"<=CURRENT_TIMESTAMP-interval '24 hours' AND s.\"revokedAt\" IS NULL AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP) ORDER BY s.\"expiresAt\" LIMIT $batch FOR UPDATE OF s),deleted AS(DELETE FROM \"AuthSession\" s USING candidates c WHERE s.id=c.id RETURNING 1)SELECT count(*) FROM deleted;COMMIT;";;
    revokedAuthSessions) psql_query "BEGIN;LOCK TABLE \"AuthSession\" IN SHARE ROW EXCLUSIVE MODE;LOCK TABLE \"User\" IN SHARE MODE;SET LOCAL agm.expected_eligible='$expected';DO \$guard\$ DECLARE actual bigint;BEGIN SELECT count(*) INTO actual FROM \"AuthSession\" s JOIN \"User\" u ON u.id=s.\"userId\" WHERE s.\"revokedAt\"<=CURRENT_TIMESTAMP-interval '30 days' AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP);IF actual<>current_setting('agm.expected_eligible')::bigint THEN RAISE EXCEPTION 'ELIGIBILITY_CHANGED_FAIL_CLOSED';END IF;END \$guard\$;WITH candidates AS MATERIALIZED(SELECT s.id FROM \"AuthSession\" s JOIN \"User\" u ON u.id=s.\"userId\" WHERE s.\"revokedAt\"<=CURRENT_TIMESTAMP-interval '30 days' AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP) ORDER BY s.\"revokedAt\" LIMIT $batch FOR UPDATE OF s),deleted AS(DELETE FROM \"AuthSession\" s USING candidates c WHERE s.id=c.id RETURNING 1)SELECT count(*) FROM deleted;COMMIT;";;
    completedDsarRecords) psql_query "BEGIN;LOCK TABLE \"DataSubjectRequest\" IN SHARE ROW EXCLUSIVE MODE;LOCK TABLE \"User\" IN SHARE MODE;SET LOCAL agm.expected_eligible='$expected';DO \$guard\$ DECLARE actual bigint;BEGIN SELECT count(*) INTO actual FROM \"DataSubjectRequest\" d JOIN \"User\" u ON u.id=d.\"requestedByUserId\" WHERE d.\"completedAt\"<date_trunc('year',CURRENT_TIMESTAMP)-interval '3 years' AND COALESCE(d.metadata->>'legalHold','false')!='true' AND COALESCE(d.metadata->>'incidentHold','false')!='true' AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP);IF actual<>current_setting('agm.expected_eligible')::bigint THEN RAISE EXCEPTION 'ELIGIBILITY_CHANGED_FAIL_CLOSED';END IF;END \$guard\$;WITH candidates AS MATERIALIZED(SELECT d.id FROM \"DataSubjectRequest\" d JOIN \"User\" u ON u.id=d.\"requestedByUserId\" WHERE d.\"completedAt\"<date_trunc('year',CURRENT_TIMESTAMP)-interval '3 years' AND COALESCE(d.metadata->>'legalHold','false')!='true' AND COALESCE(d.metadata->>'incidentHold','false')!='true' AND u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP) ORDER BY d.\"completedAt\" LIMIT $batch FOR UPDATE OF d),deleted AS(DELETE FROM \"DataSubjectRequest\" d USING candidates c WHERE d.id=c.id RETURNING 1)SELECT count(*) FROM deleted;COMMIT;";;
    identifierAuditLogs) psql_query "BEGIN;LOCK TABLE \"AuditEvent\" IN SHARE ROW EXCLUSIVE MODE;LOCK TABLE \"User\" IN SHARE MODE;SET LOCAL agm.expected_eligible='$expected';DO \$guard\$ DECLARE actual bigint;BEGIN SELECT count(*) INTO actual FROM \"AuditEvent\" a LEFT JOIN \"User\" u ON u.id=a.\"actorUserId\" WHERE a.\"occurredAt\"<=CURRENT_TIMESTAMP-interval '90 days' AND COALESCE(a.metadata->>'legalHold','false')!='true' AND COALESCE(a.metadata->>'incidentHold','false')!='true' AND (u.id IS NULL OR (u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP)));IF actual<>current_setting('agm.expected_eligible')::bigint THEN RAISE EXCEPTION 'ELIGIBILITY_CHANGED_FAIL_CLOSED';END IF;END \$guard\$;WITH candidates AS MATERIALIZED(SELECT a.id FROM \"AuditEvent\" a LEFT JOIN \"User\" u ON u.id=a.\"actorUserId\" WHERE a.\"occurredAt\"<=CURRENT_TIMESTAMP-interval '90 days' AND COALESCE(a.metadata->>'legalHold','false')!='true' AND COALESCE(a.metadata->>'incidentHold','false')!='true' AND (u.id IS NULL OR (u.\"legalRetentionReason\" IS NULL AND (u.\"retentionUntil\" IS NULL OR u.\"retentionUntil\"<=CURRENT_TIMESTAMP))) ORDER BY a.\"occurredAt\" LIMIT $batch FOR UPDATE OF a),deleted AS(DELETE FROM \"AuditEvent\" a USING candidates c WHERE a.id=c.id RETURNING 1)SELECT count(*) FROM deleted;COMMIT;";;
  esac
}

if [[ "$category" == generatedDsarExports || "$category" == postgresBackups || "$category" == suppressionLedgerEntries ]]; then
  mounts=(-v "$dsar_dir:/run/agm/dsar:rw" -v "$runner:/runner.mjs:ro")
  utility_user=()
  if [[ "$category" == postgresBackups ]];then mounts+=(-v "$backup_dir:/opt/agm/backups/daily:rw");utility_user=(--user 0:0);fi
  dry="$(docker run --rm --network none "${utility_user[@]}" --env-file "$env_file" -e RETENTION_PRODUCTION_EXECUTE=false "${mounts[@]}" "$image" node /runner.mjs "$category" "$batch")"
  eligible="$(printf '%s' "$dry"|sed -n 's/.*"eligible":\([0-9][0-9]*\).*/\1/p')";held="$(printf '%s' "$dry"|sed -n 's/.*"protectedByHold":\([0-9][0-9]*\).*/\1/p')";unclassified="$(printf '%s' "$dry"|sed -n 's/.*"unclassified":\([0-9][0-9]*\).*/\1/p')"
  [[ -n "$eligible" && -n "$held" && "$unclassified" == 0 ]]
  printf '{"contract":"agm-retention-proof.v1","runId":"%s","category":"%s","state":"PREPARED","eligible":%s,"protectedByHold":%s,"unclassified":0,"batchLimit":%s,"at":"%s","contentIncluded":false}\n' "$run_id" "$category" "$eligible" "$held" "$batch" "$(date -u +%FT%TZ)" >> "$proof"
  result="$(docker run --rm --network none "${utility_user[@]}" --env-file "$env_file" -e RETENTION_PRODUCTION_EXECUTE=true "${mounts[@]}" "$image" node /runner.mjs "$category" "$batch" "$eligible" "$held")"
  affected="$(printf '%s' "$result"|sed -n 's/.*"affected":\([0-9][0-9]*\).*/\1/p')"
else
  IFS='|' read -r eligible held unclassified <<<"$(database_precheck)"
  [[ "$unclassified" == 0 ]]
  printf '{"contract":"agm-retention-proof.v1","runId":"%s","category":"%s","state":"PREPARED","eligible":%s,"protectedByHold":%s,"unclassified":0,"batchLimit":%s,"at":"%s","contentIncluded":false}\n' "$run_id" "$category" "$eligible" "$held" "$batch" "$(date -u +%FT%TZ)" >> "$proof"
  affected="$(database_execute "$eligible")"
fi
[[ "$affected" =~ ^[0-9]+$ ]] && (( affected <= batch ))
printf '{"contract":"agm-retention-proof.v1","runId":"%s","category":"%s","state":"COMPLETED","eligible":%s,"protectedByHold":%s,"affected":%s,"unclassified":0,"batchLimit":%s,"at":"%s","contentIncluded":false}\n' "$run_id" "$category" "$eligible" "$held" "$affected" "$batch" "$(date -u +%FT%TZ)" >> "$proof"
chmod 0600 "$proof"
trap - ERR
printf 'RETENTION_CATEGORY_PASS category=%s eligible=%s held=%s affected=%s batch=%s proof=%s\n' "$category" "$eligible" "$held" "$affected" "$batch" "$(basename "$proof")"
