#!/usr/bin/env bash
set -euo pipefail

source_root=${1:-/opt/agm-field-test/current}
incoming_identities=${2:-/tmp/authorized-testers.safe.json}
expected_validation_tunnel=${3:-f4343acc-7303-4422-a10a-587a9dc96114}
field_root=/opt/agm-field-test
secret_root=$field_root/secrets
env_file=$secret_root/field.env
compose_file=$source_root/deploy/field-test/compose.field-test.yml
project=agm_field_validation
production_tunnel=1c7d88b4-f2bb-40bb-82b0-37da35ee30a9

[[ $(id -u) -eq 0 ]] || { echo ROOT_REQUIRED >&2;exit 1; }
[[ -f $compose_file && -f $incoming_identities ]] || { echo FIELD_INPUT_MISSING >&2;exit 1; }
[[ -f /etc/cloudflared/token ]] || { echo VALIDATION_TUNNEL_TOKEN_MISSING >&2;exit 1; }
actual_tunnel=$(python3 -c 'import base64,json;raw=open("/etc/cloudflared/token","rb").read().strip();print(json.loads(base64.b64decode(raw+b"===")).get("t",""))')
[[ $actual_tunnel == "$expected_validation_tunnel" ]] || { echo VALIDATION_TUNNEL_ID_MISMATCH >&2;exit 1; }
[[ $actual_tunnel != "$production_tunnel" ]] || { echo PRODUCTION_TUNNEL_REUSE_PROHIBITED >&2;exit 1; }
ss -lnt|awk '{print $4}'|grep -Eq '(^|:)3301$' && { echo FIELD_GATEWAY_PORT_IN_USE >&2;exit 1; }

install -d -m 0750 -o root -g root "$field_root" "$secret_root"
identities_json=$(python3 -c 'import json,sys;rows=json.load(open(sys.argv[1]));print(json.dumps(rows,separators=(",",":")))' "$incoming_identities")
postgres_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 48)
umask 077
{
  echo POSTGRES_USER=agm_field_validation
  echo "POSTGRES_PASSWORD=$postgres_password"
  echo POSTGRES_DB=agm_field_validation
  echo "JWT_SECRET=$jwt_secret"
  echo "FIELD_IDENTITIES_JSON=$identities_json"
} > "$env_file"
unset postgres_password jwt_secret identities_json
rm -f "$incoming_identities"
docker compose -p "$project" --env-file "$env_file" -f "$compose_file" config --quiet
docker compose -p "$project" --env-file "$env_file" -f "$compose_file" up -d --build --wait
docker compose -p "$project" --env-file "$env_file" -f "$compose_file" exec -T postgres sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$source_root/deploy/field-test/seed-field.sql"

cat >/etc/systemd/system/agm-field-validation-cloudflared.service <<'UNIT'
[Unit]
Description=AGM Field Validation Cloudflare connector
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStartPre=/usr/bin/test -f /etc/cloudflared/token
ExecStart=/usr/bin/cloudflared --no-autoupdate --config /opt/agm-field-test/current/deploy/field-test/cloudflared.field.yml tunnel run --token-file /etc/cloudflared/token
Restart=on-failure
RestartSec=5s
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now agm-field-validation-cloudflared.service

docker compose -p "$project" --env-file "$env_file" -f "$compose_file" ps
systemctl is-active agm-field-validation-cloudflared.service
curl --silent --output /dev/null --write-out 'blocked_path_status=%{http_code}\n' http://127.0.0.1:3301/api/v1/health/ready
curl --silent --output /dev/null --write-out 'unauthorized_protocol_status=%{http_code}\n' http://127.0.0.1:3301/api/v1/car-mover/routing/field-protocol
echo "FIELD_BACKEND_INSTALLED tunnel=$actual_tunnel port=3301 project=$project"
