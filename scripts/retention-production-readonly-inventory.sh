#!/usr/bin/env bash
set -euo pipefail

printf 'RETENTION_UNITS\n'
systemctl list-unit-files --no-pager --no-legend \
  | awk 'tolower($1) ~ /retention|lifecycle/ {print $1, $2}'

printf 'API_ENV_NAMES\n'
docker inspect agm-production-api --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | sed 's/=.*//' \
  | grep -E '^(RETENTION|DSAR|POSTGRES_BACKUP)' || true

printf 'API_MOUNTS\n'
docker inspect agm-production-api --format '{{range .Mounts}}{{println .Destination}}{{end}}'

printf 'BACKUP_UNIT\n'
systemctl show agm-postgres-backup.service -p Environment --value \
  | sed -E 's/(=[^ ]]+)/=<masked>/g'

printf 'PATH_TYPES\n'
for path in /opt/agm/backups/daily /opt/agm/production /var/log; do
  if [[ -e "$path" ]]; then
    stat -c '%n type=%F mode=%a' "$path"
  else
    printf '%s MISSING\n' "$path"
  fi
done
