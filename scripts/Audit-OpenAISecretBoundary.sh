#!/usr/bin/env bash
set -euo pipefail

fingerprint_env_file() {
  local file=$1
  printf '%s: ' "$file"
  if [[ ! -f "$file" ]]; then echo MISSING; return; fi
  local value
  value=$(sed -n 's/^OPENAI_API_KEY=//p' "$file" | tail -n 1)
  if [[ -z "$value" ]]; then echo ABSENT; return; fi
  printf '%s' "$value" | sha256sum | cut -c1-16
}

fingerprint_env_file /opt/agm/production/secrets/agm-production.env
fingerprint_env_file /opt/agm/secrets/agm-validation.env
fingerprint_env_file /opt/agm/app/docker-compose.env

printf 'container: '
container_value=$(docker inspect agm-production-api --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | sed -n 's/^OPENAI_API_KEY=//p' | tail -n 1 || true)
if [[ -z "$container_value" ]]; then
  echo ABSENT
else
  printf '%s' "$container_value" | sha256sum | cut -c1-16
fi

printf 'candidate_logs_exact_key_lines: '
count=0
for log in /opt/agm/app/*.log; do
  [[ -f "$log" ]] || continue
  matches=$(grep -cE 'sk-(proj-)?[A-Za-z0-9_-]{20,}' "$log" 2>/dev/null || true)
  count=$((count + matches))
done
echo "$count"

old_key=$(sed -n 's/^OPENAI_API_KEY=//p' /opt/agm/production/secrets/agm-production.env | tail -n 1)
printf 'host_exact_occurrences:\n'
while IFS= read -r -d '' file; do
  if grep -aFql -- "$old_key" "$file" 2>/dev/null; then
    printf '%s\n' "$file"
  fi
done < <(find /opt/agm -type f -size -500M -print0 2>/dev/null)

printf 'docker_image_config_key_count: '
image_count=0
while IFS= read -r image; do
  [[ -n "$image" ]] || continue
  matches=$(docker image inspect "$image" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -aFc -- "$old_key" || true)
  image_count=$((image_count + matches))
done < <(docker image ls -q | sort -u)
echo "$image_count"

unset old_key container_value value
