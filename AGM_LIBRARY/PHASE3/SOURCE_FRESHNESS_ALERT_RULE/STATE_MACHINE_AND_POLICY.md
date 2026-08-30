# AGM source freshness / expiry / supersession policy v1

This policy is generic for `ROUTING_TOLL`, `TACHO`, `LEGISLATION`, `SAFETY`, and later domain libraries. It evaluates source metadata and produces review events; it does not mutate a canonical source registry, a domain view, authority, tariffs, or production data.

## Invariants

- `NEW SOURCE DETECTED != AUTO PROMOTION`.
- `EXPIRED != ZERO`.
- `UNKNOWN != SAFE / PASS`.
- `effectiveUntil` is inclusive. A source remains within its documented window through that calendar day and becomes `EXPIRED_REVIEW_REQUIRED` on the next calendar day.
- Missing expiry is represented as `null`; no date may be inferred.
- Historical artifacts and hashes remain retained after expiry or supersession.

## State machine

| State | Entry condition | Usage disposition | Exit condition |
|---|---|---|---|
| `CURRENT` | Freshness is demonstrated and no review/expiry/new-version condition is active | Allowed only inside approved scope | New trigger or confirmed later check |
| `EXPIRY_WARNING` | Source is within 30 calendar days of its inclusive end date | Allowed only inside approved scope/window, with warning | Confirmed replacement/review, expiry, or stronger trigger |
| `NEW_VERSION_DETECTED` | A distinct official candidate version/date/hash/URL is observed | `UNKNOWN / HUMAN VERIFICATION` for any result affected by the change | Explicit Product Owner decision; never automatic |
| `SUPERSEDED_PENDING_REVIEW` | An official candidate explicitly claims to replace the current source | `UNKNOWN / HUMAN VERIFICATION`; current authority links remain unchanged | Explicit Product Owner decision and separately authorized apply |
| `REVIEW_REQUIRED` | Manual/scheduled review is requested while no stronger currentness failure is present | `UNKNOWN / HUMAN VERIFICATION` where review affects currentness | Explicit Product Owner review |
| `EXPIRED_REVIEW_REQUIRED` | Evaluation date is after the inclusive `effectiveUntil` | `UNKNOWN / HUMAN VERIFICATION`; never zero | Approved replacement or explicit scoped historical use |
| `FRESHNESS_UNKNOWN` | Relevant check failed, or a due check did not confirm currentness | `UNKNOWN / HUMAN VERIFICATION`; never zero/PASS | Successful official check plus required review |

Precedence when conditions coexist is:

`SUPERSEDED_PENDING_REVIEW > NEW_VERSION_DETECTED > EXPIRED_REVIEW_REQUIRED > FRESHNESS_UNKNOWN > REVIEW_REQUIRED > EXPIRY_WARNING > CURRENT`.

Multiple alert events may be emitted in one evaluation even though the record has one current state. The current source is never linked as superseded and a candidate is never promoted until a separate Product Owner mandate is applied.

Any state with `reviewRequired=true` is sticky across scheduler runs. A later successful fetch cannot silently clear an unresolved Product Owner review; only a separately recorded owner decision and authorized apply may update the persisted state.

## Deduplication and idempotence

The immutable dedup key is:

`SourceId + alertType + effectiveVersion/date`

An unchanged sent key is suppressed. Resend is permitted only for a different candidate identity, a more severe state, a new expiry threshold, or an unacknowledged alert whose explicit reminder interval has elapsed. A send is entered into the alert ledger only after the configured provider reports success.

The engine is deterministic for identical source, observation, ledger, and policy inputs. It returns all canonical mutation guardrails as `NONE`.

## Runtime activation boundary

The prepared email dispatcher uses the existing AGM email provider port. Its canonical destination variable is `AGM_PRODUCT_OWNER_ALERT_EMAIL`. `SEED_OWNER_EMAIL` is deliberately not a fallback. If the canonical variable is blank, the email-only result is `EMAIL_DESTINATION_NOT_CONFIGURED`; source evaluation, candidate packaging, and validation continue.
