#!/usr/bin/env bash
set -euo pipefail
categories=(expiredAuthSessions revokedAuthSessions completedDsarRecords generatedDsarExports postgresBackups suppressionLedgerEntries identifierAuditLogs)
activated=()
stop() { trap - ERR;for category in "${activated[@]}";do systemctl disable --now "agm-retention-${category}.timer" >/dev/null 2>&1||true;done;printf 'RETENTION_ACTIVATION_STOP activated_timers_disabled=%s deletion_reversal_claimed=false\n' "${#activated[@]}" >&2;exit 1; }
trap stop ERR
for category in "${categories[@]}";do
  printf 'SUPERVISED_START category=%s\n' "$category"
  systemctl start "agm-retention@${category}.service"
  test "$(systemctl show "agm-retention@${category}.service" -p Result --value)" = success
  journalctl -u "agm-retention@${category}.service" -n 5 --no-pager -o cat | grep 'RETENTION_CATEGORY_PASS'
  systemctl enable --now "agm-retention-${category}.timer" >/dev/null
  test "$(systemctl is-enabled "agm-retention-${category}.timer")" = enabled
  test "$(systemctl is-active "agm-retention-${category}.timer")" = active
  activated+=("$category")
  printf 'SUPERVISED_PASS category=%s timer=ENABLED\n' "$category"
done
trap - ERR
printf 'RETENTION_CONTROLLED_ACTIVATION=PASS categories=%s\n' "${#activated[@]}"
