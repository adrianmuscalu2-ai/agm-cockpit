# Turn release pre-change checklist — 2026-10-28

Source procedure: `deploy/production/PRE_CHANGE_CHECKLIST.md`.

Legend: `VERIFIED` = observed locally; `MISSING` = required artifact/value absent; `TO APPROVE` = decision or acknowledgement required from the named authority; `PENDING` = can only be checked after an earlier gate is complete.

## Reusable Sunday baseline

The Sunday hard verification already covered Governance, Machine, Risk and the
implemented TURN controls. Evidence is preserved in
`AGM_SAFE_SHUTDOWN_20261026.md`, `AGM_SAFE_SHUTDOWN_20261026_MANIFEST.json`,
`evidence/browser-control/atlas-turn-modular-2026-10-26/` and
`evidence/browser-control/turn-isolated-ui-preview-2026-10-26/`. These checks
remain reusable because the only post-baseline functional delta is the spatial
model presentation and the `Înapoi sus` interaction. Do not repeat unchanged
Sunday checks without a documented change or failed evidence link.

| Requirement | Status | Evidence / action |
|---|---|---|
| Turn spatial preview renders HTTP 200 | VERIFIED | Controlled preview `127.0.0.1:5175` |
| Spatial models and back-to-top verified | VERIFIED | `RELEASE_SUMMARY.md`; Browser capture hash in manifest |
| Browser Plugin status | VERIFIED | Browser preflight |
| Integrated Browser status | VERIFIED limitation | IAB unavailable; controlled runner used per runbook |
| Controlled Browser session | VERIFIED | Playwright/Chromium probe |
| Target page | VERIFIED | Preview rendered and interacted |
| API/data/authentication isolation in preview | VERIFIED | 0 external requests; isolated Vite proxy configuration |
| Change ID and UTC window | MISSING / TO APPROVE | Must be supplied by Command Lead |
| Gate 6 final GO/READY for this execution window | PENDING | Historical Gate 6 report is not a current execution-window authorization |
| Separate deployment/routing mandate | MISSING / TO APPROVE | Required by checklist and workflow procedure |
| Command Lead identity and acknowledgement | IDENTITY FOUND / ACK PENDING | `turn-commander-adrian` from `AGM_COCKPIT_GOVERNANCE_REGISTER_V1_1.md`; current-window acknowledgement still required |
| Independent Validator identity/session | IDENTITY FOUND / SESSION+VERDICT PENDING | `agent-inspector` from operational routing; session must be distinct from executor |
| Fallback Responsible identity/acknowledgement | ROLE FOUND / ACK PENDING | `release-operations / PC Fallback Custodian` from `deploy/production/OPERATIONAL_ROLES.md` |
| Rollback Responsible identity/acknowledgement | ROLE FOUND / ACK PENDING | `Atlas/Codex Technical Executor` from `deploy/production/OPERATIONAL_ROLES.md` |
| STOP channel tested | MISSING | Must be recorded in change window |
| Candidate commit | MISSING | Candidate has current HEAD only; no release commit created |
| Clean worktree at release commit | MISSING | Local changes are intentionally preserved and uncommitted |
| Approved release ref | MISSING | Candidate has only local-path origin and feature branch |
| API/Web immutable OCI digests | MISSING | Exist only after approved workflow publish |
| API/Web revisions equal reviewed commit | PENDING | Requires candidate commit and workflow |
| API lint/tests/build | PENDING | Must run against the exact release commit |
| Web build | PENDING | Must run against the exact release commit |
| Security/secret dependency audits | PENDING | Must run against the exact release commit |
| `audit:wave1-browser` machine-readable evidence | PENDING | Must run against exact release commit |
| `audit:canonical-route` | PENDING | Must run against exact release commit |
| Gate 6A–6D checksum/role/data checks | PENDING | Must be attached to the execution window, not inferred from historical reports |

## Secret and Machine controls

| Requirement | Status | Evidence / action |
|---|---|---|
| Guardian identity and dual-authorization record | MISSING / TO APPROVE | Secret & Credentials Guardian must be named and acknowledge the window |
| Guardian sole-custodian boundary | VERIFIED AS DOCUMENTED | `deploy/production/OPERATIONAL_ROLES.md`; Guardian may validate metadata but not expose secret values |
| Guardian secret status contract | VERIFIED AS DOCUMENTED | `apps/api/src/secret-telemetry/secret-telemetry.contract.ts` |
| Guardian metadata-only implementation | VERIFIED AS DOCUMENTED | `apps/api/src/secret-telemetry/secret-telemetry.service.ts` |
| Production secret values in release evidence | VERIFIED ABSENT LOCALLY | No secret values were read, copied or added to this dossier |
| Current Production secret telemetry snapshot | MISSING | Historical local metadata-only PASS exists, but current protected snapshot must be supplied by Secret & Credentials Guardian / Release & Operations; do not paste secret values |
| Machine candidate implementation | VERIFIED AS MANDATE SCOPE | Reimplemented in this candidate mandate; verify source/tests before release |
| Machine scope exactly `acp:read` | VERIFIED AS CONTRACT | `apps/api/src/machine-auth/machine-auth.contract.ts`; runtime proof still missing |
| Machine company-bound read-only route check | VERIFIED AS CODE / POST-DEPLOY PENDING | `machine-authority.controller.ts`; Production runtime proof belongs to post-deploy validation |
| Machine credential expiry/revocation evidence | POST-DEPLOY PENDING | Candidate implementation is in mandate scope; Production state is checked after deployment by Release & Operations |
| Machine audit/event correlation evidence | POST-DEPLOY PENDING | Connected-Turn Production correlation is checked after deployment and independently validated |
| Independent Validator review of Guardian/Machine evidence | TO APPROVE | Separate validator acknowledgement required |

Guardian/Machine controls do not replace Command Lead authorization, Independent Validator approval or release-executor responsibility.

## Evidence references found (metadata/configuration/tests only)

| Control | Exact reference | Verified finding | Limitation |
|---|---|---|---|
| Guardian | `evidence/governance/modules/SEC-TELEMETRY/v1.0/RESTORATION_REPORT_2026-08-05.md` | Local implementation/test PASS; redacted metadata-only output; no secret values/tokens/credentials in report | Public/Hetzner telemetry explicitly FAIL/NOT OPERATIONAL |
| Guardian | `AGM_P0_RECOVERY_COVERAGE_20261024.txt` | Metadata connection restored; values/tokens/passwords/keys not returned | Runtime custody/rotation history NOT PROVEN; automatic failover unrelated and not tested |
| Guardian | `apps/api/test/secret-telemetry.service.spec.ts` | Status transitions and anti-exposure assertions are specified | Test source is not current Production execution evidence |
| Guardian | `apps/web/scripts/test-secret-telemetry-integration.ts` | Redacted rendering and Incident Journal reconciliation assertions are specified | Test source is not current Production execution evidence |
| Machine | `evidence/m2m-auth/2026-09-03/VALIDATION_REPORT.json` | `acp:read`; negative tests and lifecycle audit PASS; raw secret not persisted/audited | Production lifecycle smoke and final pass are PENDING |
| Machine | `evidence/m2m-auth/2026-09-03/RESCUE_JOURNAL.md` | Hashed persistence, guarded use, rotation, revocation and audit events recorded | Historical Production attempt rolled back; current proof still required |

The current release retains `MISSING` only for current Guardian telemetry/custody and other explicitly listed release approvals. Machine is implemented in this mandate; its source/test verification is pre-deploy and its Production runtime evidence is a post-deploy gate. Historical Machine evidence remains supporting context only.

Any `MISSING` mandatory item is an automatic NO-GO under the source checklist.
