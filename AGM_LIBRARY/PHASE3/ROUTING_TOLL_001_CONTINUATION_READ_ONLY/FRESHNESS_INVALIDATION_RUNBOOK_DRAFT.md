# ROUTING-TOLL-001 — source freshness and invalidation runbook

Status: `DRAFT / OWNER REVIEW REQUIRED / NOT OPERATIONAL`
Scope: documentary governance only. No runtime, application, API, scheduler, Registry or Production change is authorized by this draft.

## Safety invariant

`UNKNOWN != ZERO`, `UNKNOWN != SAFE`, and `UNKNOWN != PASS`.

An expired, unreachable, changed or scope-ambiguous source must not produce an exact toll result. The consumer must report the source as stale or unknown and require a newer verified artifact or human confirmation.

## Minimum metadata per governed source

- canonical `sourceId` and official final URL;
- publisher and competent authority;
- jurisdiction and exact regime;
- vehicle, weight, axle, emission and route scope;
- publication, effective-from and effective-to dates where published;
- acquisition timestamp, MIME, byte size and SHA-256;
- HTTP `ETag` and `Last-Modified` where supplied;
- supersedes/supersededBy relationship;
- named review owner and review status;
- last successful freshness check and next required review;
- invalidation reason and replacement evidence when stale.

## Source classes and proposed review triggers

| Source class | Required trigger | Stale condition |
|---|---|---|
| Dynamic tariff page | Check before operational tariff publication and after any operator tariff announcement | hash/content, final URL, scope or tariff changes without reviewed replacement |
| Dated tariff artifact | Effective-date gate plus review before its next announced tariff period | effective-to passed, replacement published, or applicability no longer demonstrated |
| Legal/authority basis | Check official consolidation status and amendments before authority review | superseded, repealed, amended outside approved scope, or provenance unavailable |
| Tolled-network/map artifact | Check after official network-change announcements | route set or applicability changes without reviewed artifact |
| Facility/operator tariff | Check operator notice and effective date independently of national toll sources | facility rate/category/availability change or operator source unavailable |

No universal fixed interval is declared authoritative in this draft. A Product Owner-approved policy must assign a review interval per source and regime based on the official update mechanism.

## Invalidation workflow

1. Fetch only the approved official URL and record redirect/final URL metadata.
2. Compare MIME, byte size, SHA-256, `ETag`, `Last-Modified`, effective dates and declared scope.
3. If unchanged, append a freshness observation; do not rewrite historical evidence.
4. If changed, mark the currently approved artifact `STALE_PENDING_REVIEW`; never overwrite it.
5. Capture the new artifact as `CANDIDATE_NOT_AUTHORITATIVE` with a new integrity record.
6. Map the change to affected jurisdictions, regimes, vehicle classes and route segments.
7. Require human authority/applicability review before `CURRENT` or `AUTHORITATIVE_WITH_SCOPE`.
8. Propagate an approved change to controlled views by the established atomic process.
9. If any gate fails, retain the last evidence historically but return `UNKNOWN/STALE` for current operational use.

## Rollback and traceability

- retain every prior artifact and source-to-source transition;
- never mutate a historical checksum;
- rollback means restoring the previous Registry/view snapshot, not deleting the rejected candidate;
- one sourceId must continue to point to one canonical authority/artifact state and may appear in multiple controlled domain views;
- a common source cannot implicitly close another gap or extend its approved authority scope.

## Approval gates still required

1. Product Owner approval of source classes and per-source review intervals;
2. human authority approval of every candidate source;
3. separate Registry mutation authorization;
4. separate runtime/application/API mandate for automation;
5. failure-mode tests proving stale data cannot be returned as zero or exact.
