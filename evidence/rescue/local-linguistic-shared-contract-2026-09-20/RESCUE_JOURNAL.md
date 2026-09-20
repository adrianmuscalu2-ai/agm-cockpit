# Local linguistic shared-contract remediation journal

Date: 2026-09-20
Checkout: `workspace-linguist-runtime-rebind`
Production freeze: ACTIVE throughout
Production mutations: NONE
Git commit/push/workflow rerun/deploy: NONE

## Classification

Root cause: PRODUCT / duplicated Web-API contract. Web emitted current catalog
components while the API validator retained a stale total literal. The previous
local candidate that checked only internal arithmetic was rejected because an
internally consistent but non-canonical payload could still pass.

## Remediation

- Added versioned contract `agm.linguistic-resource-counts.v1` in `@agm/shared`.
- Canonical components exist once: `app`, `operational`, `carMover`, `premium`.
- Total is derived by `deriveLinguisticResourceTotal`; it is never a contract literal.
- Canonical serialization is bound to digest
  `sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1`.
- Web formats heartbeat evidence through the shared contract.
- API validates version, digest, canonical components, derived total and zero errors.
- API/Web build definitions and Production image build contexts include `@agm/shared`.
- No mandate, authority, TURN session, security or independent-validation rule changed.

## Integration evidence

Test: `apps/api/test/linguistic-web-api.integration.spec.ts`

Positive path for IT, ES and SV:

`real Web formatter -> API duty runner -> AGENT_OPERATIONAL_DUTY_COMPLETED -> AgentRuntimeEvent COMPLETED -> AGENT_ACCOUNTABILITY_VALIDATED/PASS`

Negative path:

`real Web formatter -> deliberately corrupted total -> LINGUISTIC_CATALOG_VALIDATION_FAILED -> AGENT_OPERATIONAL_DUTY_FAILED -> AgentRuntimeEvent FAILED -> no independent validation receipt`

## Validation results

- `pnpm --filter @agm/shared build`: PASS.
- Focused API suites: 4 suites / 11 tests PASS.
- Full API regression: 82 suites / 545 tests PASS.
- `pnpm --filter @agm/web test:final-language-agents`: PASS for IT/ES/SV.
- API build: PASS.
- Web build: PASS.
- Source scan: no `1713` or `1726` total literal in application/test/build code;
  component values occur only in the shared canonical definition.
- `git diff --check`: PASS.

## Browser recovery and evidence

Mandatory preflight recorded:

- Browser Plugin Status: PASS
- Integrated Browser Control Status: PLATFORM LIMITATION / OPTIONAL EVIDENCE UNAVAILABLE
- Browser Session Status: PASS
- Target Page Status: PASS

IAB had stale/not-provisioned session attachment. Per the active runbook, no
installation or retry loop was attempted. Port 5174 was occupied by a different
approved local checkout and was not terminated. The controlled runner was changed
to request an OS-allocated local port.

Minimal failed probes were preserved and isolated in sequence:

1. stale `#turn-real-status` selector;
2. stale user-session fixture instead of restored TURN admin session;
3. registry/organization UI moved behind `#turn-investigate` and a disclosure.

Only the affected Browser scenario was repeated after each harness correction.
Final controlled evidence:

`evidence/app-i18n/linguistic-agents/browser/2026-09-20T17-08-13-631Z/report.json`

The final report is PASS for desktop and mobile, with three captured ONLINE
heartbeat POSTs per viewport. Each payload contains the same contract version,
digest, canonical components, derived total and `errors=0`.

An incidental legacy static dashboard test was probed while diagnosing selector
drift and still contains unrelated pre-existing stale/encoding assertions. No
change to that test was retained; it is not part of the requested shared-contract
remediation or the default Web build gate.

## Promotion sequencing prerequisite

The Production workflow restarts API and Web, then runs the 27/27 accountability
gate before the later Browser job. Restarting a static Web server does not execute
the new bundle, so the database can still contain the last unversioned heartbeat.
The strict validator correctly refuses that stale contract shape.

No legacy/unversioned acceptance path was added because that would weaken the
explicit version/digest requirement. Before an authorized controlled deployment,
the release plan must provide an authorized real Web session that publishes the
new versioned heartbeats before the 27/27 gate, or split the gate after that step.
This is a release-orchestration prerequisite, not permission to modify Production.

## Release sequencing recovery

The Product Owner authorized one additional local-only change: repair only the
release order while preserving every accepted PASS and leaving Production frozen.
The workflow now performs these steps in this order:

1. deploy and prove the immutable Web candidate is publicly available;
2. run Browser preflight and a controlled Chromium session;
3. unlock through the existing TURN admin contract, with the Production PIN
   supplied fail-closed from the protected Environment secret;
4. load the real candidate Web bundle and require HTTP 201 for the versioned IT,
   ES and SV heartbeat requests;
5. only then run the existing M2M lifecycle, failover exercise and 27/27 gate.

No authentication endpoint, authority rule, validation rule, fallback, legacy
acceptance path or product runtime component was changed.

Recovery attempts were not repeated unchanged:

1. The simulator was initially rejected before execution because root `tsx`
   emitted CommonJS and did not accept top-level await. The simulator was wrapped
   in `main()`.
2. The imported publisher still had top-level await in its CLI-only branch. That
   branch was moved into `runCli()`.
3. Shared-package ESM/CommonJS interop exposed no default export under `tsx`.
   The publisher now accepts the same module through namespace/default interop.
4. The controlled Browser reached all three HTTP 201 responses, but evidence
   serialization expected a nested `checks` object. The serializer was aligned
   with the existing validator's direct result fields.
5. The affected simulation then passed without further recovery.

`js-yaml` was absent during an optional redundant syntax probe. It was classified
`OPȚIONAL`; no dependency was installed. The deterministic sequence simulator and
the existing Production SSH transport validator both passed.

Final local evidence:

- `release-sequencing-simulation.json`: PASS;
- candidate Web available: PASS;
- IT/ES/SV heartbeat HTTP status: 201/201/201;
- IT/ES/SV duty: COMPLETED/COMPLETED/COMPLETED;
- independent validation: PASS for all three;
- persisted and reopened projection: 27 active of 27, zero red nodes, FINAL PASS;
- preserved 24-agent baseline digest unchanged, zero regressions;
- corrupt-total negative control: FAILED/DENIED, zero independent validations;
- focused Web and API tests: PASS;
- full API regression: 82 suites, 545 tests PASS;
- Production workflow transport contract: PASS;
- `git diff --check`: PASS.

## Closure

Shared contract, Web-to-API integration, negative control, builds, regression and
controlled Browser evidence are complete locally. The candidate remains
uncommitted and unpublished. Production freeze remains active pending explicit
Product Owner authorization.
