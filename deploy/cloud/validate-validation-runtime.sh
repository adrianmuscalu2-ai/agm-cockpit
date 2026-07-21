#!/usr/bin/env bash
set -euo pipefail

compose_file="/opt/agm/app/deploy/cloud/compose.validation.yml"
env_file="/opt/agm/secrets/agm-validation.env"

echo "TRANSLATION_RESPONSE"
curl \
  --fail \
  --silent \
  --show-error \
  --max-time 30 \
  --header "Content-Type: application/json" \
  --data '{"text":"Validare AGM Cloud fara trafic public.","sourceLanguage":"ro","targetLanguage":"de"}' \
  "http://127.0.0.1:3000/api/v1/translation/actions/translate-text"
echo

echo "LISTENERS"
sudo ss -lntp | grep -E '(:22 |127\.0\.0\.1:3000|:5432)' || true

echo "RESOURCES"
sudo docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}'

echo "COMPOSE_STATUS"
sudo docker compose \
  --project-directory /opt/agm/app \
  --env-file "$env_file" \
  --file "$compose_file" \
  ps

echo "CLOUDFLARED_SERVICE"
systemctl is-enabled cloudflared 2>/dev/null || true
systemctl is-active cloudflared 2>/dev/null || true
