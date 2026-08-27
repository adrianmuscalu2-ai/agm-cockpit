#!/usr/bin/env bash
set -euo pipefail
categories=(expiredAuthSessions revokedAuthSessions completedDsarRecords generatedDsarExports postgresBackups suppressionLedgerEntries identifierAuditLogs)
for category in "${categories[@]}";do
  timer="/etc/systemd/system/agm-retention-${category}.timer"
  [[ -e "$timer" ]]||continue
  test "$(realpath "$timer")" = "$timer"
  systemctl disable --now "$(basename "$timer")" >/dev/null 2>&1||true
  rm -f -- "$timer"
done
test "$(realpath /etc/systemd/system/agm-retention@.service)" = /etc/systemd/system/agm-retention@.service
test "$(realpath /usr/local/sbin/agm-retention-category)" = /usr/local/sbin/agm-retention-category
rm -f -- /etc/systemd/system/agm-retention@.service /usr/local/sbin/agm-retention-category
systemctl daemon-reload
printf 'RETENTION_SCHEDULER_ROLLBACK=PASS deletion_reversal_claimed=false evidence_preserved=true\n'
