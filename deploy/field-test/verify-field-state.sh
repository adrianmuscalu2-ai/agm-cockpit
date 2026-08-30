#!/usr/bin/env bash
set -euo pipefail
source_root=${1:-/opt/agm-field-test/current}
env_file=/opt/agm-field-test/secrets/field.env
compose_file=$source_root/deploy/field-test/compose.field-test.yml
project=agm_field_validation
docker compose -p "$project" --env-file "$env_file" -f "$compose_file" exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
SELECT
  (SELECT count(*) FROM "ProviderUsageEvent" WHERE "providerId"='agm-routing-policy'),
  (SELECT count(*) FROM "CarMoverJob" WHERE "moduleId"='field-measurement'),
  (SELECT confupdtype FROM pg_constraint WHERE conname='CarMoverJob_vehicleSubjectId_fkey');
SQL
