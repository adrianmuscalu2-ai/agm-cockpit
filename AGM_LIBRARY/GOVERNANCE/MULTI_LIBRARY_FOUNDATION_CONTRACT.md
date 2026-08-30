# AGM Multi-Library Foundation contract

Document ID: `AGM-LIB-MULTI-001`
Version: `1.0.0`
Status: `CURRENT`
Owner: `AGM Product Owner`
Custodian: `Documentation & Knowledge`

## Central authority

The AGM Central Registry is the only authority for canonical source identity,
documentary status, version, checksum, provenance, retention and supersession.
Every canonical source has exactly one `sourceId`.

The original source remains at its canonical path. Registering or assigning a
source to a domain does not move, duplicate, overwrite or delete it.

## Domain views

A domain library is a controlled view made only from `sourceId` and
`membershipId` references. Domain membership may describe a source's relevance
and consumer policy, but cannot contain or override central `status`, `version`,
`sha256`, content, canonical path, retention or supersession.

Cross-domain relevance is represented by multiple memberships pointing to one
canonical source. It is never represented by copied documents.

## Candidate domains

`TACHO VIEW` and `LEGISLATION / SAFETY VIEW` are discovery indexes with status
`CANDIDATE_NOT_AUTHORITATIVE`. Their existing matches are insufficient to
establish current operational or legal truth. All memberships in these views
must remain `CANDIDATE` until Phase 2 obtains primary sources and a human domain
review approves them.

## Basic Librarian boundary

The existing `agent-linguistic-librarian` remains linguistic authority only.
It may review terminology and language presentation but cannot determine legal,
Tacho, routing, safety or documentary authority. Phase 1 neither changes its
registry entry nor activates any new runtime agent.

## Runtime and release boundary

This foundation is documentary and structural. It creates no API, runtime
route, TURN projection, heartbeat, health gate, deployment or Production
dependency.

## Conflict handling

Historical sources are never rewritten to remove old terminology. A later
Owner decision is represented as a separate governance relationship. Missing
authority remains missing; `UNKNOWN` cannot be converted to `CURRENT`, `SAFE`
or `PASS`.
