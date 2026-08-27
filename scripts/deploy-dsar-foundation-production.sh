#!/usr/bin/env bash
set -euo pipefail

readonly change_id='AGM-CHG-20260816-DSAR-FOUNDATION-01'
readonly archive='/tmp/agm-dsar-foundation-candidate.tar.gz'
readonly archive_sha256='bc85e0b9be2549ffc4d2009090b3f8de646444cd218fcc4ac02517981d0b86ec'
readonly release_dir="/opt/agm/production/releases/${change_id}"
readonly rollback_dir="/opt/agm/production/rollback/${change_id}"
readonly env_file='/opt/agm/production/secrets/agm-production.env'
readonly compose_file='/opt/agm/production/compose.production.yml'
readonly dsar_dir='/opt/agm/production/dsar'
readonly candidate_image='agm-api:dsar-foundation-20260816-r1'
readonly base_image='agm-api:premium-web-search-20260815-r2'
readonly db_container='agm-postgres'
readonly api_container='agm-production-api'
readonly rehearsal_container='agm-dsar-schema-rehearsal'

changed=0
printf 'PHASE=RETRY_SYNTHETIC_CLEANUP\n'
if [[ -e "$dsar_dir/suppression-ledger.jsonl" ]]; then
  test "$(find "$dsar_dir/exports" -mindepth 1 -maxdepth 1 2>/dev/null | wc -l)" = 0
  test "$(wc -l < "$dsar_dir/suppression-ledger.jsonl")" = 1
  grep -q '"action":"COMPACTION_CHECKPOINT"' "$dsar_dir/suppression-ledger.jsonl"
  zero_pseudonym="$(printf '0%.0s' $(seq 1 64))"
  grep -q "\"subjectPseudonym\":\"${zero_pseudonym}\"" "$dsar_dir/suppression-ledger.jsonl"
  zero_pseudonym=''
  printf '{"synthetic_checkpoint_only":true,"personal_records":0}\n'
  rm -f -- "$dsar_dir/suppression-ledger.jsonl"
  rmdir "$dsar_dir/exports" "$dsar_dir"
  printf 'orphan_synthetic_foundation_removed=true recoverable=false\n'
fi
rollback() {
  local reason="$1"
  trap - ERR
  printf 'DEPLOY_FAIL reason=%s rollback_started=true\n' "$reason" >&2
  docker rm -f "$rehearsal_container" >/dev/null 2>&1 || true
  if [[ "$changed" == 1 ]]; then
    install -o root -g root -m 0600 "$rollback_dir/agm-production.env.before" "$env_file"
    install -o root -g root -m 0644 "$rollback_dir/compose.production.yml.before" "$compose_file"
    docker compose --project-name agm-production --file "$compose_file" up --detach --no-build --no-deps api >/dev/null 2>&1 || true
    docker exec -i "$db_container" sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL' || true
BEGIN;
DO $rollback$
DECLARE has_rows boolean;
BEGIN
  IF to_regclass('public."DataSubjectRequest"') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM "DataSubjectRequest" LIMIT 1)' INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION 'DSAR_ROLLBACK_REFUSED_NONEMPTY_DataSubjectRequest'; END IF;
  END IF;
  IF to_regclass('public."DataRightsExternalRequest"') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM "DataRightsExternalRequest" LIMIT 1)' INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION 'DSAR_ROLLBACK_REFUSED_NONEMPTY_DataRightsExternalRequest'; END IF;
  END IF;
  IF to_regclass('public."SubjectDataIndex"') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM "SubjectDataIndex" LIMIT 1)' INTO has_rows;
    IF has_rows THEN RAISE EXCEPTION 'DSAR_ROLLBACK_REFUSED_NONEMPTY_SubjectDataIndex'; END IF;
  END IF;
END $rollback$;
DROP TABLE IF EXISTS "SubjectDataIndex";
DROP TABLE IF EXISTS "DataRightsExternalRequest";
DROP TABLE IF EXISTS "DataSubjectRequest";
DELETE FROM "_prisma_migrations" WHERE migration_name IN (
  '20260816090000_refresh_families_and_dsar',
  '20260816190000_add_dsar_external_and_subject_index'
);
COMMIT;
SQL
  fi
  printf 'DEPLOY_FAIL rollback_completed=true\n' >&2
  exit 1
}
trap 'rollback unexpected_error_at_line_${LINENO}' ERR

printf 'CHANGE_ID=%s\n' "$change_id"
printf 'PHASE=PACKAGE_VERIFY\n'
printf '%s  %s\n' "$archive_sha256" "$archive" | sha256sum -c -
install -d -o root -g root -m 0750 "$release_dir" "$rollback_dir"
tar -xzf "$archive" -C "$release_dir"
find "$release_dir" -type f -exec sha256sum {} + | sort -k2
if grep -RIEq '(sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY[[:space:]]*=|DSAR_SUPPRESSION_LEDGER_KEY[[:space:]]*=)' "$release_dir"; then
  rollback secret_pattern_in_candidate
fi

printf 'PHASE=IMMEDIATE_BACKUP\n'
install -o root -g root -m 0600 "$env_file" "$rollback_dir/agm-production.env.before"
install -o root -g root -m 0644 "$compose_file" "$rollback_dir/compose.production.yml.before"
docker inspect "$api_container" > "$rollback_dir/api.before.inspect.json"
chmod 0600 "$rollback_dir/api.before.inspect.json"
postgres_user="$(docker exec "$db_container" printenv POSTGRES_USER)"
postgres_db="$(docker exec "$db_container" printenv POSTGRES_DB)"
prechange_dump="$rollback_dir/postgres.prechange.dump"
docker exec "$db_container" pg_dump -U "$postgres_user" -d "$postgres_db" --format=custom --compress=6 --no-owner --no-privileges > "$prechange_dump"
chmod 0600 "$prechange_dump"
docker exec -i "$db_container" pg_restore --list < "$prechange_dump" >/dev/null
sha256sum "$prechange_dump" > "$rollback_dir/postgres.prechange.dump.sha256"
chmod 0600 "$rollback_dir/postgres.prechange.dump.sha256"
printf 'prechange_backup_verified=true sha256=%s size_bytes=%s\n' "$(sha256sum "$prechange_dump" | awk '{print $1}')" "$(stat -c %s "$prechange_dump")"

printf 'PHASE=ISOLATED_SCHEMA_REHEARSAL\n'
postgres_image="$(docker inspect "$db_container" --format '{{.Config.Image}}')"
docker rm -f "$rehearsal_container" >/dev/null 2>&1 || true
docker run --detach --name "$rehearsal_container" --network none --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=512m \
  -e POSTGRES_USER=agm_synthetic -e POSTGRES_PASSWORD=synthetic-not-a-secret -e POSTGRES_DB=agm_synthetic "$postgres_image" >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$rehearsal_container" pg_isready -U agm_synthetic -d agm_synthetic >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$rehearsal_container" pg_isready -U agm_synthetic -d agm_synthetic >/dev/null
docker exec -i "$rehearsal_container" pg_restore -U agm_synthetic -d agm_synthetic --schema-only --no-owner --no-privileges < "$prechange_dump"
docker exec -i "$rehearsal_container" psql -X -v ON_ERROR_STOP=1 -U agm_synthetic -d agm_synthetic < "$release_dir/prisma/migrations/20260816090000_refresh_families_and_dsar/migration.sql"
docker exec -i "$rehearsal_container" psql -X -v ON_ERROR_STOP=1 -U agm_synthetic -d agm_synthetic < "$release_dir/prisma/migrations/20260816190000_add_dsar_external_and_subject_index/migration.sql"
test "$(docker exec "$rehearsal_container" psql -X -At -U agm_synthetic -d agm_synthetic -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')")" = 3
docker exec -i "$rehearsal_container" psql -X -v ON_ERROR_STOP=1 -U agm_synthetic -d agm_synthetic -At <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')),
  'rows',json_build_object(
    'DataSubjectRequest',(SELECT count(*) FROM "DataSubjectRequest"),
    'DataRightsExternalRequest',(SELECT count(*) FROM "DataRightsExternalRequest"),
    'SubjectDataIndex',(SELECT count(*) FROM "SubjectDataIndex")
  )
);
ROLLBACK;
SQL
docker exec -i "$rehearsal_container" psql -X -v ON_ERROR_STOP=1 -U agm_synthetic -d agm_synthetic < "$release_dir/deploy/production/dsar-foundation/rollback-empty-expand.sql"
test "$(docker exec "$rehearsal_container" psql -X -At -U agm_synthetic -d agm_synthetic -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')")" = 0
docker rm -f "$rehearsal_container" >/dev/null
printf 'schema_only_restore=true migration_apply=true rollback_empty_expand=true personal_rows_restored=0\n'

printf 'PHASE=CANDIDATE_IMAGE\n'
docker image inspect "$base_image" >/dev/null
docker build --pull=false --build-arg "BASE_IMAGE=$base_image" --file "$release_dir/deploy/production/dsar-foundation.Dockerfile" --tag "$candidate_image" "$release_dir" >/dev/null
candidate_id="$(docker image inspect "$candidate_image" --format '{{.Id}}')"
printf 'candidate_image_id=%s\n' "$candidate_id"
test "$(docker image inspect "$candidate_image" --format '{{.Config.User}}')" = node
test "$(docker image inspect "$candidate_image" --format '{{json .Config.Cmd}}')" = '["node","apps/api/dist/main.js"]'

printf 'PHASE=SECRET_AND_STORAGE\n'
install -d -o 1000 -g 1000 -m 0700 "$dsar_dir" "$dsar_dir/exports"
if grep -q '^DSAR_SUPPRESSION_LEDGER_KEY=' "$env_file"; then rollback dsar_key_already_present; fi
hmac_key="$(openssl rand -base64 48 | tr -d '\n')"
temporary_env="$(mktemp /opt/agm/production/secrets/.agm-production.env.dsarfoundation.XXXXXX)"
chmod 0600 "$temporary_env"
cp "$env_file" "$temporary_env"
{
  printf '\nDSAR_SUPPRESSION_LEDGER_REQUIRED=true\n'
  printf 'DSAR_SUPPRESSION_LEDGER_PATH=/run/agm/dsar/suppression-ledger.jsonl\n'
  printf 'DSAR_EXPORT_DIR=/run/agm/dsar/exports\n'
  printf 'DSAR_SUPPRESSION_LEDGER_KEY=%s\n' "$hmac_key"
} >> "$temporary_env"
install -o root -g root -m 0600 "$temporary_env" "$env_file"
rm -f "$temporary_env"
hmac_key=''
changed=1

if ! grep -q '/opt/agm/production/dsar:/run/agm/dsar:rw' "$compose_file"; then
  sed -i '\#/opt/agm/production/runtime/production-preflight.latest.json:/run/agm/production-preflight.latest.json:ro#a\      - /opt/agm/production/dsar:/run/agm/dsar:rw' "$compose_file"
fi
sed -i -E "s#^([[:space:]]*image:)[[:space:]]*agm-api:[^[:space:]]+#\\1 ${candidate_image}#" "$compose_file"
docker compose --project-name agm-production --file "$compose_file" config --quiet

docker run --rm --network none --env-file "$env_file" -v "$dsar_dir:/run/agm/dsar:rw" "$candidate_image" node /app/apps/api/dsar-foundation/init-ledger.mjs
chown 1000:1000 "$dsar_dir/suppression-ledger.jsonl"
chmod 0600 "$dsar_dir/suppression-ledger.jsonl"
docker run --rm --network none --env-file "$env_file" -v "$dsar_dir:/run/agm/dsar:rw" "$candidate_image" node /app/apps/api/dsar-foundation/verify-foundation.mjs

printf 'PHASE=PRODUCTION_MIGRATION\n'
docker run --rm --network app_default --env-file "$env_file" "$candidate_image" node_modules/.bin/prisma migrate deploy

printf 'PHASE=API_DEPLOY\n'
systemctl restart agm-production-api.service
for _ in $(seq 1 30); do
  health="$(docker inspect "$api_container" --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  [[ "$health" == healthy ]] && break
  sleep 2
done
test "$(docker inspect "$api_container" --format '{{.State.Health.Status}}')" = healthy
test "$(docker inspect "$api_container" --format '{{.Config.Image}}')" = "$candidate_image"
docker exec "$api_container" node /app/apps/api/dsar-foundation/verify-foundation.mjs

printf 'PHASE=POST_DEPLOY_GATES\n'
for endpoint in health/live health/ready; do
  test "$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "https://api.agmcockpit.com/api/v1/$endpoint")" = 200
done
docker exec -i "$db_container" sh -lc 'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex')),
  'rows',json_build_object(
    'DataSubjectRequest',(SELECT count(*) FROM "DataSubjectRequest"),
    'DataRightsExternalRequest',(SELECT count(*) FROM "DataRightsExternalRequest"),
    'SubjectDataIndex',(SELECT count(*) FROM "SubjectDataIndex")
  )
);
SELECT json_build_object('indexes',count(*)) FROM pg_indexes WHERE schemaname='public' AND tablename IN ('DataSubjectRequest','DataRightsExternalRequest','SubjectDataIndex');
ROLLBACK;
SQL
test "$(systemctl list-unit-files --no-pager --no-legend | awk 'tolower($1) ~ /retention|lifecycle/ {count++} END {print count+0}')" = 0
if docker inspect "$api_container" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^(RETENTION_ENGINE_ENABLED|RETENTION_EXECUTE)=true$'; then
  rollback retention_became_active
fi
test "$(find "$dsar_dir/exports" -mindepth 1 -maxdepth 1 | wc -l)" = 0
printf 'secret_store_mode=%s ledger_mode=%s export_artifacts=0 retention_jobs=DISABLED\n' "$(stat -c %a "$env_file")" "$(stat -c %a "$dsar_dir/suppression-ledger.jsonl")"

trap - ERR
printf 'DSAR_FOUNDATION_DEPLOY=PASS\n'
