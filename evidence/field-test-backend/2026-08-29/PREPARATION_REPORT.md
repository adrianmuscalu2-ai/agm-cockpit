# AGM Car Mover — field-test backend final report

Completed: `2026-08-29T11:08:56.0794665Z`

## Verdict

- `FIELD TEST BACKEND = PASS`
- `FIELD MEASUREMENT = READY TO START`
- `FIELD VALIDATION = INSUFFICIENT DATA`
- `PRODUCTION AUTHORIZATION = SEPARATE OWNER DECISION`

The backend is ready to collect controlled field observations. The one recorded
case is deliberately `PENDING / NON-CONCLUSIVE`; it is not a completed route and
does not support a product or provider verdict.

## Public field surface

Base URL: `https://validation-api.agmcockpit.com`

Only these operations are exposed by the field gateway:

- `GET /api/v1/car-mover/routing/field-protocol`
- `POST /api/v1/car-mover/routing/observations`
- `GET /api/v1/car-mover/routing/telemetry`

Boundary evidence:

- authorized tester protocol: HTTP 200;
- authorized tester observation: HTTP 201;
- authorized owner telemetry: HTTP 200;
- unauthenticated protocol: HTTP 401;
- tester telemetry: HTTP 403;
- owner observation: HTTP 403;
- non-field `/api/v1/health/ready`: HTTP 404;
- `X-AGM-Environment: FIELD-VALIDATION` present;
- gateway token is never forwarded upstream;
- internal role mapping and five-minute JWT exchange: PASS.

## Physical Android evidence

- device: Samsung SM-S931B, Android 16;
- build fingerprint: `samsung/pa1qxeea/pa1q:16/BP4A.251205.006/S931BXXSBCZG3_OXMBCZG3:user/release-keys`;
- serial SHA-256: `d4d5214d68c4da2ac62ea381e6b82f06a18d87e9f7decee3d09ff95442db7d37`;
- authenticated protocol from physical phone: HTTP 200;
- authenticated telemetry from physical phone: HTTP 200;
- three technical tester identities: 40 assigned cases each;
- first observation: `RECORDED_PENDING_NON_CONCLUSIVE`;
- first observation ID SHA-256: `5aca6de27bb844b104fe009099e6ece7d179dc8d75e6de3deb4fda2c2f46743f`;
- plaintext tokens displayed: false.

## Current telemetry

- raw observations: 1;
- unique cases: 1;
- finalized cases: 0;
- pending cases: 1;
- p50/p95 route latency: not measured / null;
- paid external lookups: 0;
- sample sufficient: false;
- current result: `INSUFFICIENT_DATA`.

Missing thresholds are reported explicitly:

- finalized cases below 100;
- distinct active testers below 3;
- active field days below 14;
- elapsed period below 30 days.

The governance values remain unchanged:

- `2–5% = HYPOTHESES_NOT_PASS`;
- `0–1% = HYPOTHESES_NOT_PASS`;
- `≤3% = TARGET_NOT_VERDICT`;
- partial data is non-conclusive.

## Routing policy

- default profile: `PASSENGER_CAR`;
- `UNKNOWN = HUMAN_CONFIRMATION_REQUIRED`;
- TOM/TomTom and existing CORE components: retained;
- HERE: `INACTIVE_NOT_REQUIRED`;
- TollGuru: `INACTIVE_NOT_REQUIRED`;
- Valhalla/OSM: `REGISTERED_NOT_RUNTIME_READY`;
- AGM Toll Library: `REGISTERED_NOT_RUNTIME_READY`.

No provider commercial subscription or lookup was activated.

## Isolated deployment evidence

- compose project: `agm_field_validation`;
- validation tunnel ID: `f4343acc-7303-4422-a10a-587a9dc96114`;
- Production tunnel ID: `1c7d88b4-f2bb-40bb-82b0-37da35ee30a9`;
- tunnel IDs differ: PASS;
- field API image: `sha256:e43e5d50aa59302e3ebc6214edea493dd40455665178dd45e83db7d3141f2600` — healthy;
- field gateway image: `sha256:99cf465f88461cb28bd893362a93028f170e8462738e73f2bfebc5803d45a809` — healthy;
- field PostgreSQL image: `sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777` — healthy;
- only gateway is published, on `127.0.0.1:3301`;
- field API and field PostgreSQL have no host ports;
- field database uses a separate named volume;
- field connector service is active and uses only `cloudflared.field.yml`.

## Production isolation evidence

Container IDs captured before and after field deployment are identical:

- `agm-production-web = f5aacd48b3df`;
- `agm-production-api = 98180938624e` — healthy;
- `agm-postgres = 415b23fe8f85` — healthy;
- `cloud-postgres-1 = bd99e9409c57` — healthy.

Production connector still runs with
`/etc/cloudflared/config-production.yml`. Production API health returned HTTP
200 after field deployment. DNS, Production tunnel, Production connector,
Production routing and Production application containers were not modified.

## Verification

- gateway boundary test: 1/1 PASS;
- internal role mapping: PASS;
- Car Mover routing telemetry test: 8/8 PASS;
- API build: PASS;
- Cloudflare ingress validation: PASS;
- seed transaction: PASS, 120 cases;
- RFC UUID normalization: PASS, 120 jobs + 120 vehicle subjects;
- physical Android connectivity and authorization: PASS;
- post-observation telemetry governance: PASS.

Local repository HEAD remains
`dc8d793d45fe4108bf3f9b8eb833d8423cd27201`. No commit or push was performed.
The working tree remains intentionally dirty from the wider pre-existing AGM
work and this field-preparation mandate.
