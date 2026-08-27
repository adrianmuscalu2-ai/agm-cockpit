#!/usr/bin/env bash
set -euo pipefail
categories=(expiredAuthSessions revokedAuthSessions completedDsarRecords generatedDsarExports postgresBackups suppressionLedgerEntries identifierAuditLogs)
enabled=()
stop() { trap - ERR;for category in "${enabled[@]}";do systemctl disable --now "agm-retention-${category}.timer" >/dev/null 2>&1||true;done;printf 'TIMER_ENABLE_STOP disabled=%s\n' "${#enabled[@]}" >&2;exit 1; }
trap stop ERR
for category in "${categories[@]}";do
  proof="$(find /opt/agm/production/retention/evidence -maxdepth 1 -type f -name "*-${category}.jsonl" -printf '%T@ %p\n'|sort -rn|awk 'NR==1{print $2}')"
  [[ -n "$proof" ]]
  grep -q '"state":"COMPLETED"' "$proof"
  grep -q '"unclassified":0' "$proof"
  systemctl enable --now "agm-retention-${category}.timer" >/dev/null
  test "$(systemctl is-enabled "agm-retention-${category}.timer")" = enabled
  test "$(systemctl is-active "agm-retention-${category}.timer")" = active
  enabled+=("$category")
  printf 'TIMER_ENABLE_PASS category=%s proof=%s\n' "$category" "$(basename "$proof")"
done
trap - ERR
printf 'RETENTION_TIMERS_ENABLED=%s\n' "${#enabled[@]}"
