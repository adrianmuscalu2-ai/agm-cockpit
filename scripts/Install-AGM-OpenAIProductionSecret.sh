#!/usr/bin/env bash
set -euo pipefail

secret_file=/opt/agm/production/secrets/agm-production.env
validation_file=/opt/agm/secrets/agm-validation.env
new_key=$(cat)
if [[ "$new_key" != sk-* ]]; then
  echo OPENAI_KEY_INPUT_INVALID >&2
  exit 1
fi

replace_key() {
  local file=$1 tmp
  tmp=$(mktemp "${file}.rotation.XXXXXX")
  awk -v key="$new_key" 'BEGIN{done=0} /^OPENAI_API_KEY=/{if(!done){print "OPENAI_API_KEY=" key;done=1}next} {print} END{if(!done)print "OPENAI_API_KEY=" key}' "$file" > "$tmp"
  chown root:root "$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$file"
}

replace_key "$secret_file"

if [[ -f "$validation_file" ]]; then
  tmp=$(mktemp "${validation_file}.rotation.XXXXXX")
  grep -v '^OPENAI_API_KEY=' "$validation_file" > "$tmp" || true
  chown root:root "$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$validation_file"
fi

for exposed in \
  /opt/agm/change-backups/credential-realignment-20260728T112451Z/agm-production.env.before \
  /opt/agm/change-backups/android-cors-20260728T153549Z/agm-production.env.before \
  /opt/agm/change-backups/credential-realignment-20260728T112600Z/agm-production.env.before \
  /opt/agm/production/backups/AGM-CHG-20260815-PREMIUM-WEB-LATENCY-R2/container.before.json \
  /opt/agm/production/backups/AGM-CHG-20260815-PREMIUM-WEB-SEARCH/container.before.json \
  /opt/agm/production/rollback/AGM-CHG-20260811-PREMIUM-VOICE/agm-production-api.before.inspect.json \
  /opt/agm/secrets/agm-validation.env.bak
do
  if [[ -f "$exposed" ]]; then
    shred -u "$exposed" 2>/dev/null || rm -f "$exposed"
  fi
done

unset new_key
echo SECRET_BOUNDARY_UPDATED
