#!/usr/bin/env bash
set -euo pipefail

archive_path=${1:-/tmp/agm-cloud-stage3-source.tar.gz}
source_env_path=${2:-/tmp/agm-local-source.env}
app_root=/opt/agm/app
secret_root=/opt/agm/secrets
backup_root=/opt/agm/backups
validation_env=$secret_root/agm-validation.env

if [[ ! -f "$archive_path" ]]; then
  echo "Source archive not found: $archive_path" >&2
  exit 1
fi

if [[ ! -f "$source_env_path" ]]; then
  echo "Temporary source environment not found: $source_env_path" >&2
  exit 1
fi

if [[ -e "$app_root" || -e "$validation_env" ]]; then
  echo "Validation deployment already exists; refusing to overwrite." >&2
  exit 1
fi

read_env_value() {
  local key=$1
  sed -n "s/^${key}=//p" "$source_env_path" | tail -n 1
}

openai_api_key=$(read_env_value OPENAI_API_KEY)

if [[ -z "$openai_api_key" ]]; then
  echo "OPENAI_API_KEY is missing from the temporary source environment." >&2
  exit 1
fi

postgres_password=$(openssl rand -hex 32)
jwt_secret=$(openssl rand -hex 48)

install -d -m 0750 -o root -g root /opt/agm "$app_root" "$secret_root" "$backup_root"
tar -xzf "$archive_path" -C "$app_root"

umask 077
{
  printf 'POSTGRES_USER=%s\n' 'agm_validation'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf 'POSTGRES_DB=%s\n' 'agm_validation'
  printf 'NODE_ENV=%s\n' 'production'
  printf 'PORT=%s\n' '3000'
  printf 'API_HOST=%s\n' '0.0.0.0'
  printf 'TRUST_PROXY_HOPS=%s\n' '1'
  printf 'CORS_ALLOWED_ORIGINS=%s\n' 'https://localhost'
  printf 'JWT_SECRET=%s\n' "$jwt_secret"
  printf 'JWT_EXPIRES_IN=%s\n' '1h'
  printf 'OPENAI_API_KEY=%s\n' "$openai_api_key"
  printf 'OPENAI_TRANSLATION_MODEL=%s\n' 'gpt-4.1-mini'
  printf 'OPENAI_TRANSLATION_TIMEOUT_MS=%s\n' '20000'
} > "$validation_env"

chown -R root:root /opt/agm
chmod 0750 /opt/agm "$app_root" "$secret_root" "$backup_root"
chmod 0600 "$validation_env"

rm -f "$source_env_path"

sha256sum "$archive_path"
printf 'Validation app prepared at %s\n' "$app_root"
printf 'Validation secrets prepared at %s\n' "$validation_env"
