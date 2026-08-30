#!/usr/bin/env bash
set -euo pipefail
field_root=/opt/agm-field-test
source_root=${1:-$field_root/current}
env_file=$field_root/secrets/field.env
compose_file=$source_root/deploy/field-test/compose.field-test.yml
systemctl disable --now agm-field-validation-cloudflared.service 2>/dev/null || true
rm -f /etc/systemd/system/agm-field-validation-cloudflared.service
systemctl daemon-reload
docker compose -p agm_field_validation --env-file "$env_file" -f "$compose_file" down
echo 'FIELD_BACKEND_STOPPED_DATA_VOLUME_PRESERVED=true'
