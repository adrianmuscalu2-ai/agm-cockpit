# Cross-domain source model

## Model

A cross-domain source is registered once and receives one or more domain memberships. Each membership expresses relevance and domain-use policy; it does not clone the document or redefine its authority.

```text
Canonical source: CS-DE-STVO
  identity/hash/version/authority/jurisdiction -> Central Registry only
  artifact                               -> one verified canonical artifact
  memberships:
    legislation-safety -> primary German legal source, provision-specific use
    routing-toll       -> restrictions context, not a toll tariff source
    car-mover          -> route/vehicle applicability context
    documents/evidence -> only when used as cited evidence, not automatically
```

The example must not be interpreted as approval to create these memberships now. It demonstrates the future mapping model.

## Domain-specific interpretation without source forks

| Domain | Permitted metadata for `CS-DE-STVO` | Prohibited inference |
|---|---|---|
| Legislation / Safety | Applicable provisions, jurisdiction DE, effective interval, reviewer, legal-use gate | “Entire StVO proves every safety rule” |
| Routing / Toll | Restriction-related clauses and required route facts | “StVO is a current toll-rate source” |
| Car Mover | Vehicle/operation applicability and human-confirmation conditions | “All Car Mover jobs are covered identically” |
| Documents / OCR / Evidence | Citation/evidence relationship and extraction provenance | “OCR output equals legal truth” |

## Cross-domain reference contract

Each membership should carry or resolve:

- one canonical `sourceId`;
- domain role and rationale;
- domain owner;
- allowed consumer classes;
- minimum authority/status required by each consumer;
- applicability filters and missing-fact behavior;
- derived rule IDs and source anchors, if any;
- last validated registry hash/version;
- open gap references;
- `UNKNOWN/CONFLICT/STALE` behavior.

Canonical path, URI, version, status, hash, provenance and retention are resolved from Central Registry and are not copied into the authoritative membership record. A generated view may denormalize them for performance only when the view is manifest-bound and explicitly non-authoritative.

## Reuse and duplicate rules

1. Same authority/document used in several domains: **one `sourceId`, multiple memberships**.
2. Same bytes at several preserved historical/evidence paths: keep records and provenance until a human determines whether they are aliases, evidence copies or true duplicates.
3. Original and consolidated legislation: separate source IDs because authenticity/status and use differ; relate them explicitly, do not deduplicate by title.
4. Translation, OCR or summary: separate derived artifact with lineage; never substitute it for the canonical source.
5. A domain-specific rule extracted from a shared source: own the rule in the domain, but bind it to source ID/hash and provision anchors.

## Conflict and invalidation examples

- If `CS-DE-STVO` hash changes after official reacquisition, all dependent memberships and rules become `STALE_PENDING_REVIEW`.
- If Routing interprets a provision differently from Legal, the source remains one record. Both interpretations are held as scoped proposals and the conflict is escalated.
- If `LEGAL-005` is open, presence of `CS-DE-STVO` may support German scope but cannot close missing BE/NL/LU/PL/CZ/DK coverage.
- If a route lacks vehicle class or date, the routing consumer returns UNKNOWN and asks for confirmation; it cannot use the broadest legal interpretation as safe default.

## Current evidence supporting this model

- 374 of the 798 mapped sources already have multiple domain memberships.
- A source currently belongs to as many as six domains.
- There are 1,466 memberships for 798 mapped sources.
- Central Registry contains no duplicate canonical paths.

Cross-domain use is therefore a first-class architecture concern. Independent specialized sources of truth would multiply existing shared-source relationships into synchronization obligations.
