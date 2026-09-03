# M2M authentication rescue journal

Status: `RECOVERED / HANDOFF TO ATLAS / FINAL PASS`

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
- First Production run `33769233819`: verify, API publish and Web publish PASS. The API container failed closed during readiness with `CANONICAL_LIBRARY_ROOT_NOT_FOUND`; the release script preserved its pre-release database backup and automatically rolled both services back.
- Classification: `DEFECT DE CONFIGURARE` in `deploy/cloud/api.Dockerfile`; the compiled loader was present but its three hash-pinned canonical inputs were absent from the image.
- Minimal recovery: copied only `canonical-sources.json`, `routing-toll.view.json` and `legislation-safety.view.json` into `/app/AGM_LIBRARY` during the image build. No loader fallback, hash relaxation or substitute data was introduced.
- Minimal retest: the exact Production Dockerfile built locally PASS and its build record shows all three canonical COPY stages followed by Prisma generation, copilot build and API build PASS. A requested ephemeral container hash command was not authorized by the execution approval service; no indirect workaround was attempted. The already accepted canonical hash tests cover the source bytes.
- Residual bounded action: publish the Docker image correction, repeat the Production deployment/readiness and canonical M2M lifecycle smoke, then record the Production result before granting FINAL PASS.

## Production continuation — run 33808053843

- Published revision: `a5bebeba7232d8c7b27a45e6477c950593692323`.
- Preserved PASS: verify, 345 API tests, API lint/build, Copilot build, Web build, canonical route, Browser preflight, controlled Wave 1 Browser, API image publish, Web image publish, Production deployment and readiness.
- Federated authority: GitHub Actions OIDC with exact repository, repository/owner IDs, Production environment, branch, workflow, event, runner and deployed-revision allowlist; no static provisioning token.
- Failure: the first `POST /api/v1/auth/deploy/machines` returned HTTP `503`; no machine identity was created and no cleanup residue exists.
- Affected component: Production OIDC provisioning boundary only. Published containers and readiness remain PASS.
- Candidate causes retained for evidence: missing container revision binding, GitHub JWKS reachability, or absent/ambiguous eligible Production tenant.
- Recovery decision: no unchanged retry. The smoke procedure now captures only the sanitized `{statusCode,message,error}` response on a non-201 provision result, sufficient to classify the fail-closed branch without exposing the OIDC token or client secret.
- Next minimal retest: publish the diagnostic-only workflow correction, rerun the protected Production job, and use the first provision response to recover only the confirmed cause.

## Confirmed cause — run 33810128359

- The sanitized response proved: `Production provisioning tenant binding is ambiguous or unavailable.`
- Revision binding and GitHub JWKS verification passed before the failing database lookup.
- Classification: `DEFECT DE CONFIGURARE / PRODUCT TENANT BINDING`.
- Canonical evidence: `prisma/seed/seed.ts` pins the AGM company to `00000000-0000-0000-0000-000000000001` and creates role `company_owner`; the read-only Production identity audit confirms this exact seeded tenant/role lineage.
- Defect: the OIDC resolver required global uniqueness across all eligible companies, and the M2M provisioning-role allowlist omitted the canonical lowercase `company_owner` code.
- Minimal recovery: pin OIDC provisioning to the canonical seeded company ID, require that exact company to remain active with an active owner, and add `company_owner` to the existing owner-role allowlist. No request-controlled company ID, first-row selection, database mutation, or authority relaxation is introduced.
- Next minimal retest: focused OIDC/service tests, API lint/build, then the protected Production lifecycle smoke on the corrected revision.

## Final Production recovery — run 33811781066

- Published revision: `b47d04d99a81034121894dd3aebcc8fdccdab89f`.
- Verify PASS: Prisma generation, Copilot build, API lint, all 345 API tests, API build, Web build, canonical route, Browser preflight and controlled Wave 1 Browser.
- Publish PASS: immutable API and Web images.
- Deploy PASS: approved Production lifecycle files, immutable digests, API/Web restart, image binding, database migration/readiness, protected-route checks and public canonical routes.
- A transient HTTP `502` occurred inside the bounded readiness retry loop; the same approved deploy attempt recovered automatically and completed without rollback.
- Production OIDC lifecycle PASS: exact GitHub claim allowlist, deployed-revision binding, canonical tenant binding, machine provision, client-credentials issuance, tenant-scoped registry read, caller-controlled subject/company rejection, rotation, old-secret rejection, new credential use, credential revocation, revoked-secret rejection and unknown-credential rejection.
- Terminal evidence: `M2M_PRODUCTION_LIFECYCLE=PASS` at `2026-09-03T22:17:31.2705280Z`.
- Cleanup evidence: the EXIT trap ran after the terminal marker with no HTTP/curl error before successful job completion; the temporary machine identity and its credentials were revoked.
- Independent post-release probes: `/api/v1/health/ready` HTTP `200` with database available and translation provider configured; `/api/v1/health/live` HTTP `200` with `agent-runtime-events.v1.3`.
- Static Production provisioning secret: not required and not introduced.
- Rescue verdict: `RECOVERED`.

## Handoff to Atlas — final

- Preserved PASS evidence remains valid.
- Residual release action: none.
- Production verdict: `FINAL PASS`.
