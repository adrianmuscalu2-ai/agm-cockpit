#!/usr/bin/env bash
set -euo pipefail
umask 077

fail(){ printf 'AGM_DSAR_RESTORE status=failed reason=%s\n' "$1" >&2; exit 1; }
for name in AGM_RESTORE_DUMP AGM_RESTORE_DATABASE_URL AGM_RESTORE_GATE_PATH DSAR_SUPPRESSION_LEDGER_PATH DSAR_SUPPRESSION_LEDGER_KEY; do [[ -n "${!name:-}" ]]||fail "${name}_required"; done
[[ -f "$AGM_RESTORE_DUMP" ]]||fail dump_missing
[[ -f "$DSAR_SUPPRESSION_LEDGER_PATH" ]]||fail ledger_missing
gate_dir="$(dirname "$AGM_RESTORE_GATE_PATH")";install -d -m 0700 "$gate_dir"
printf '{"status":"BLOCKED","reason":"RESTORE_SUPPRESSION_NOT_VERIFIED"}\n' >"$AGM_RESTORE_GATE_PATH";chmod 0600 "$AGM_RESTORE_GATE_PATH"
pg_restore --list "$AGM_RESTORE_DUMP" >/dev/null||fail dump_invalid
pg_restore --dbname "$AGM_RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges --exit-on-error "$AGM_RESTORE_DUMP"
DATABASE_URL="$AGM_RESTORE_DATABASE_URL" DSAR_SUPPRESSION_PROOF_PATH="${AGM_RESTORE_GATE_PATH}.proof" pnpm --dir apps/api exec ts-node scripts/apply-restore-suppressions.ts||fail suppression_apply_failed
proof_hash="$(sha256sum "${AGM_RESTORE_GATE_PATH}.proof"|awk '{print $1}')"
printf '{"status":"PASS","proofSha256":"%s"}\n' "$proof_hash" >"${AGM_RESTORE_GATE_PATH}.tmp";chmod 0600 "${AGM_RESTORE_GATE_PATH}.tmp";mv "${AGM_RESTORE_GATE_PATH}.tmp" "$AGM_RESTORE_GATE_PATH"
printf 'AGM_DSAR_RESTORE status=success gate=PASS proof_sha256=%s\n' "$proof_hash"
