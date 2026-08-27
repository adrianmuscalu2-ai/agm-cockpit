# AGM_MAJOR_INCIDENT_REGISTER

## Incident

- Incident ID: AGM-INC-2026-08-LTE-AUTH
- Severity: MAJOR
- Started: 2026-08-20 (exact start timestamp not preserved in the current session)
- Functional closure: PASS reported by Product Owner; physical LTE evidence is not available in this session's final record.
- Services affected: Android WebView authentication/session, Production API release path, CI verification.
- Initial symptom: backend-dependent Android functions failed on mobile data while UI navigation remained available.
- User impact: login/session-dependent functionality unavailable on LTE.
- Known-good baseline: APK 1.3.0 / versionCode 16 and the 16 August operating baseline.

## Demonstrated causes and regressions

- Duplicate PC `cloudflared` fallback competed with the Hetzner Production connector.
- Cross-site refresh cookie used `SameSite=Lax`; Android WebView required `SameSite=None; Secure`.
- Android WebView third-party cookies were not explicitly enabled.
- Control-plane/connector availability was not reproducibly bootstrapped in the current session.
- `.git` ACL/index metadata blocked controlled commits until repaired.
- The remote repository initially lacked the canonical AGM source and release workflow.
- CI failures included pnpm setup conflict, migration-contract drift, missing restore-gate source, missing test environment variables, and concurrent rate-limit test resets.

## Permanent changes

- Refresh cookie contract changed to `SameSite=None; Secure`.
- Android WebView third-party cookies explicitly enabled.
- Canonical source commit: `1bdbfd9`.
- OCI release workflow commits: `6b34756`, `795355f`, `5f30538`, `edddb41`, `6ad2231`.
- Rate-limit test stabilization commit: `7f8e0f0`.
- Final Android duplicate-plugin cleanup was rebuilt locally but not recorded as a release commit in this register.

## Manual actions required

- Windows `.git` ACL/index repair.
- Disable and terminate duplicate PC `cloudflared` fallback.
- Restore GitHub repository binding and canonical branch publication.
- Configure Production environment secrets through the authorized secret channel.
- Physical APK installation and LTE validation.

## Prevention actions

| Action | Owner | Due | Status |
|---|---|---:|---|
| Startup connector self-check and duplicate-fallback alert | Release & Operations | TBD | OPEN |
| Control-plane registry/binding/Guardian health contract | Turn / Guardian | TBD | OPEN |
| Release runner and rollback dry-run after restart/new session | Release & Operations | TBD | OPEN |
| Git metadata writability and ACL preflight | Engineering | TBD | OPEN |
| Workflow/environment/secrets binding preflight without value exposure | Release & Operations | TBD | OPEN |
| Independent validator for OCI digest and deploy state | Validator | TBD | OPEN |
| Connector recovery and bootstrap automation | Turn / Platform | TBD | OPEN |

## Evidence

- API auth test: 15/15 PASS.
- Final local API test suite: 40 suites / 207 tests PASS with CI-only environment variables.
- Android build: PASS.
- Canonical branch: `agm-canonical-20260820`.
- Production health and migration evidence exists in prior operational records; workflow-run IDs were not available through the current connector.

## Verdicts

FINAL INCIDENT VERDICT = PASS

POST-INCIDENT AUTOMATION RESTORATION = OPEN

The incident is functionally closed, but automation restoration is not marked complete until connector, Guardian, Release, validator, restart recovery, rollback, and dry-run evidence are independently demonstrated end-to-end.

