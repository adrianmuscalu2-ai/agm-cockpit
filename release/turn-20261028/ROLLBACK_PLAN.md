# Turn release rollback plan

This is a preparation artifact only. No rollback action was executed.

## Governing sources

- `deploy/production/ROLLBACK_RUNBOOK.md`
- `deploy/production/POST_DEPLOYMENT_CHECKLIST.md`
- `deploy/production/OPERATIONAL_ROLES.md`
- `.github/workflows/production-release.yml`

## Required rollback identity separation

- Command Lead authorizes rollback and declares the operational verdict.
- Independent Validator observes and validates evidence; does not execute rollback.
- Rollback Responsible executes only the approved rollback commands.
- Fallback Responsible confirms fallback health and route/data readiness.

Names, sessions, acknowledgements and the approved window are intentionally absent until supplied.

## Workflow-defined safety controls

The production workflow is expected to preserve release files and database backup under a run-specific rollback root, install only approved lifecycle files, verify immutable API/Web image identities, test API readiness, verify internal/public routes and invoke its defined rollback handler on deployment failure.

The exact workflow run, image digests, rollback root and backup checksum must be recorded after an approved run. They cannot be invented in this dossier.

## Stop conditions

Stop before or during deployment on any mismatch in commit, image digest, compose/service identity, health/readiness, database/migration result, route, authentication, CORS or Browser evidence. Do not attempt ad-hoc repair or bypass a failed gate.

## Secret and Machine rollback boundaries

- Secret & Credentials Guardian remains the sole Production-secret custodian during rollback. The executor must not read, print, copy, rotate or revoke secret material unless the separate Guardian workflow and Turn authorization explicitly cover that action.
- Rollback evidence must contain only metadata: secret status (`CONFIGURED`, `MISSING`, `INVALID` or `ROTATION REQUIRED`), provider/dependent service, timestamp, incident reference and safe configuration reference. Raw secret values, JWTs, client secrets and credential material are prohibited.
- Machine access remains constrained to the `m2m-client-credentials.v1` contract and `acp:read`. A rollback must verify active identity, company binding, credential status/expiry/revocation and audit correlation without recording the client secret or token.
- If a Machine credential must be rotated or revoked, that is a separate authorized Machine provisioning action, not an implicit rollback step. Record its safe event reference and obtain Guardian/Command authorization before execution.
- Independent Validator validates the metadata and control evidence; it does not become a secret custodian. Command Lead authorizes the change/rollback; the release executor only runs the approved workflow.

## Post-deploy rollback evidence required

- exact failed stage and command output;
- API/Web service and container identity;
- backup and checksum evidence;
- restored route/health/ready evidence;
- Independent Validator verdict;
- Command Lead closure decision.
