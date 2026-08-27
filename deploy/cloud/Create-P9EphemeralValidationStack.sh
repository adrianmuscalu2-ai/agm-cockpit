#!/usr/bin/env bash
set -euo pipefail
project=agm_p9_validation_20260815_002
root=/opt/agm/ephemeral/$project
compose=$root/compose.yml
envfile=$root/validation.env
port=3310
[[ $(id -u) -eq 0 ]] || { echo ROOT_REQUIRED >&2; exit 1; }
ss -lnt | awk '{print $4}' | grep -Eq "(^|:)${port}$" && { echo VALIDATION_PORT_IN_USE >&2; exit 1; }
[[ ! -e $root ]] || { echo EPHEMERAL_PROJECT_ALREADY_EXISTS >&2; exit 1; }
install -d -m 0700 "$root" "$root/evidence"
install -m 0600 /tmp/compose.p9-ephemeral.yml "$compose"
postgres_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 48)
umask 077
{
  echo POSTGRES_USER=agm_p9_validation
  echo "POSTGRES_PASSWORD=$postgres_password"
  echo POSTGRES_DB=agm_p9_validation
  echo "JWT_SECRET=$jwt_secret"
  echo VALIDATION_PORT=$port
} > "$envfile"
unset postgres_password jwt_secret
docker compose -p "$project" --env-file "$envfile" -f "$compose" config --quiet
docker compose -p "$project" --env-file "$envfile" -f "$compose" up -d --wait
docker compose -p "$project" --env-file "$envfile" -f "$compose" ps --format json > "$root/evidence/stack-after-start.json"
docker network inspect "${project}_validation_internal" --format '{{json .}}' > "$root/evidence/network.json"
docker volume inspect "${project}_postgres_data" --format '{{json .}}' > "$root/evidence/volume.json"
curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${port}/api/v1/health/ready" > "$root/evidence/readiness.json"
printf '%s\n' "EPHEMERAL_STACK_READY project=$project port=$port root=$root"
