#!/usr/bin/env bash
set -euo pipefail
docker exec -i agm-postgres sh -lc \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT json_build_object(
  'transaction_read_only', current_setting('transaction_read_only'),
  'tables', COALESCE(json_agg(table_name ORDER BY table_name), '[]'::json)
)
FROM information_schema.tables
WHERE table_schema='public'
  AND (table_name ILIKE '%session%' OR table_name ILIKE '%subject%request%' OR table_name ILIKE '%audit%');
ROLLBACK;
SQL
