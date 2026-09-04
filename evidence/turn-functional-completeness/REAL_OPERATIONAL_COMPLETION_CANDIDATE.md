# TURN real operational completion candidate

Current authority: Product Owner mandate of 2026-09-05. This document does not grant Product Owner acceptance or `FINAL PRODUCT PASS`.

## Product contract

- Identity comes from the canonical registry; operational state never does.
- Every operational node exposes runtime presence, state, health, heartbeat, activity, freshness, workload, dependencies, evidence, reason and required action.
- Missing telemetry produces `NO_OBSERVATION`, stale telemetry produces `DEGRADED`, failed telemetry produces `FAILED`, and missing executable code produces `CAPABILITY_NOT_IMPLEMENTED`.
- The protected projection fails closed. Missing Owner Access or a failed source produces `DATA UNAVAILABLE`; no registry/UI fallback is rendered.

## Basic

| Function | Real producer | Persisted source | Product Owner action |
|---|---|---|---|
| Translator | live provider functional probe | `TranslationService.functionalHealth` | repair provider/configuration when the probe fails |
| Email | communication and Gmail sync paths | `CommunicationConversation`, `CommunicationMessage`, `GmailPilotTelemetry` | sync, retry failures, clear backlog |
| Transport document | local deterministic analysis | metadata-only `ProviderUsageEvent` | inspect uncertain/failed outcomes; run the feature when zero activity |
| Tachograph | local deterministic analysis | metadata-only `ProviderUsageEvent` | inspect uncertain outcomes |
| Dashboard text | local deterministic analysis | metadata-only `ProviderUsageEvent` | inspect uncertain outcomes |
| Dashboard warning | real vision response | metadata-only `ProviderUsageEvent` | inspect uncertain/failed provider outcomes |
| Legislation | local rules/knowledge analysis | metadata-only `ProviderUsageEvent` | inspect uncertain outcomes |
| Cargo safety | local deterministic analysis | metadata-only `ProviderUsageEvent` | inspect uncertain outcomes |
| OCR workspace | local Tesseract execution | metadata-only `ProviderUsageEvent` | inspect `NO_TEXT`/failed outcomes |
| Load-safety knowledge | versioned static contract | static reference only | open the reference; never treat it as runtime |

The Basic collector stores only feature id, outcome, duration, numeric confidence and result label. Image, OCR text and user content are not sent. `companyId` and `userId` come from the authenticated request; `occurredAt` comes from the database.

## Premium operational nodes

| Node class | Real source | Runtime rule |
|---|---|---|
| Authority Control Plane | correlated `ComponentHeartbeat` plus current lease/journal evaluation | stale heartbeat fails; conflicts override status to FAIL |
| Secret Guardian | `SecretTelemetryService` | evaluates configured/missing/invalid/rotation-required without exposing values |
| Architecture Inspector | executable persisted inspection | evaluates registry completeness, scopes and telemetry bindings; writes `AgentRuntimeEvent` |
| Release Inspector | executable persisted inspection | evaluates correlation and freshness of release runtime event and ACP heartbeat; writes `AgentRuntimeEvent` |
| Orchestrator | authority dispatch transaction | writes lifecycle evidence only when a real lease/handoff is issued |
| Recovery Executor | `RecoveryExecution` | reflects actual bounded runbook execution |
| Opportunity agents | `OpportunityAgentTelemetry` | activity, dependency health, backlog and freshness from real analyses |
| Live adapters | `LiveAdapterTelemetry` | provider attempt/success/error/rate-limit/cache evidence |
| Linguistic agents | `ComponentHeartbeat` | real deterministic catalog audit heartbeat |
| Car Mover services | domain event stores | latest real job, incident, evidence, accounting or archive record |
| Human Product Owner | authority records | `NOT_APPLICABLE` runtime; never shown as a process |

## Authority evaluator

The projection evaluates on every read:

- active executive authority;
- active mandate → decision → lease command chains;
- delegated authority, provider, epoch, fencing token and expiry;
- pairwise scope/write/resource conflicts;
- leases that remain active after TTL expiry;
- rejected authority incidents with correlation and lease references;
- Opportunity Intelligence from current agent telemetry, dependencies, backlog and conflicts (not from a historic gate PASS).

## Current candidate state

- Source implementation: complete locally.
- Targeted API tests: PASS.
- API build: PASS.
- Web build and anti-placeholder UI contract: PASS.
- Production deployment: pending a new explicit push/deployment approval.
- Production Browser Validation with real Owner Access: pending deployment.
- `PRODUCT OWNER ACCEPTANCE`: `NOT_GRANTED`.
- `FINAL PRODUCT PASS`: not requested and not inferred.
