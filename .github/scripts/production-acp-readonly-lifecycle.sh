#!/usr/bin/env bash
set -Eeuo pipefail
set +x

role="${1:?temporary role name required}"
[[ "$role" =~ ^agm_acp_ro_[0-9]+_[0-9]+$ ]] || { echo 'ACPM_REMOTE=BLOCKED invalid role identifier'; exit 1; }

command -v docker >/dev/null
docker inspect agm-production-api >/dev/null
docker inspect agm-postgres >/dev/null
[[ "$(docker inspect --format '{{.State.Running}}' agm-production-api)" == true ]] || { echo 'ACPM_REMOTE=BLOCKED API container not running'; exit 1; }
[[ "$(docker inspect --format '{{.State.Running}}' agm-postgres)" == true ]] || { echo 'ACPM_REMOTE=BLOCKED PostgreSQL container not running'; exit 1; }
docker exec agm-postgres pg_isready --quiet || { echo 'ACPM_REMOTE=BLOCKED PostgreSQL not ready'; exit 1; }

# Read only sanitized fields from DATABASE_URL; never print or persist its credentials.
db_info="$(docker exec agm-production-api node -e 'const u=new URL(process.env.DATABASE_URL);const db=decodeURIComponent(u.pathname.slice(1));if(!u.hostname||!db)process.exit(2);process.stdout.write([u.hostname,u.port||"5432",db].join("\t"))')" || { echo 'ACPM_REMOTE=BLOCKED API database target unavailable'; exit 1; }
IFS=$'\t' read -r db_host db_port db_name <<< "$db_info"
[[ "$db_host" =~ ^[A-Za-z0-9._:-]+$ && "$db_port" == 5432 && "$db_name" =~ ^[A-Za-z0-9_]+$ ]] || { echo 'ACPM_REMOTE=BLOCKED unsupported database target format'; exit 1; }

api_networks="$(docker inspect --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{println $name}}{{end}}' agm-production-api)"
pg_networks="$(docker inspect --format '{{range $name, $cfg := .NetworkSettings.Networks}}{{println $name}}{{end}}' agm-postgres)"
shared_network=false
while IFS= read -r network; do
  [[ -n "$network" ]] || continue
  if grep -Fxq "$network" <<< "$pg_networks"; then shared_network=true; break; fi
done <<< "$api_networks"
[[ "$shared_network" == true ]] || { echo 'ACPM_REMOTE=BLOCKED API and PostgreSQL have no shared Docker network'; exit 1; }
pg_ips="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' agm-postgres)"
resolved_db_ips="$(docker exec agm-production-api node -e 'require("node:dns").lookup(process.argv[1],{all:true},(e,a)=>{if(e)process.exit(2);process.stdout.write(a.map(x=>x.address).join("\n"))})' "$db_host")" || { echo 'ACPM_REMOTE=BLOCKED API database hostname did not resolve'; exit 1; }
target_matches_postgres=false
while IFS= read -r resolved_ip; do
  [[ -n "$resolved_ip" ]] || continue
  if grep -Fxq "$resolved_ip" <<< "$pg_ips"; then target_matches_postgres=true; break; fi
done <<< "$resolved_db_ips"
[[ "$target_matches_postgres" == true ]] || { echo 'ACPM_REMOTE=BLOCKED API DATABASE_URL does not resolve to agm-postgres'; exit 1; }

preflight="$(docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
  exec psql -X -A -t -F "|" -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" \
    -v acp_target_db="$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
' <<'SQL'
SELECT current_database() = :'acp_target_db',
       NOT pg_is_in_recovery(),
       COALESCE((SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname=current_user), false),
       to_regclass('public."AuthorityAuditJournal"') IS NOT NULL,
       (SELECT count(*) = 5 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='AuthorityAuditJournal'
           AND column_name IN ('companyId','eventId','eventType','occurredAt','payloadHash')),
       NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'acp_role');
SQL
)" || { echo 'ACPM_REMOTE=BLOCKED PostgreSQL administrative preflight failed'; exit 1; }
IFS='|' read -r db_matches primary_writable admin_can_create journal_exists columns_exist role_available <<< "$preflight"
[[ "$db_matches" == t && "$primary_writable" == t && "$admin_can_create" == t && "$journal_exists" == t && "$columns_exist" == t && "$role_available" == t ]] || { echo 'ACPM_REMOTE=BLOCKED PostgreSQL identity, schema, privilege, or role-collision preflight failed'; exit 1; }
echo 'ACPM_REMOTE=PREFLIGHT_PASS target=API_DATABASE_URL container=agm-postgres journal=present'

migration_status="$(docker exec -i -e ACPM_TARGET_DB="$db_name" agm-postgres sh -ceu '
  exec psql -X -A -t -F "|" -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB"
' <<'SQL'
SELECT
  to_regclass('public."_prisma_migrations"') IS NOT NULL,
  COALESCE((SELECT count(*) FROM "_prisma_migrations"), -1),
  COALESCE((SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL), -1),
  COALESCE((SELECT string_agg(migration_name, ',' ORDER BY migration_name) FROM "_prisma_migrations"
    WHERE migration_name LIKE '%0003%' OR migration_name LIKE '%0004%'), ''),
  to_regclass('public."PreDepartureSession"') IS NOT NULL,
  to_regclass('public."PreDepartureAnswer"') IS NOT NULL,
  to_regclass('public."AuthorityExecutionClaim"') IS NOT NULL,
  to_regclass('public."UniversalMandateLifecycleRecord"') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='UniversalMandateLifecycleRecord'
        AND column_name='riskAssessmentId')
    AND EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='UniversalMandateLifecycleRecord'
        AND column_name='protectionSetId');
SQL
)" || { echo 'ACPM_REMOTE=BLOCKED Prisma migration read failed'; exit 1; }
IFS='|' read -r migration_table_present migration_count incomplete_count migration_0003_0004_names predeparture_session_present predeparture_answer_present authority_claim_present universal_risk_columns_present <<< "$migration_status"
[[ "$migration_table_present" == t && "$migration_count" =~ ^[0-9]+$ && "$incomplete_count" =~ ^[0-9]+$ ]] || { echo 'ACPM_REMOTE=MIGRATION_STATUS_UNKNOWN table_or_counts_invalid'; exit 1; }
[[ "$incomplete_count" == 0 ]] || { echo "ACPM_REMOTE=MIGRATION_STATUS_FAIL incomplete=$incomplete_count"; exit 1; }
echo "ACPM_REMOTE=MIGRATION_STATUS_PASS table_present=true applied=$migration_count incomplete=$incomplete_count"
if [[ -n "$migration_0003_0004_names" ]]; then
  echo "ACPM_REMOTE=MIGRATION_0003_0004_MATCHES=$migration_0003_0004_names"
else
  echo 'ACPM_REMOTE=MIGRATION_0003_0004_MATCHES=none'
fi
echo "ACPM_REMOTE=OBJECT_STATUS predeparture_session=$predeparture_session_present predeparture_answer=$predeparture_answer_present authority_claim=$authority_claim_present universal_risk_columns=$universal_risk_columns_present"

migration_manifest="$(docker exec -i -e ACPM_TARGET_DB="$db_name" agm-postgres sh -ceu '
  exec psql -X -A -t -F "|" -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB"
' <<'SQL'
SELECT concat(migration_name, '|', COALESCE(checksum, ''), '|', CASE WHEN rolled_back_at IS NULL THEN 'APPLIED' ELSE 'ROLLED_BACK' END)
FROM "_prisma_migrations"
ORDER BY migration_name;
SQL
)" || { echo 'ACPM_REMOTE=BLOCKED Prisma migration manifest read failed'; exit 1; }
while IFS='|' read -r migration_name migration_checksum migration_state; do
  [[ -n "$migration_name" ]] || continue
  printf 'ACPM_REMOTE=MIGRATION_ROW name=%s state=%s checksum=%s\n' "$migration_name" "$migration_state" "$migration_checksum"
done <<< "$migration_manifest"

temp_password="$(openssl rand -hex 32)" || { echo 'ACPM_REMOTE=BLOCKED secure password generation failed'; exit 1; }
cleanup_needed=true
cleanup() {
  original_status=$?
  trap - EXIT
  cleanup_status=0
  if [[ "$cleanup_needed" == true ]]; then
    role_exists="$(docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
      exec psql -X -A -t -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
    ' <<'SQL'
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'acp_role');
SQL
    )" || role_exists=unknown
    if [[ "$role_exists" == t ]]; then
      docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
        exec psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" \
          -v acp_target_db="$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
      ' <<'SQL' || cleanup_status=$?
ALTER ROLE :"acp_role" NOLOGIN;
REVOKE SELECT ("companyId", "eventId", "eventType", "occurredAt", "payloadHash")
  ON TABLE public."AuthorityAuditJournal" FROM :"acp_role";
REVOKE USAGE ON SCHEMA public FROM :"acp_role";
REVOKE CONNECT ON DATABASE :"acp_target_db" FROM :"acp_role";
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE usename=:'acp_role' AND pid<>pg_backend_pid();
DROP ROLE :"acp_role";
SQL
    elif [[ "$role_exists" != f ]]; then
      cleanup_status=1
    fi

    if [[ "$cleanup_status" == 0 ]]; then
      final_exists="$(docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
        exec psql -X -A -t -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
      ' <<'SQL'
SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=:'acp_role');
SQL
      )" || final_exists=unknown
      remaining_sessions="$(docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
        exec psql -X -A -t -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
      ' <<'SQL'
SELECT count(*) FROM pg_stat_activity WHERE usename=:'acp_role';
SQL
      )" || remaining_sessions=unknown
      if [[ "$final_exists" == f && "$remaining_sessions" == 0 ]]; then
        echo 'ACPM_REMOTE=REVOCATION_VERIFIED role_absent=true sessions=0'
      else
        echo 'ACPM_REMOTE=REVOCATION_FAILED role_or_session_remains'
        cleanup_status=1
      fi
    else
      echo 'ACPM_REMOTE=REVOCATION_FAILED cleanup_command_failed; login expiry is a 30-minute backstop'
    fi
  fi
  unset temp_password
  if [[ "$cleanup_status" != 0 ]]; then exit 1; fi
  exit "$original_status"
}
trap cleanup EXIT

# The role name is generated locally from numeric GitHub run identifiers and validated above.
docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
  exec psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" \
    -v acp_target_db="$ACPM_TARGET_DB" -v acp_role="$ACPM_ROLE"
' <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT CONNECTION LIMIT 1 VALID UNTIL %L',
  :'acp_role', clock_timestamp() + interval '30 minutes'
) \gexec
SQL

printf '%s\n%s\n%s\n' "\\password $role" "$temp_password" "$temp_password" |
  docker exec -i -e ACPM_TARGET_DB="$db_name" agm-postgres sh -ceu '
    exec psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB"
  '

docker exec -i -e ACPM_TARGET_DB="$db_name" -e ACPM_ROLE="$role" agm-postgres sh -ceu '
  exec psql -X -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$ACPM_TARGET_DB" \
    -v acp_role="$ACPM_ROLE" -v acp_target_db="$ACPM_TARGET_DB"
' <<'SQL'
ALTER ROLE :"acp_role" SET default_transaction_read_only = on;
ALTER ROLE :"acp_role" SET statement_timeout = '15s';
ALTER ROLE :"acp_role" SET idle_in_transaction_session_timeout = '10s';
GRANT CONNECT ON DATABASE :"acp_target_db" TO :"acp_role";
GRANT USAGE ON SCHEMA public TO :"acp_role";
GRANT SELECT ("companyId", "eventId", "eventType", "occurredAt", "payloadHash")
  ON TABLE public."AuthorityAuditJournal" TO :"acp_role";
SQL

role_check_sql='SELECT current_user, current_database(), current_setting('\''default_transaction_read_only'\''),
       has_database_privilege(current_user,current_database(),'\'CONNECT'\'''),
       has_schema_privilege(current_user,'\''public'\'','\''USAGE'\'''),
       has_schema_privilege(current_user,'\''public'\'','\''CREATE'\'''),
       has_table_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''SELECT'\'''),
       has_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''companyId'\'','\''SELECT'\'')
         AND has_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''eventId'\'','\''SELECT'\'')
         AND has_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''eventType'\'','\''SELECT'\'')
         AND has_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''occurredAt'\'','\''SELECT'\'')
         AND has_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''payloadHash'\'','\''SELECT'\''),
       NOT EXISTS (SELECT 1 FROM pg_attribute a
         WHERE a.attrelid='\''public."AuthorityAuditJournal"'\''::regclass AND a.attnum>0 AND NOT a.attisdropped
           AND a.attname NOT IN ('\''companyId'\'','\''eventId'\'','\''eventType'\'','\''occurredAt'\'','\''payloadHash'\'')
           AND has_column_privilege(current_user,a.attrelid,a.attname,'\''SELECT'\'')),
       has_table_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''INSERT'\''),
       has_table_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''UPDATE'\''),
       has_table_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''DELETE'\''),
       has_table_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''TRUNCATE'\''),
       has_any_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''INSERT'\''),
       has_any_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''UPDATE'\''),
       has_any_column_privilege(current_user,'\''public."AuthorityAuditJournal"'\'','\''REFERENCES'\''),
       (SELECT rolsuper=false AND rolcreaterole=false AND rolcreatedb=false AND rolcanlogin=true
          AND rolinherit=false AND rolconnlimit=1 AND rolvaliduntil>now()
          AND rolvaliduntil<=now()+interval '\''31 minutes'\''
          AND NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member=pg_roles.oid)
        FROM pg_roles WHERE rolname=current_user);'
role_check="$(printf '%s\n' "$temp_password" | docker exec -i -e ACPM_ROLE="$role" -e ACPM_TARGET_DB="$db_name" -e ACPM_SQL="$role_check_sql" agm-postgres sh -ceu '
  IFS= read -r PGPASSWORD
  export PGPASSWORD
  exec psql -X -A -t -F "|" -v ON_ERROR_STOP=1 --host=127.0.0.1 \
    --username "$ACPM_ROLE" --dbname "$ACPM_TARGET_DB" -c "$ACPM_SQL"
')" || { echo 'ACPM_REMOTE=CHECK_FAILED temporary role login/permission verification failed'; exit 1; }
IFS='|' read -r check_user check_db default_readonly can_connect can_use_schema can_create_schema table_select columns_select other_column_select can_insert can_update can_delete can_truncate column_insert column_update column_references role_attributes <<< "$role_check"
[[ "$check_user" == "$role" && "$check_db" == "$db_name" && "$default_readonly" == on && "$can_connect" == t && "$can_use_schema" == t && "$can_create_schema" == f && "$table_select" == f && "$columns_select" == t && "$other_column_select" == t && "$can_insert" == f && "$can_update" == f && "$can_delete" == f && "$can_truncate" == f && "$column_insert" == f && "$column_update" == f && "$column_references" == f && "$role_attributes" == t ]] || { echo 'ACPM_REMOTE=CHECK_FAILED temporary role privileges did not match least-privilege contract'; exit 1; }

event_probe_sql='
SELECT EXISTS (SELECT 1 FROM public."AuthorityAuditJournal"),
       (SELECT max("occurredAt") IS NOT NULL FROM public."AuthorityAuditJournal"),
       (SELECT length("payloadHash") FROM public."AuthorityAuditJournal" ORDER BY "occurredAt" DESC LIMIT 1);
'
event_probe="$(printf '%s\n' "$temp_password" | docker exec -i -e ACPM_ROLE="$role" -e ACPM_TARGET_DB="$db_name" -e ACPM_SQL="$event_probe_sql" agm-postgres sh -ceu '
  IFS= read -r PGPASSWORD
  export PGPASSWORD
  exec psql -X -A -t -F "|" -v ON_ERROR_STOP=1 --host=127.0.0.1 \
    --username "$ACPM_ROLE" --dbname "$ACPM_TARGET_DB" -c "$ACPM_SQL"
')" || { echo 'ACPM_REMOTE=CHECK_FAILED ACP journal read-only probe failed'; exit 1; }
IFS='|' read -r events_present timestamp_present hash_length <<< "$event_probe"
[[ "$events_present" == t && "$timestamp_present" == t && "$hash_length" =~ ^[0-9]+$ ]] || { echo 'ACPM_REMOTE=PERSISTENCE_UNKNOWN no readable persisted ACP event found'; exit 1; }

echo "ACPM_REMOTE=ROLE_CHECK_PASS read_only=true writes=false role=$role"
echo 'ACPM_REMOTE=ACP_PERSISTENCE_READ_PASS existing_event=true event_payload_not_exported=true'
echo 'ACPM_REMOTE=CHECK_COMPLETE; automatic revocation follows'

