# ROUTING-TOLL-001 — Final consolidated completion report

Status: `FINAL PRE-APPLY PACKAGE = PASS / READY FOR PRODUCT OWNER APPLY REVIEW`.

## Completion summary

- Source freshness / expiry / supersession rule: `READY FOR OWNER REVIEW`.
- API build: `PASS`; contract tests: `16/16 PASS`; freshness validator: `44/44 PASS`.
- Product Owner email recipients: `PASS` for two locally configured recipients; sender: `PASS`.
- Email delivery gate: `BLOCKED_CONFIGURATION_REQUIRED` for email delivery only. No controlled send was executed because Gmail authentication is absent. The exact missing dependency is either `GMAIL_ACCESS_TOKEN` or the complete OAuth client ID, client secret, and refresh token set, supplied only through the existing secret/configuration mechanism.
- CH vignette recapture: `PASS`; blocker `RESOLVED`; apply condition `SATISFIED`. Official scope is vehicles up to 3.5 tonnes, price CHF 40, validity 2025-12-01 through 2027-01-31.
- Authority decisions reconciled: `10/10 APPROVE`, `0 REJECT`, `0 DEFER`, `0 PENDING`; classifications `9 AUTHORITATIVE_WITH_SCOPE + 1 CONTEXTUAL`.
- Final read-only gate: `59/59 PASS`.
- Dedup, validator idempotence and deterministic package regeneration: `PASS`.

## Exact informational atomic impact

- Operations: `ADD 10 / MODIFY 0 / DELETE 0`.
- Registry: `831 -> 841`; projected SHA-256 `462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076`.
- Routing/Toll view: `279 -> 289`; unique content hashes `264 -> 274`; projected SHA-256 `049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0`.
- New SourceId collisions: `0`; canonical URI duplicates introduced: `0`; primary SHA-256 duplicates introduced: `0`.
- Existing Registry sources modified: `0`; existing view memberships modified: `0`.

NL remains restricted to 2026-07-01 through 2026-08-31. After that inclusive window the artifact is not current and dependent use is `EXPIRED_REVIEW_REQUIRED / UNKNOWN_HUMAN_VERIFICATION`. DK Q3 2026 remains a freshness trigger and does not extend version 1.2 automatically.

## Guardrails

Registry mutation: `NONE`. Routing/Toll view mutation: `NONE`. Authority promotion: `NONE`. Runtime/Production: `NO CHANGE`. Atomic apply: `NOT EXECUTED`. Commit/push: `NOT EXECUTED`.

Atomic apply still requires a separate explicit Product Owner mandate.
