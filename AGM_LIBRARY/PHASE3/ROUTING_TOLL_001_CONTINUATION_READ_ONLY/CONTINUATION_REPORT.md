# ROUTING-TOLL-001 — controlled continuation report

Date: `2026-08-30`
Mode: `READ-ONLY INVESTIGATION + LOCAL EVIDENCE ACQUISITION`
Registry mutation: `NONE`
Commit/push: `NOT EXECUTED`

## Baseline used

- Central Registry: `831`, SHA-256 `f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d`;
- Routing/Toll view: `279`, SHA-256 `001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997`;
- accepted source additions: `16/16`;
- `ROUTING-TOLL-001 = OPEN / PARTIALLY_READY`;
- `LEGAL-003` and `LEGAL-005 = OPEN / UNCHANGED`.

No completed Phase 3 step was repeated.

## Work completed

1. Recovered the exact historical definition and eight residual closure items from the existing assessment and closure package.
2. Recognized `RT001-RES-008` as already closed by the Product Owner's 16/16 decisions and accepted atomic apply.
3. Inspected current official authority surfaces for the seven remaining items.
4. Captured and hashed 12 of 14 planned official artifacts on the first acquisition path.
5. Recovered the Swiss LSVA artifact through the current BAZG R-15 canonical link, producing 13/14 captured artifacts.
6. Captured a supplemental Luxembourg Customs 2026 enforcement artifact, producing 14 new locally hashed artifacts in total.
7. Preserved the Liefkenshoek artifact as `INTEGRITY_BLOCKED_CLOUDFLARE_JAVASCRIPT_CHALLENGE`; the official web content is visible, but no unofficial mirror or generated substitute was accepted.
8. Produced a non-operational freshness/invalidation runbook draft.

## Residual status

| Residual | Current result |
|---|---|
| France complete concession grids | `OPEN / BLOCKED`: major official grids found, complete concession set not demonstrated |
| Poland passenger concessions | `READY FOR OWNER AUTHORITY REVIEW`: A1/A2/A4 artifacts captured and hashed |
| Switzerland LSVA/vignette | `READY FOR OWNER AUTHORITY REVIEW`: 2/2 artifacts captured and hashed |
| Luxembourg Eurovignette 2026 | `READY FOR OWNER AUTHORITY REVIEW`: scope, tariff and 2026 enforcement captured and hashed |
| BE/NL/DE facilities | `PARTIALLY READY`: four artifacts captured; Liefkenshoek local integrity blocked; exhaustive scope not demonstrated |
| DK/NL exact distance rates | `READY FOR OWNER AUTHORITY REVIEW`: 2/2 artifacts captured and hashed |
| Common freshness mechanism | `DRAFT READY FOR OWNER REVIEW / NOT OPERATIONAL` |
| Original 16-source human review | `PASS / CLOSED` |

## Legal gap boundary

No investigation of `LEGAL-003` or `LEGAL-005` was required. The work concerns toll/vignette tariffs, charge regimes and separately governed facilities. General road restrictions remain explicitly outside `ROUTING-TOLL-001`.

## Verdict

`ROUTING-TOLL-001 = OPEN / PARTIALLY_READY`

`CONTINUATION ASSESSMENT = PASS`

`CLOSURE READINESS = BLOCKED`

The blocking conditions are the incomplete France concession set, incomplete/exclusion-unapproved facility inventory, one locally uncaptured official Belgian artifact and lack of Product Owner authority decisions for the new candidates and freshness policy.
