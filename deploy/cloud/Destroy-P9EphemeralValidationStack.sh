#!/usr/bin/env bash
set -euo pipefail
project=agm_p9_validation_20260815_002
root=/opt/agm/ephemeral/$project
[[ $(id -u) -eq 0 ]] || { echo ROOT_REQUIRED >&2; exit 1; }
[[ -f $root/compose.yml && -f $root/validation.env ]] || { echo EPHEMERAL_STACK_CONTRACT_MISSING >&2; exit 1; }
docker compose -p "$project" --env-file "$root/validation.env" -f "$root/compose.yml" down --volumes --remove-orphans
rm -f "$root/validation.env"
printf '%s\n' "EPHEMERAL_STACK_DESTROYED project=$project"
