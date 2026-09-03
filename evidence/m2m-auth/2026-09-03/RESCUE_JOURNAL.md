# M2M authentication rescue journal

Status: `RECOVERED / HANDOFF TO ATLAS`

## Blocker

- Failure: `EPERM rename query_engine-windows.dll.node` during Prisma Client generation.
- Affected component: local Prisma Client 5.22.0 generation and DB validation.
- Lock owner: AGM API Node process PID `9392`, listening on port `3000`, launched by the `AGM Services` scheduled supervisor.
- Prohibited scope: no forced process termination; no unsynchronized Prisma Client; no HMAC or local-token substitute.
- Preserved evidence: all earlier accepted product evidence remained unchanged.

## Recovery attempts

1. `Get-NetTCPConnection` ownership gate: denied before mutation; no process stopped.
2. `Stop-Process` normal and elevated: Windows access denied; no process stopped.
3. Scheduled-task managed stop with atomic restore: supervisor task restored, detached API child remained active; no force used.
4. `taskkill /T` without `/F`: Windows confirmed the process could only be terminated forcefully; attempt stopped per mandate.
5. Prisma binary-engine generation: initial download blocked by sandbox network policy.
6. Same official Prisma 5.22.0 binary generation with approved network access: PASS; generated client contains `MachineIdentity` and `MachineCredential` delegates.
7. Prisma binary runtime DB probe: engine executable started but did not complete its local HTTP handshake on this Windows host.
8. Minimal approved alternate: generated a temporary library-engine client from the identical schema in an isolated, unlocked output; full DB lifecycle probe PASS; temporary generator routing was removed from the canonical schema afterward.
9. Isolated release worktree after local/remote merge: standard Prisma library client generation and the full DB lifecycle probe both PASS without the alternate generator route.

## Minimal retest evidence

- `prisma validate`: PASS.
- `prisma migrate deploy`: PASS for `20260903040000_add_machine_identity` (and the prior pending additive migration).
- `prisma migrate status`: 22 migrations, database schema up to date.
- DB lifecycle: provisioning, hashed-secret persistence, issuance, guarded use, rotation, old-secret rejection, credential revocation, new-secret rejection, identity revocation and cleanup all PASS.
- Audit actions observed: `M2M_IDENTITY_PROVISIONED`, `M2M_TOKEN_ISSUED`, `M2M_CREDENTIAL_USED`, `M2M_CREDENTIAL_ROTATED`, `M2M_CREDENTIAL_REVOKED`, `M2M_IDENTITY_REVOKED`.
- No raw client secret was persisted or present in audit payloads.

## Browser recovery

- First controlled run failed only because the runner expected the retired title substring `A.G.M.` while the committed canonical title is `AGM Transporte`.
- Classified as procedure/governance test drift; the runner assertion was corrected to the exact canonical title.
- Mandatory preflight rerun: PASS with IAB recorded as optional platform limitation.
- Minimal controlled Chromium retest: PASS, preserved report `evidence/m2m-auth/2026-09-03/browser-report.json`.

## Handoff to Atlas

- Recovered capabilities: Prisma generation, schema/migration validation, DB lifecycle validation, Browser release evidence.
- Preserved verdicts: all 330 API tests, builds, lint and existing accepted evidence.
- Residual bounded action: publish the isolated M2M release, wait for the Production workflow, then record the Production lifecycle smoke result before granting FINAL PASS.
