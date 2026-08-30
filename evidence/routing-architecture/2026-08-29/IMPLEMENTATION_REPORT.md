# AGM controlled routing architecture implementation

Date: 2026-08-29

Scope: local API candidate only. No Production deployment, commit, push, DNS, tunnel, connector, or API routing infrastructure change was executed.

## Implemented controls

- Car Mover standard routing profile is `PASSENGER_CAR_STANDARD`.
- `CAR_WITH_TRAILER`, `TRANSPORTER`, `VAN`, `LIGHT_COMMERCIAL`, `TRUCK`, and other explicitly classified vehicles use the extended profile.
- An unknown or legacy-unspecified vehicle cannot be accepted without human confirmation.
- `UNKNOWN` is never represented as zero, safe, or PASS.
- Route order is TOM -> cache -> Valhalla/OSM -> human confirmation as applicable.
- HERE and TollGuru remain reversible adapters but are inactive by default, excluded from unauthorized fresh and stale cache paths, and require an explicit owner authorization reference.
- HERE and TollGuru were removed from the required/fallback provider registry path.
- The registry now uses AGM route cache, Valhalla/OSM, AGM Toll Library, official authorities, and human confirmation.

## Field telemetry contract

Endpoint: `POST /car-mover/routing/observations`

Recorded fields:

- vehicle class;
- route source;
- cache hit/miss/not applicable;
- toll status and confidence;
- fallback reason;
- manual confirmation;
- paid external lookup and explicit authorization reference;
- final route accepted/rejected/pending.

Owner report endpoint: `GET /car-mover/routing/telemetry`.

The report preserves `2-5%` total fallback and `0-1%` paid fallback as `HYPOTHESES_NOT_PASS`. The target `<=3%` is stored as `TARGET_NOT_VERDICT`. With no field observations, the verdict is `NO_FIELD_DATA`; no PASS is synthesized.

## Validation

- API build: PASS.
- API lint: PASS.
- Targeted regression: 4/4 suites, 23/23 tests PASS.
- Full API regression: 51/51 suites, 287/287 tests PASS.
- Diff whitespace check: PASS.
- Browser/Android: not run; no UI or Production release was authorized by this mandate.

Commands:

```text
pnpm.cmd --filter @agm/api build
pnpm.cmd --filter @agm/api lint
pnpm.cmd --filter @agm/api test -- --runInBand car-mover-routing-policy.spec.ts car-mover-routing-telemetry.spec.ts toll-required-policy.spec.ts car-mover-p0-01.spec.ts
$env:NODE_ENV='test'; $env:JWT_SECRET='<local synthetic>'; $env:DATABASE_URL='postgresql://example.invalid/agm'; $env:OPENAI_API_KEY='<local synthetic, no network>'; pnpm.cmd --filter @agm/api test -- --runInBand
git diff --check -- <routing scope files>
```

## Status

- Architecture implementation: PASS locally.
- HERE required: NO.
- TollGuru required: NO.
- Automatic paid external lookup: DISABLED.
- Field fallback percentage: NOT YET MEASURED.
- Planning estimates: HYPOTHESES, NOT PASS.
- Production change: NOT EXECUTED / NOT AUTHORIZED.
- Commit/push: NOT EXECUTED.
- Repository HEAD during validation: `dc8d793d45fe4108bf3f9b8eb833d8423cd27201`.
- Working tree: intentionally dirty from the wider unreleased candidate; this scope was not committed.
