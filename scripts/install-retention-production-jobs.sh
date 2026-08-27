#!/usr/bin/env bash
set -euo pipefail
readonly archive='/tmp/agm-retention-production-jobs.tar.gz'
readonly archive_sha='c87661b42117504f47e085c5c28d7a7610d21156b0bb624e5e4902095b2d1042'
readonly release='/opt/agm/production/releases/AGM-CHG-20260816-RETENTION-ACTIVATION-01'
readonly target='/opt/agm/production/retention'

printf '%s  %s\n' "$archive_sha" "$archive" | sha256sum -c -
install -d -o root -g root -m 0750 "$release" "$target"
tar -xzf "$archive" -C "$release"
install -o root -g root -m 0755 "$release/deploy/production/retention/run-retention-category.sh" /usr/local/sbin/agm-retention-category
install -o root -g root -m 0644 "$release/config/retention-policy.production-authorized.json" "$target/retention-policy.production-authorized.json"
install -o root -g root -m 0644 "$release/deploy/production/retention/retention-file-category.mjs" "$target/retention-file-category.mjs"
install -d -o root -g root -m 0700 "$target/evidence"
install -o root -g root -m 0644 "$release/deploy/production/retention/agm-retention@.service" /etc/systemd/system/agm-retention@.service
for timer in "$release"/deploy/production/retention/agm-retention-*.timer;do install -o root -g root -m 0644 "$timer" "/etc/systemd/system/$(basename "$timer")";done
systemd-analyze verify /etc/systemd/system/agm-retention@.service /etc/systemd/system/agm-retention-*.timer
systemctl daemon-reload
for timer in /etc/systemd/system/agm-retention-*.timer;do test "$(systemctl is-enabled "$(basename "$timer")" 2>/dev/null||true)" = disabled;done
printf 'RETENTION_JOB_INSTALL=PASS schedulers_enabled=0\n'
