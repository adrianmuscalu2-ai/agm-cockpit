# AGM Global Library Authority — Phase 1 evidence

Date: 2026-09-19

Parent SHA: `dbfc6e4b7ed763fedde2675c7f5bbcbc51e3d0b8`

Scope: control plane and contracts only; no Production deploy.

## Implemented foundation

- one `AgmGlobalLibraryAuthority` entry point;
- origin-aware domain classification for Basic, Premium, Profile, Car Mover,
  Android and Browser requests;
- four registered domain orchestrators;
- one common resolver contract carrying source, identity, authorization,
  query/intent, result, confidence, ambiguity, provenance, freshness and the
  minimal authorized payload;
- deny-by-default authorization before resolver execution;
- domain-scoped and cross-domain mandates;
- result collection, deterministic de-duplication and conflict recording;
- one `ResolvedContextPackage` and a fail-closed Assistant dispatch decision;
- generic fallback allowed only after `VERIFIED_NO_DATA`.

## Reproducible commands

```text
pnpm.cmd --filter @agm/library-control-plane build
pnpm.cmd --filter @agm/library-control-plane test:phase1
pnpm.cmd --filter @agm/library-control-plane exec tsx scripts/test-minimal-authorized-payload.ts
```

Observed results:

```text
GLOBAL LIBRARY AUTHORITY = IMPLEMENTED
4 DOMAIN ORCHESTRATORS = REGISTERED
COMMON RESOLVER CONTRACT = PASS
AUTHORIZATION BEFORE RETRIEVAL = PASS
CROSS-DOMAIN MANDATES + DEDUPLICATION = PASS
NO GENERIC ASSISTANT FALLBACK BEFORE LIBRARY RESOLUTION = PASS
MINIMAL AUTHORIZED PAYLOAD ENFORCEMENT = PASS
```

The strict TypeScript build completed with exit code 0. All Phase 1 tests
completed with exit code 0.

## Negative controls

- a resolver denied by policy was never called;
- a request with no resolved Android/Browser domain was blocked;
- a domain with no registered eligible resolver was blocked;
- an ambiguous result required clarification and could not reach Assistant;
- generic fallback was rejected for resolved context, ambiguity, denied
  authorization and incomplete resolution;
- two domain results for the same subject produced one context and an explicit
  conflict record;
- a payload field absent from the authorization allowlist did not cross the
  resolved-context boundary.

## Phase boundary

Real Gmail, contacts, history, OCR, translation, Profile, canonical-library and
Car Mover adapters are not migrated here. Shared persistence and Android ↔
Browser synchronization are Phase 2 work. Existing Assistant surfaces are not
switched to the new package in this foundation commit, so there is no hidden
Production behavior change. Phase 2 integration must consume the dispatch gate;
it must not implement another bypass around it.

The separate Prisma `providerUsageEvent` test/build blocker was not changed or
mixed into this architecture commit.

## Gate verdict

`GLOBAL LIBRARY AUTHORITY = IMPLEMENTED`

`4 DOMAIN ORCHESTRATORS = REGISTERED`

`COMMON RESOLVER CONTRACT = PASS`

`NO GENERIC ASSISTANT FALLBACK BEFORE LIBRARY RESOLUTION = PASS (CONTROL-PLANE CONTRACT)`

`PHASE 1 = PASS`

`PHASE 2 = NOT STARTED`

`PRODUCTION DEPLOY = NOT TRIGGERED`
