#!/usr/bin/env bash
set -euo pipefail

readonly postgres_container='agm-postgres'
readonly backup_dir='/opt/agm/backups/daily'
readonly approved_backup_generations=7

printf 'CONTRACT=agm-retention-production-readonly.v1\n'
printf 'ENVIRONMENT=Production-Hetzner(masked-host)\n'
printf 'POLICY=owner-approved-2026-08-16\n'
printf 'MUTATION_MODE=PROHIBITED\n'

printf 'RETENTION_JOB_STATUS\n'
retention_units="$({ systemctl list-unit-files --no-pager --no-legend 2>/dev/null || true; } \
  | awk 'tolower($1) ~ /retention|lifecycle/ {count++} END {print count+0}')"
printf '{"matching_units":%s,"status":"%s"}\n' \
  "$retention_units" "$([[ "$retention_units" == 0 ]] && printf DISABLED || printf PRESENT_REVIEW_REQUIRED)"

printf 'DATABASE_READ_ONLY_DRY_RUN\n'
docker exec -i "$postgres_container" sh -lc \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'database', 'masked',
  'environment', 'production'
);

WITH category_rows AS (
  SELECT 'expiredAuthSessions'::text AS category,
    count(*) FILTER (WHERE "revokedAt" IS NULL) AS total,
    count(*) FILTER (WHERE "revokedAt" IS NULL AND "expiresAt" <= CURRENT_TIMESTAMP - interval '24 hours') AS eligible,
    0::bigint AS held,
    min("expiresAt") FILTER (WHERE "revokedAt" IS NULL) AS oldest,
    max("expiresAt") FILTER (WHERE "revokedAt" IS NULL) AS newest,
    0::bigint AS unclassified,
    pg_total_relation_size('"AuthSession"') AS relation_bytes
  FROM "AuthSession"
  UNION ALL
  SELECT 'revokedAuthSessions',
    count(*) FILTER (WHERE "revokedAt" IS NOT NULL),
    count(*) FILTER (WHERE "revokedAt" <= CURRENT_TIMESTAMP - interval '30 days'),
    0,
    min("revokedAt") FILTER (WHERE "revokedAt" IS NOT NULL),
    max("revokedAt") FILTER (WHERE "revokedAt" IS NOT NULL),
    0,
    pg_total_relation_size('"AuthSession"')
  FROM "AuthSession"
  UNION ALL
  SELECT 'completedDsarRecords',
    count(*) FILTER (WHERE "completedAt" IS NOT NULL),
    count(*) FILTER (WHERE "completedAt" < date_trunc('year', CURRENT_TIMESTAMP) - interval '3 years'
      AND COALESCE(metadata->>'legalHold','false') <> 'true'),
    count(*) FILTER (WHERE "completedAt" < date_trunc('year', CURRENT_TIMESTAMP) - interval '3 years'
      AND metadata->>'legalHold' = 'true'),
    min("completedAt") FILTER (WHERE "completedAt" IS NOT NULL),
    max("completedAt") FILTER (WHERE "completedAt" IS NOT NULL),
    count(*) FILTER (WHERE metadata ? 'legalHold' AND metadata->>'legalHold' NOT IN ('true','false')),
    pg_total_relation_size('"DataSubjectRequest"')
  FROM "DataSubjectRequest"
  UNION ALL
  SELECT 'identifierAuditLogs',
    count(*),
    count(*) FILTER (WHERE a."occurredAt" <= CURRENT_TIMESTAMP - interval '90 days'
      AND u."legalRetentionReason" IS NULL
      AND (u."retentionUntil" IS NULL OR u."retentionUntil" <= CURRENT_TIMESTAMP)
      AND COALESCE(a.metadata->>'legalHold','false') <> 'true'),
    count(*) FILTER (WHERE a."occurredAt" <= CURRENT_TIMESTAMP - interval '90 days'
      AND (u."legalRetentionReason" IS NOT NULL
        OR u."retentionUntil" > CURRENT_TIMESTAMP
        OR a.metadata->>'legalHold' = 'true')),
    min(a."occurredAt"),
    max(a."occurredAt"),
    count(*) FILTER (WHERE a.metadata ? 'legalHold' AND a.metadata->>'legalHold' NOT IN ('true','false')),
    pg_total_relation_size('"AuditEvent"')
  FROM "AuditEvent" a LEFT JOIN "User" u ON u.id = a."actorUserId"
), payload AS (
  SELECT json_agg(json_build_object(
    'category', category,
    'total', total,
    'eligible', eligible,
    'protected_by_hold', held,
    'oldest', oldest,
    'newest', newest,
    'estimated_eligible_bytes', CASE WHEN total=0 THEN 0 ELSE round(relation_bytes::numeric * eligible / total) END,
    'unclassified', unclassified,
    'errors', 0
  ) ORDER BY category) AS value FROM category_rows
)
SELECT json_build_object('snapshot','BEFORE','categories',value) FROM payload;

WITH category_rows AS (
  SELECT 'expiredAuthSessions'::text AS category,
    count(*) FILTER (WHERE "revokedAt" IS NULL) AS total,
    count(*) FILTER (WHERE "revokedAt" IS NULL AND "expiresAt" <= CURRENT_TIMESTAMP - interval '24 hours') AS eligible,
    0::bigint AS held,
    min("expiresAt") FILTER (WHERE "revokedAt" IS NULL) AS oldest,
    max("expiresAt") FILTER (WHERE "revokedAt" IS NULL) AS newest,
    0::bigint AS unclassified,
    pg_total_relation_size('"AuthSession"') AS relation_bytes
  FROM "AuthSession"
  UNION ALL
  SELECT 'revokedAuthSessions', count(*) FILTER (WHERE "revokedAt" IS NOT NULL),
    count(*) FILTER (WHERE "revokedAt" <= CURRENT_TIMESTAMP - interval '30 days'), 0,
    min("revokedAt") FILTER (WHERE "revokedAt" IS NOT NULL), max("revokedAt") FILTER (WHERE "revokedAt" IS NOT NULL),
    0, pg_total_relation_size('"AuthSession"') FROM "AuthSession"
  UNION ALL
  SELECT 'completedDsarRecords', count(*) FILTER (WHERE "completedAt" IS NOT NULL),
    count(*) FILTER (WHERE "completedAt" < date_trunc('year', CURRENT_TIMESTAMP) - interval '3 years' AND COALESCE(metadata->>'legalHold','false') <> 'true'),
    count(*) FILTER (WHERE "completedAt" < date_trunc('year', CURRENT_TIMESTAMP) - interval '3 years' AND metadata->>'legalHold' = 'true'),
    min("completedAt") FILTER (WHERE "completedAt" IS NOT NULL), max("completedAt") FILTER (WHERE "completedAt" IS NOT NULL),
    count(*) FILTER (WHERE metadata ? 'legalHold' AND metadata->>'legalHold' NOT IN ('true','false')),
    pg_total_relation_size('"DataSubjectRequest"') FROM "DataSubjectRequest"
  UNION ALL
  SELECT 'identifierAuditLogs', count(*),
    count(*) FILTER (WHERE a."occurredAt" <= CURRENT_TIMESTAMP - interval '90 days' AND u."legalRetentionReason" IS NULL AND (u."retentionUntil" IS NULL OR u."retentionUntil" <= CURRENT_TIMESTAMP) AND COALESCE(a.metadata->>'legalHold','false') <> 'true'),
    count(*) FILTER (WHERE a."occurredAt" <= CURRENT_TIMESTAMP - interval '90 days' AND (u."legalRetentionReason" IS NOT NULL OR u."retentionUntil" > CURRENT_TIMESTAMP OR a.metadata->>'legalHold' = 'true')),
    min(a."occurredAt"), max(a."occurredAt"),
    count(*) FILTER (WHERE a.metadata ? 'legalHold' AND a.metadata->>'legalHold' NOT IN ('true','false')),
    pg_total_relation_size('"AuditEvent"') FROM "AuditEvent" a LEFT JOIN "User" u ON u.id = a."actorUserId"
), payload AS (
  SELECT json_agg(json_build_object(
    'category', category, 'total', total, 'eligible', eligible, 'protected_by_hold', held,
    'oldest', oldest, 'newest', newest,
    'estimated_eligible_bytes', CASE WHEN total=0 THEN 0 ELSE round(relation_bytes::numeric * eligible / total) END,
    'unclassified', unclassified,
    'errors', 0
  ) ORDER BY category) AS value FROM category_rows
)
SELECT json_build_object('snapshot','AFTER','categories',value) FROM payload;
SELECT json_build_object('transaction_read_only_after',current_setting('transaction_read_only'));
ROLLBACK;
SQL

printf 'POSTGRES_BACKUPS_BEFORE\n'
backup_snapshot() {
  local total=0 eligible=0 bytes=0 eligible_bytes=0 oldest='null' newest='null' unclassified=0
  local index=0 mtime size name
  while IFS=$'\t' read -r mtime size name; do
    [[ -n "${name:-}" ]] || continue
    index=$((index + 1)); total=$((total + 1)); bytes=$((bytes + size))
    [[ "$index" -eq 1 ]] && newest="\"$(date -u -d "@$mtime" +%FT%TZ)\""
    oldest="\"$(date -u -d "@$mtime" +%FT%TZ)\""
    if (( index > approved_backup_generations )); then
      eligible=$((eligible + 1)); eligible_bytes=$((eligible_bytes + size))
    fi
  done < <(find "$backup_dir" -maxdepth 1 -type f -name 'agm-postgres-*.dump' -printf '%T@\t%s\t%f\n' | sort -rn)
  unclassified="$(find "$backup_dir" -maxdepth 1 -type f ! -name 'agm-postgres-*.dump' ! -name 'agm-postgres-*.sha256' | wc -l)"
  printf '{"category":"postgresBackups","total":%d,"eligible":%d,"protected_by_hold":0,"oldest":%s,"newest":%s,"total_bytes":%d,"estimated_eligible_bytes":%d,"unclassified":%d,"errors":0}\n' \
    "$total" "$eligible" "$oldest" "$newest" "$bytes" "$eligible_bytes" "$unclassified"
}
backup_snapshot

printf 'FILESYSTEM_CATEGORY_DISCOVERY\n'
docker exec agm-production-api node /app/apps/api/dsar-foundation/verify-foundation.mjs
docker exec agm-production-api node -e '
const fs=require("fs"),path=require("path");
const dir=process.env.DSAR_EXPORT_DIR,cutoff=Date.now()-7*86400000;
let total=0,eligible=0,held=0,bytes=0,eligibleBytes=0,oldest=null,newest=null,unclassified=0,errors=0;
for(const name of fs.readdirSync(dir)){
 if(!name.endsWith(".retention.json")){unclassified++;continue;}
 try{const m=JSON.parse(fs.readFileSync(path.join(dir,name),"utf8"));total++;const dates=[m.deliveryConfirmedAt,m.firstTokenExpiresAt].filter(Boolean).map(Date.parse).filter(Number.isFinite);if(!dates.length){unclassified++;continue;}const trigger=Math.min(...dates);oldest=oldest===null?trigger:Math.min(oldest,trigger);newest=newest===null?trigger:Math.max(newest,trigger);const artifact=path.resolve(dir,m.artifactFile??"");if(!artifact.startsWith(path.resolve(dir)+path.sep)){unclassified++;continue;}const size=fs.existsSync(artifact)?fs.statSync(artifact).size:0;bytes+=size;if(m.legalHold===true){held++;continue;}if(trigger<=cutoff){eligible++;eligibleBytes+=size;}}
 catch{errors++;}
}
console.log(JSON.stringify({category:"generatedDsarExports",total,eligible,protected_by_hold:held,oldest:oldest&&new Date(oldest).toISOString(),newest:newest&&new Date(newest).toISOString(),total_bytes:bytes,estimated_eligible_bytes:eligibleBytes,unclassified,errors}));'
docker exec agm-production-api node -e '
const fs=require("fs");const p=process.env.DSAR_SUPPRESSION_LEDGER_PATH,cutoff=Date.now()-37*86400000;
const rows=fs.readFileSync(p,"utf8").trim().split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(r=>r.action!=="COMPACTION_CHECKPOINT");
let eligible=0,held=0,oldest=null,newest=null,unclassified=0;
for(const r of rows){const t=Date.parse(r.effectiveAt);if(!Number.isFinite(t)){unclassified++;continue;}oldest=oldest===null?t:Math.min(oldest,t);newest=newest===null?t:Math.max(newest,t);if(t<cutoff)eligible++;}
console.log(JSON.stringify({category:"suppressionLedgerEntries",total:rows.length,eligible,protected_by_hold:held,oldest:oldest&&new Date(oldest).toISOString(),newest:newest&&new Date(newest).toISOString(),total_bytes:fs.statSync(p).size,estimated_eligible_bytes:0,unclassified,errors:0}));'

printf 'POSTGRES_BACKUPS_AFTER\n'
backup_snapshot

printf 'SCHEDULER_AFTER\n'
printf '{"matching_units":%s,"status":"%s"}\n' \
  "$retention_units" "$([[ "$retention_units" == 0 ]] && printf DISABLED || printf PRESENT_REVIEW_REQUIRED)"
printf 'HGB_AO_EXCLUSION=accounting,invoices,legally-required-commercial-documents\n'
printf 'MUTATIONS_EXECUTED=0\n'
