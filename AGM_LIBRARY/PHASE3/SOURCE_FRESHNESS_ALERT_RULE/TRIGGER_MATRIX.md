# Trigger matrix

| Condition | Result state | Alert type | Required action | Automatic canonical change |
|---|---|---|---|---|
| Distinct official document/version detected | `NEW_VERSION_DETECTED` | `NEW_VERSION_DETECTED` | Product Owner `APPROVE`, `REJECT`, or `DEFER` | None |
| Official candidate explicitly claims supersession | `SUPERSEDED_PENDING_REVIEW` | `SUPERSEDED_PENDING_REVIEW` | Product Owner `APPROVE`, `REJECT`, or `DEFER`; preserve current links meanwhile | None |
| 30 days or first observed point inside the 30-day band | `EXPIRY_WARNING` | `EXPIRY_30_DAYS` | Review replacement/freshness | None |
| 14 days or first observed point inside the 14-day band | `EXPIRY_WARNING` | `EXPIRY_14_DAYS` | Review replacement/freshness | None |
| 7 days or first observed point inside the 7-day band | `EXPIRY_WARNING` | `EXPIRY_7_DAYS` | Review replacement/freshness | None |
| 1 day before inclusive end | `EXPIRY_WARNING` | `EXPIRY_1_DAY` | Review replacement/freshness | None |
| Inclusive final applicability day | `EXPIRY_WARNING` | `EXPIRY_DAY` | Complete review before next day | None |
| First evaluation after a missed expiry-day run | `EXPIRED_REVIEW_REQUIRED` | `EXPIRED` | Product Owner review; dependent output unknown | None |
| Relevant check fails | `FRESHNESS_UNKNOWN` | `FRESHNESS_UNKNOWN` | Verify official evidence and review | None |
| No explicit expiry and due check cannot confirm currentness | `FRESHNESS_UNKNOWN` | `FRESHNESS_UNKNOWN` | Verify official metadata/source and review | None |
| Scheduled/manual review with demonstrated freshness | `REVIEW_REQUIRED` | Review package; email only if another configured alert trigger applies | Product Owner review | None |

Threshold catch-up is intentional: if a daily job misses the exact 14-day instant and next runs at 13 days, it emits the unsent 14-day threshold once. The ledger then suppresses repeats until the next threshold.
