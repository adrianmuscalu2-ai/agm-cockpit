# AGM 1.9.1 — Production release record (append-only)

Date: 2026-11-06

## Release
- Source commit: `392bc66` on `agm-canonical-20260820` (also `integration/agm-1.9.1-20261104`).
- Workflow: `production-release.yml`, run `42162872386`, conclusion `success`.
- Jobs: verify, publish, publish-web, Deployment (Production reviewer `adrianmuscalu2-ai` approved), Deployment health, Post-deploy certification, Production Browser certification.

## Prior failed runs (preserved)
- `42148887595`: `verify` failed, 9 `no-explicit-any` lint errors in `universal-lifecycle.service.ts`; fixed in `2d2d00a` (lint scope only).
- `42161165811`: `verify` failed, browser validator expected "Cockpit 1.6.0"; fixed in `392bc66`.

## Live evidence
- `https://app.agmcockpit.com/sw.js` serves cache tag `agm-cockpit-1.9.1-turn-agmatcc-20261104`.
- `https://api.agmcockpit.com/api/v1/health/ready` returned 200.
- `/version` returns 404 (no such endpoint; not evidence of missing deployment).

## Open items (not resolved by this release)
- Governance V2 activation: no Proposer/Approver designated; awaiting Turn Commander decision.
- SEARCH SEMANTIC: UNAVAILABLE (lexical only).
- ACP access proof: STALE_OR_NOT_PROVISIONED at certification time.
- TomTom live verification and TURN company in Production: UNKNOWN.

## Follow-up (local, unreleased)
- AGMaTCC three-column UI with state icons, STOP at lips, question transcript and provenance-tagged alerts. Local gates: test-agmatcc PASS, AGMaTCC browser PASS, responsive-brand 84 checks PASS, agent-accountability PASS.
