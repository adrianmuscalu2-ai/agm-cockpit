import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { detectAuthorityConflict, evaluateWriteBoundary, isCommandAllowed, isRunbookActionSetAllowed, normalizeScope, scopesOverlap, type AuthorityResourceSelector } from './authority-scope';
import { authorityScopeSeed, PREMIUM_NETWORK_CONTRACT_VERSION, premiumNetworkSeed } from './premium-network.seed';
import type { CreateDecisionDto, CreateMandateDto, ExecuteRecoveryDto, HandoffLeaseDto, IssueLeaseDto, ResourceSelectorDto, ValidateWriteDto } from './dto';
import { resolveCanonicalNodeState } from './canonical-node-state';
import { TURN_OPERATIONAL_TRUTH_CONTRACT } from '../turn-operational-truth/turn-operational-truth.contract';
import { operationalProfile } from './operational-profile';
import { SecretTelemetryService } from '../secret-telemetry/secret-telemetry.service';
import { optionalExternalProviders } from '../car-mover/car-mover-routing.policy';
import { OPERATIONAL_INCIDENT_CONTRACT, operationalIncidentTransition, qualifyOperationalIncident, type OperationalIncidentQualification } from './operational-incident-evaluator';
import { AGENT_ACCOUNTABILITY_CONTRACT, INSPECTOR_FAILOVER_CONTRACT, evaluateAgentAccountability, evaluateAgentRuntimeVerdict, evaluateInspectorFailover, falseActiveCount, type AccountabilitySignal } from './agent-runtime-accountability.engine';
import { OperationalAgentDutyRunner, type OperationalAgentDutyResult } from './operational-agent-duty.runner';

const ACTIVE_LEASE_STATES = ['AUTHORIZED', 'ACTIVE', 'DRAINING'];
const AUTHORITY_ADMIN_ROLES = new Set(['OWNER', 'PRODUCT_OWNER', 'COMPANY_OWNER', 'ADMIN']);
const AUTHORITY_CONTROL_PLANE_ID = TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId;
const COMPONENT_RUNTIME_PROBE_STALE_AFTER_MS = 90_000;
const COMPONENT_RUNTIME_PROBE_INTERVAL_MS = 60_000;
const CRITICAL_CONTINUOUS_AGENT_IDS = new Set(['agm.authority.control-plane', 'agm.guardian.secrets']);
const json = (value: unknown) => value as Prisma.InputJsonValue;
type DomainActivity = { status: string; observedAt: Date; recordId: string; detail: string; dependencyState: string };
const PRIMARY_INSPECTOR_ID = 'premium.release-inspector';
const SECONDARY_INSPECTOR_ID = 'premium.architecture-inspector';
const ACCOUNTABILITY_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const ACCOUNTABILITY_EVIDENCE_LOOKBACK_LIMIT = 4_000;
const INSPECTION_MANDATE_VERSION = 'inspector-failover-readonly-mandate.v1';
const DOMAIN_SERVICE_VALIDATION_CONTRACT = 'domain-service-operational-validation.v1';
type RuntimeCapabilityRequirement = { provider: string; methods: string[]; adapterCategory?: string };
type OperationalJournalEvent = Prisma.AuthorityAuditJournalGetPayload<Record<string, never>>;

const RUNTIME_CAPABILITY_PROBE_VERSION = 'turn-runtime-capability-probe.v1';
const ARCHIVED_OPTIONAL_PROVIDER_IDS = new Set<string>(optionalExternalProviders);
export const BASIC_AGENT_TELEMETRY_INVENTORY_CONTRACT = 'turn-basic-agent-telemetry-inventory.v1';
export const RUNTIME_CAPABILITY_REQUIREMENTS: Readonly<Record<string, RuntimeCapabilityRequirement>> = {
  [AUTHORITY_CONTROL_PLANE_ID]: { provider: 'AuthorityControlPlaneService', methods: ['dashboard', 'inspectOperationalCapabilities', 'validateWrite'] },
  'premium.architecture-inspector': { provider: 'AuthorityControlPlaneService', methods: ['inspectOperationalCapabilities'] },
  'premium.release-inspector': { provider: 'AuthorityControlPlaneService', methods: ['inspectOperationalCapabilities'] },
  'premium.orchestrator': { provider: 'AuthorityControlPlaneService', methods: ['issueLease', 'handoff'] },
  'premium.recovery-executor': { provider: 'AuthorityControlPlaneService', methods: ['executeRecovery'] },
  'premium.car-mover.intake-dedup': { provider: 'OpportunityIntelligenceService', methods: ['intake'] },
  'premium.car-mover.opportunity-normalizer': { provider: 'OpportunityIntelligenceService', methods: ['intake'] },
  'premium.car-mover.route-mobility': { provider: 'OpportunityIntelligenceService', methods: ['analyze'] },
  'premium.car-mover.cost-risk': { provider: 'OpportunityIntelligenceService', methods: ['analyze'] },
  'premium.car-mover.opportunity-planner': { provider: 'OpportunityIntelligenceService', methods: ['analyze'] },
  'premium.car-mover.opportunity-judge': { provider: 'OpportunityIntelligenceService', methods: ['analyze'] },
  'premium.copilot-gateway': { provider: 'OpportunityIntelligenceService', methods: ['copilot'] },
  'premium.adapters.geocoding': { provider: 'LiveAdapterService', methods: ['resolve'], adapterCategory: 'GEOCODING' },
  'premium.adapters.routing': { provider: 'LiveAdapterService', methods: ['resolve'], adapterCategory: 'ROUTE' },
  'premium.adapters.traffic': { provider: 'LiveAdapterService', methods: ['resolve'], adapterCategory: 'TRAFFIC' },
  'premium.adapters.toll': { provider: 'LiveAdapterService', methods: ['resolve'] },
  'premium.adapters.transit': { provider: 'LiveAdapterService', methods: ['resolve'] },
  'premium.adapters.platform-feed': { provider: 'LiveAdapterService', methods: ['ingestPlatformFeed'] },
  'premium.car-mover.job-service': { provider: 'CarMoverService', methods: ['create', 'transition'] },
  'premium.car-mover.incident-service': { provider: 'IncidentsService', methods: ['create', 'resolve'] },
  'premium.car-mover.evidence-service': { provider: 'EvidenceService', methods: ['create', 'get'] },
  'premium.car-mover.primary-accounting': { provider: 'CarMoverService', methods: ['recordFinance'] },
  'premium.car-mover.archive-retention': { provider: 'CarMoverService', methods: ['transition'] },
};

export const RUNTIME_NATIVE_TELEMETRY_IDS = [
  'agm.guardian.secrets',
  'premium-linguist-it',
  'premium-linguist-es',
  'premium-linguist-sv',
] as const;

@Injectable()
export class AuthorityControlPlaneService implements OnApplicationBootstrap, OnApplicationShutdown {
  private runtimeProbeTimer: ReturnType<typeof setInterval> | undefined;
  private runtimeCycleInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secretTelemetry: SecretTelemetryService,
    private readonly discovery: DiscoveryService,
    private readonly operationalDuties: OperationalAgentDutyRunner,
  ) {}

  async onApplicationBootstrap() {
    await this.runRuntimeMonitoringCycle();
    this.runtimeProbeTimer = setInterval(() => {
      void this.runRuntimeMonitoringCycle().catch(() => {
        // Existing persisted evidence becomes STALE and the dashboard opens an
        // incident if the real monitor cannot complete. No synthetic refresh.
      });
    }, COMPONENT_RUNTIME_PROBE_INTERVAL_MS);
    this.runtimeProbeTimer.unref();
  }

  onApplicationShutdown() {
    if (this.runtimeProbeTimer) clearInterval(this.runtimeProbeTimer);
  }

  private async runRuntimeMonitoringCycle() {
    if (this.runtimeCycleInFlight) return;
    this.runtimeCycleInFlight = true;
    try {
      const companies = await this.prisma.company.findMany({ where: { isActive: true }, select: { id: true } });
      await Promise.all(companies.map(async (company) => {
        await this.recordRuntimeCapabilityProbes(company.id);
        await this.executeCriticalContinuousDuties(company.id);
      }));
    } finally {
      this.runtimeCycleInFlight = false;
    }
  }

  private async executeCriticalContinuousDuties(companyId: string) {
    const now = new Date();
    const mandates = await this.prisma.authorityMandate.findMany({
      where: {
        companyId,
        agentId: { in: [...CRITICAL_CONTINUOUS_AGENT_IDS, SECONDARY_INSPECTOR_ID] },
        status: 'APPROVED',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { issuedAt: 'desc' },
    });
    const mandateByAgent = firstBy(mandates, (mandate) => mandate.agentId);
    const validatorMandate = mandateByAgent.get(SECONDARY_INSPECTOR_ID);
    const dutyMandates = [...CRITICAL_CONTINUOUS_AGENT_IDS]
      .map((agentId) => mandateByAgent.get(agentId))
      .filter((mandate): mandate is NonNullable<typeof mandate> => Boolean(mandate));
    if (!validatorMandate || dutyMandates.length !== CRITICAL_CONTINUOUS_AGENT_IDS.size) return;

    const ctx: RequestContext = {
      companyId,
      userId: '00000000-0000-0000-0000-000000000001',
      roles: ['PRODUCT_OWNER'],
      requestId: randomUUID(),
      correlationId: randomUUID(),
    };
    const runId = 'critical-continuous-' + randomUUID();
    const executions = await this.operationalDuties.execute(ctx, dutyMandates, runId, CRITICAL_CONTINUOUS_AGENT_IDS);
    await this.validateOperationalDutyResults(ctx, executions, validatorMandate, runId);
    // Incidents are reconciled only after new execution and independent
    // validation evidence have been persisted.
    await this.dashboard(ctx);
  }

  async dashboard(ctx: RequestContext) {
    const now = new Date();
    const secretSnapshot = this.secretTelemetry.snapshot();
    const [registry, heartbeats, runtimeEvents, opportunityTelemetry, liveAdapterTelemetry, allLeases, failover, operationalIncidentJournals, domainValidationJournals, mandates, decisions, recovery, domainActivity, opportunityCount] = await Promise.all([
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId }, orderBy: [{ module: 'asc' }, { canonicalId: 'asc' }] }),
      this.prisma.componentHeartbeat.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.agentRuntimeEvent.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'desc' }, take: ACCOUNTABILITY_EVIDENCE_LOOKBACK_LIMIT }),
      this.prisma.opportunityAgentTelemetry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.liveAdapterTelemetry.findMany({ where: { companyId: ctx.companyId }, orderBy: { lastAttemptAt: 'desc' } }),
      this.prisma.authorityLease.findMany({ where: { companyId: ctx.companyId }, orderBy: { issuedAt: 'desc' }, take: 1000 }),
      this.prisma.authorityFailoverState.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId, eventType: { in: ['OPERATIONAL_INCIDENT_OPENED', 'OPERATIONAL_INCIDENT_RESOLVED'] } }, orderBy: { occurredAt: 'desc' }, take: 2000 }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId, eventType: 'DOMAIN_SERVICE_VALIDATED', outcome: 'PASS', mandateId: { not: null }, occurredAt: { gte: new Date(now.getTime() - ACCOUNTABILITY_FRESHNESS_MS) } }, orderBy: { occurredAt: 'desc' }, take: 100 }),
      this.prisma.authorityMandate.findMany({ where: { companyId: ctx.companyId }, orderBy: { issuedAt: 'desc' }, take: 1000 }),
      this.prisma.authorityDecision.findMany({ where: { companyId: ctx.companyId }, orderBy: { decidedAt: 'desc' }, take: 1000 }),
      this.prisma.recoveryExecution.findFirst({ where: { companyId: ctx.companyId }, orderBy: { startedAt: 'desc' } }),
      this.domainActivity(ctx.companyId),
      this.prisma.normalizedOpportunity.count({ where: { companyId: ctx.companyId } }),
    ]);
    const leases = allLeases.filter((lease) => ACTIVE_LEASE_STATES.includes(lease.state) && lease.expiresAt > now);
    const heartbeatById = new Map(heartbeats.map((item) => [item.componentId, item]));
    const opportunityTelemetryById = new Map(opportunityTelemetry.map((item) => [item.agentId, item]));
    const liveTelemetryById = new Map<string, (typeof liveAdapterTelemetry)[number]>();
    for (const item of liveAdapterTelemetry) if (!liveTelemetryById.has(adapterRegistryId(item.category))) liveTelemetryById.set(adapterRegistryId(item.category), item);
    const lastRunByAgent = new Map<string, (typeof runtimeEvents)[number]>();
    for (const event of runtimeEvents) if (!lastRunByAgent.has(event.agentId)) lastRunByAgent.set(event.agentId, event);
    const activeMandateIds = new Set(mandates.filter((mandate) => mandate.status === 'APPROVED' && !mandate.revokedAt && (!mandate.expiresAt || mandate.expiresAt > now)).map((mandate) => mandate.id));
    const validDomainValidations = domainValidationJournals.filter((event) => {
      const metadata = jsonRecord(event.safeMetadata);
      const references = metadata.evidenceReferences;
      return activeMandateIds.has(event.mandateId!) && metadata.contract === DOMAIN_SERVICE_VALIDATION_CONTRACT && metadata.executionKind === 'REAL_DOMAIN_SERVICE_DUTY' && metadata.result === 'PASS' && metadata.validatorMandateId === event.mandateId
        && typeof metadata.outputRef === 'string' && /^sha256:[a-f0-9]{64}$/i.test(metadata.outputRef) && Array.isArray(references) && references.length > 0 && references.every((reference) => typeof reference === 'string');
    });
    const domainValidationById = firstBy(validDomainValidations, (event) => String(jsonRecord(event.safeMetadata).canonicalId ?? ''));
    const leaseByAgent = new Map(leases.map((lease) => [lease.agentId, lease]));
    const failoverByScope = new Map(failover.map((item) => [item.scopeId, item]));
    const registryById = new Map(registry.map((item) => [item.canonicalId, item]));
    const nodes = premiumNetworkSeed.map((seed) => {
      const persisted = registryById.get(seed.canonicalId);
      const item = persisted ?? { ...seed, lifecycleStatus: 'MISSING_FROM_REGISTRY' };
      const registryPresence = persisted ? 'PRESENT' : 'MISSING';
      const profile = operationalProfile({ canonicalId: item.canonicalId, kind: item.kind, capabilities: stringArray(item.capabilities) });
      const heartbeat = heartbeatById.get(item.canonicalId);
      const opportunityRun = opportunityTelemetryById.get(item.canonicalId);
      const liveRun = liveTelemetryById.get(item.canonicalId);
      const lastRun = lastRunByAgent.get(item.canonicalId);
      const lease = leaseByAgent.get(item.canonicalId);
      const failoverState = failoverByScope.get(item.scope);
      const domainRun = domainActivity.get(item.canonicalId);
      const domainValidationCandidate = domainValidationById.get(item.canonicalId);
      const secretRun = item.canonicalId === 'agm.guardian.secrets' ? secretSnapshot : null;
      const runtimeEventExecuting = Boolean(lastRun && ['STARTED', 'WORKING'].includes(lastRun.lifecycle));
      const runtimeDutyCompleted = Boolean(lastRun && lastRun.lifecycle === 'COMPLETED' && lastRun.mandateId && lastRun.evidenceRef && lastRun.outputRef && lastRun.evidenceHash);
      const runtimeActivityProven = runtimeEventExecuting || runtimeDutyCompleted;
      const domainValidation = domainValidationCandidate && now.getTime() - domainValidationCandidate.occurredAt.getTime() <= (profile.freshnessWindowMs ?? ACCOUNTABILITY_FRESHNESS_MS) ? domainValidationCandidate : undefined;
      const canonicalState = resolveCanonicalNodeState({
        registryLifecycleStatus: item.lifecycleStatus,
        ...(profile.expectedSource === 'LIVE_ADAPTER' && liveRun ? { liveAdapter: { status: adapterHealth(liveRun.status), observedAt: liveRun.lastAttemptAt } } : {}),
        ...(profile.expectedSource === 'OPPORTUNITY_TELEMETRY' && opportunityRun ? { opportunityTelemetry: { status: opportunityRun.health, freshnessStatus: opportunityRun.freshnessStatus, observedAt: opportunityRun.lastRunAt } } : {}),
        ...(profile.expectedSource === 'COMPONENT_HEARTBEAT' && heartbeat ? { heartbeat: { status: heartbeat.reportedStatus, observedAt: heartbeat.lastSeenAt, staleAfterMs: profile.freshnessWindowMs ?? undefined } } : {}),
        ...(profile.expectedSource === 'SECRET_TELEMETRY' && secretRun ? { secretTelemetry: { status: secretRun.overallStatus === 'CONFIGURED' ? 'PASS' : 'DEGRADED', observedAt: new Date(secretRun.checkedAt) } } : {}),
        ...(profile.expectedSource === 'RUNTIME_EVENT' && lastRun ? { runtimeEvent: { status: lastRun.lifecycle, observedAt: lastRun.occurredAt } } : {}),
        ...(profile.expectedSource === 'DOMAIN_EVENT_STORE' && (domainValidation || domainRun) ? { domainEvent: { status: domainValidation?.outcome ?? domainRun!.status, observedAt: domainValidation?.occurredAt ?? domainRun!.observedAt } } : {}),
      });
      const activityObservedAt = runtimeActivityProven ? lastRun!.occurredAt : domainValidation?.occurredAt ?? canonicalState.observedAt;
      const activityStale = Boolean(activityObservedAt && profile.freshnessWindowMs && now.getTime() - activityObservedAt.getTime() > profile.freshnessWindowMs);
      const runtimeObservedAt = secretRun ? new Date(secretRun.checkedAt) : heartbeat?.lastSeenAt ?? null;
      const runtimeStaleAfterMs = profile.expectedSource === 'COMPONENT_HEARTBEAT' ? profile.freshnessWindowMs : COMPONENT_RUNTIME_PROBE_STALE_AFTER_MS;
      const runtimeStale = Boolean(runtimeObservedAt && runtimeStaleAfterMs && now.getTime() - runtimeObservedAt.getTime() > runtimeStaleAfterMs);
      const runtimeCapabilityMissing = Boolean(heartbeat?.lastFailureReason?.startsWith('RUNTIME_PROVIDER_NOT_LOADED') || heartbeat?.lastFailureReason?.startsWith('RUNTIME_METHOD_NOT_LOADED'));
      const runtimePresence = profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' || runtimeCapabilityMissing ? 'ABSENT' : runtimeObservedAt ? 'OBSERVED' : 'NOT_OBSERVED';
      const activityStatus = profile.runtimeMode === 'HUMAN' ? 'STANDBY' : profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' ? 'FAIL' : runtimeActivityProven ? 'PASS' : canonicalState.status;
      const probeDegraded = heartbeat?.reportedStatus === 'DEGRADED' || (secretRun ? secretRun.overallStatus !== 'CONFIGURED' : false);
      const sourceStatus = runtimePresence === 'ABSENT' || runtimeStale ? 'FAIL' : runtimePresence === 'NOT_OBSERVED' ? 'NO_TELEMETRY' : probeDegraded ? 'DEGRADED' : activityStatus === 'FAIL' ? 'FAIL' : activityStatus === 'DEGRADED' ? 'DEGRADED' : activityStale ? 'DEGRADED' : activityStatus;
      const effectiveStatus = persisted ? sourceStatus : 'FAIL';
      const secretIssue = secretRun?.secrets.filter((secret) => secret.status !== 'CONFIGURED').map((secret) => `${secret.id}:${secret.status}`).join(', ') || null;
      const sourceFailureReason = secretIssue
        ?? (heartbeat && !['PASS', 'ONLINE', 'HEALTHY'].includes(heartbeat.reportedStatus) ? `ComponentHeartbeat status=${heartbeat.reportedStatus}${heartbeat.lastFailureReason ? `; ${heartbeat.lastFailureReason}` : ''}` : null)
        ?? (liveRun && liveRun.status !== 'HEALTHY' ? `LiveAdapterTelemetry status=${liveRun.status}${liveRun.lastErrorCode ? `; error=${liveRun.lastErrorCode}` : ''}; rateLimit=${liveRun.rateLimitState}` : null)
        ?? (opportunityRun && (!['PASS', 'HEALTHY'].includes(opportunityRun.health) || !['PASS', 'HEALTHY'].includes(opportunityRun.dependencyHealth) || opportunityRun.freshnessStatus === 'STALE' || opportunityRun.backlog > 0) ? `OpportunityAgentTelemetry health=${opportunityRun.health}; dependency=${opportunityRun.dependencyHealth}; freshness=${opportunityRun.freshnessStatus}; backlog=${opportunityRun.backlog}; output=${opportunityRun.outputReference ?? 'NONE'}` : null)
        ?? (lastRun && !['PASS', 'ONLINE', 'HEALTHY', 'STARTED', 'WORKING', 'COMPLETED'].includes(lastRun.lifecycle) ? `AgentRuntimeEvent lifecycle=${lastRun.lifecycle}; detail=${lastRun.detail}` : null)
        ?? (!domainValidation && domainRun && domainRun.status !== 'PASS' ? `Domain event: ${domainRun.detail}` : null);
      const reason = !persisted
        ? 'Canonical identity is absent from PremiumNetworkRegistryEntry.'
        : profile.runtimeMode === 'HUMAN' ? 'Human authority is not a process; runtime heartbeat is not applicable.'
          : profile.missingCapability
          ?? (runtimePresence === 'ABSENT' ? heartbeat?.lastFailureReason ?? 'Executable runtime capability is absent.'
            : runtimePresence === 'NOT_OBSERVED' ? `No runtime heartbeat or capability probe exists for ${item.canonicalId}.`
            : runtimeStale ? `Runtime observation exceeds ${Math.round((runtimeStaleAfterMs ?? 0) / 60000)} minutes.`
              : effectiveStatus === 'STANDBY' ? `Runtime capability probe passed; no current execution is active. Last ${profile.expectedSource} activity is ${activityObservedAt ? activityStale ? 'stale' : 'completed' : 'not yet observed'}.`
                : sourceFailureReason);
      const requiredAction = !persisted
        ? 'Apply the approved registry provisioning migration; do not infer identity presence from telemetry.'
        : profile.requiredAction
          ?? (runtimePresence === 'ABSENT' ? 'Restore the missing runtime provider or executable method.'
            : runtimePresence === 'NOT_OBSERVED' ? 'Start the real runtime producer and publish its first authenticated observation.'
            : runtimeStale ? 'Restore the runtime probe or component heartbeat producer.'
              : effectiveStatus === 'FAIL' || effectiveStatus === 'DEGRADED' ? 'Inspect the cited evidence and restore the failed dependency or execution path.' : null);
      const nodeDependencyFailures = dependencyFailures(liveRun, opportunityRun, heartbeat, secretRun?.secrets.filter((secret) => secret.status !== 'CONFIGURED').map((secret) => `${secret.id}:${secret.status}`));
      const statusUsesRuntimeEvidence = profile.runtimeMode !== 'HUMAN' && (effectiveStatus === 'STANDBY' || effectiveStatus === 'NO_TELEMETRY' || runtimePresence === 'ABSENT' || runtimeStale || probeDegraded);
      const runtimeStatusSource = secretRun ? 'SECRET_TELEMETRY' : profile.expectedSource === 'COMPONENT_HEARTBEAT' ? 'COMPONENT_HEARTBEAT' : 'RUNTIME_CAPABILITY_PROBE';
      const runtimeRecordReference = secretRun?.contract ?? (heartbeat ? `ComponentHeartbeat:${heartbeat.id}` : null);
      const activityEvidenceSource = runtimeActivityProven ? 'RUNTIME_EVENT' : domainValidation ? 'DOMAIN_VALIDATION_EVENT_STORE' : profile.expectedSource;
      const activityRecordReference = runtimeActivityProven ? `AgentRuntimeEvent:${lastRun!.eventId}` : domainValidation ? `AuthorityAuditJournal:${domainValidation.eventId}` : evidenceReference(item.canonicalId, liveRun?.id, opportunityRun?.id, profile.expectedSource === 'COMPONENT_HEARTBEAT' ? heartbeat?.id : null, lastRun?.eventId, domainRun?.recordId);
      const workloadState = runtimeEventExecuting ? 'ACTIVE' : runtimeDutyCompleted ? 'VALIDATED' : domainValidation ? 'VALIDATED' : (opportunityRun?.backlog ?? 0) > 0 ? 'BACKLOG' : domainRun ? 'LAST_DOMAIN_STATE' : 'IDLE';
      const currentOperation = runtimeActivityProven ? lastRun!.detail : domainValidation ? domainValidation.safeMetadata : (opportunityRun?.backlog ?? 0) > 0 ? `${opportunityRun!.backlog} queued items` : domainRun?.detail ?? 'IDLE';
      return {
        canonicalId: item.canonicalId, kind: item.kind, module: item.module, ownerId: item.ownerId,
        supervisorId: item.supervisorId, scope: item.scope,
        registryPresence,
        lifecycleStatus: item.lifecycleStatus,
        runtimeMode: profile.runtimeMode,
        runtimePresence,
        currentFunction: profile.workload,
        currentOperation,
        workloadState,
        status: effectiveStatus,
        statusLabel: profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' ? 'CAPABILITY NOT IMPLEMENTED' : profile.runtimeMode === 'HUMAN' ? 'HUMAN AUTHORITY' : runtimePresence === 'ABSENT' ? 'RUNTIME CAPABILITY ABSENT' : runtimeStale ? 'RUNTIME STALE' : probeDegraded ? 'RUNTIME DEPENDENCY DEGRADED' : runtimeEventExecuting ? 'RUNTIME ACTIVE' : runtimeDutyCompleted ? 'DUTY EXECUTED / VALIDATED' : effectiveStatus === 'STANDBY' ? 'RUNTIME READY / IDLE' : canonicalState.label,
        statusSource: profile.runtimeMode === 'HUMAN' ? 'HUMAN_AUTHORITY' : statusUsesRuntimeEvidence ? runtimeStatusSource : activityEvidenceSource,
        statusObservedAt: statusUsesRuntimeEvidence ? runtimeObservedAt : activityObservedAt,
        health: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : effectiveStatus === 'PASS' || effectiveStatus === 'STANDBY' ? 'HEALTHY' : effectiveStatus === 'FAIL' ? 'FAILED' : effectiveStatus === 'DEGRADED' ? 'DEGRADED' : 'UNKNOWN',
        freshness: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : !runtimeObservedAt ? 'NO_RUNTIME_OBSERVATION' : runtimeStale ? 'STALE' : 'CURRENT',
        activityFreshness: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : !activityObservedAt ? 'NO_ACTIVITY_OBSERVATION' : activityStale ? 'STALE' : 'CURRENT',
        lastHeartbeat: runtimeObservedAt,
        lastActivity: activityObservedAt,
        reason,
        requiredAction,
        evidence: { source: profile.runtimeMode === 'HUMAN' ? 'HUMAN_AUTHORITY' : statusUsesRuntimeEvidence ? runtimeStatusSource : activityEvidenceSource, observedAt: statusUsesRuntimeEvidence ? runtimeObservedAt : activityObservedAt, recordReference: statusUsesRuntimeEvidence ? runtimeRecordReference : activityRecordReference },
        runtimeEvidence: { source: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : runtimeObservedAt ? runtimeStatusSource : 'NONE', observedAt: runtimeObservedAt, recordReference: runtimeRecordReference },
        activityEvidence: { source: activityEvidenceSource, observedAt: activityObservedAt, recordReference: activityRecordReference },
        telemetry: secretRun ? { reportedStatus: secretRun.overallStatus, lastSeenAt: secretRun.checkedAt, lastSuccessAt: secretRun.overallStatus === 'CONFIGURED' ? secretRun.checkedAt : null, lastFailureAt: secretRun.overallStatus === 'ATTENTION' ? secretRun.checkedAt : null, detail: { contract: secretRun.contract, checkedSecrets: secretRun.secrets.length, valuesExposed: false } } : liveRun ? { reportedStatus: liveRun.status, lastSeenAt: liveRun.lastAttemptAt, lastSuccessAt: liveRun.lastSuccessAt, lastFailureAt: liveRun.lastErrorCode ? liveRun.lastAttemptAt : null, detail: { latencyMs: liveRun.latencyMs, errorRateBps: liveRun.errorRateBps, rateLimitState: liveRun.rateLimitState, fallbackActivation: liveRun.fallbackActivation, cacheAgeSeconds: liveRun.cacheAgeSeconds, providerId: liveRun.providerId, contractVersion: liveRun.contractVersion } } : opportunityRun ? { reportedStatus: opportunityRun.health, lastSeenAt: opportunityRun.lastRunAt, lastSuccessAt: opportunityRun.health === 'PASS' ? opportunityRun.lastRunAt : null, lastFailureAt: opportunityRun.health === 'FAIL' ? opportunityRun.lastRunAt : null, detail: { durationMs: opportunityRun.durationMs, freshnessStatus: opportunityRun.freshnessStatus, backlog: opportunityRun.backlog, dependencyHealth: opportunityRun.dependencyHealth, confidence: opportunityRun.confidence, outputReference: opportunityRun.outputReference, providerId: opportunityRun.providerId, contractVersion: opportunityRun.contractVersion } } : heartbeat ? { reportedStatus: heartbeat.reportedStatus, lastSeenAt: heartbeat.lastSeenAt, lastSuccessAt: heartbeat.lastSuccessAt, lastFailureAt: heartbeat.lastFailureAt, detail: heartbeat.lastDetail } : null,
        dependencyState: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : secretRun ? secretRun.overallStatus : heartbeat?.lastFailureReason ? 'DEGRADED' : liveRun ? adapterHealth(liveRun.status) : opportunityRun ? opportunityRun.dependencyHealth : domainValidation ? 'PASS' : domainRun?.dependencyState ?? (runtimeObservedAt ? 'PASS' : 'UNKNOWN'),
        dependencyFailures: nodeDependencyFailures,
        incidents: [],
        authorityState: lease ? { state: lease.state, epoch: lease.epoch, fencingToken: lease.fencingToken, providerId: lease.providerId, expiresAt: lease.expiresAt } : { state: item.writePermissions ? 'STANDBY' : 'ADVISORY' },
        failoverState: failoverState?.state ?? 'STANDBY',
        lastRun: lastRun ? { lifecycle: lastRun.lifecycle, occurredAt: lastRun.occurredAt, detail: lastRun.detail } : domainValidation ? { lifecycle: domainValidation.outcome, occurredAt: domainValidation.occurredAt, detail: domainValidation.safeMetadata } : liveRun ? { lifecycle: liveRun.status, occurredAt: liveRun.lastAttemptAt, detail: { latencyMs: liveRun.latencyMs, providerId: liveRun.providerId } } : opportunityRun ? { lifecycle: 'COMPLETED', occurredAt: opportunityRun.lastRunAt, detail: { durationMs: opportunityRun.durationMs, outputReference: opportunityRun.outputReference } } : domainRun ? { lifecycle: domainRun.status, occurredAt: domainRun.observedAt, detail: domainRun.detail } : null,
      };
    });
    const conflicts = findLeaseConflicts(leases);
    const invalidOrStaleAuthority = allLeases.filter((lease) => ACTIVE_LEASE_STATES.includes(lease.state) && lease.expiresAt <= now).map((lease) => ({ leaseId: lease.id, agentId: lease.agentId, scopeId: lease.scopeId, reason: 'ACTIVE_STATE_WITH_EXPIRED_TTL', expiredAt: lease.expiresAt }));
    const incidentCandidateNodes = nodes.map((node) => node.canonicalId === AUTHORITY_CONTROL_PLANE_ID && (conflicts.length || invalidOrStaleAuthority.length) ? {
      ...node,
      status: 'FAIL',
      statusLabel: 'AUTHORITY INVARIANT FAILURE',
      statusSource: 'AUTHORITY_LEASE_EVENT_STORE_EVALUATOR',
      statusObservedAt: now,
      health: 'FAILED',
      reason: `${conflicts.length} overlapping executive authority conflict(s); ${invalidOrStaleAuthority.length} active-state expired lease(s).`,
      requiredAction: 'Revoke conflicting or expired authority and re-evaluate the command chain.',
      dependencyState: 'FAIL',
      dependencyFailures: [...node.dependencyFailures, ...(conflicts.length ? [`AUTHORITY_CONFLICT_${conflicts.length}`] : []), ...(invalidOrStaleAuthority.length ? [`STALE_AUTHORITY_${invalidOrStaleAuthority.length}`] : [])],
      evidence: { source: 'AUTHORITY_LEASE_EVENT_STORE_EVALUATOR', observedAt: now, recordReference: `AuthorityLease:${[...new Set([...conflicts.flatMap((conflict) => [conflict.leftLeaseId, conflict.rightLeaseId]), ...invalidOrStaleAuthority.map((lease) => lease.leaseId)])].join(',')}` },
    } : node);
    const qualifications = incidentCandidateNodes.map((node) => ({
      canonicalId: node.canonicalId,
      scopeId: node.scope,
      qualification: qualifyOperationalIncident({ canonicalId: node.canonicalId, status: node.status, runtimeMode: node.runtimeMode, runtimePresence: node.runtimePresence, workloadState: node.workloadState, dependencyState: node.dependencyState, dependencyFailures: node.dependencyFailures, reason: node.reason, evidenceReference: node.evidence.recordReference, evaluatedAt: now }),
    }));
    const incidentReconciliation = await this.reconcileOperationalIncidents(ctx, qualifications, operationalIncidentJournals);
    const operationalNodes = incidentCandidateNodes.map((node) => {
      const qualification = qualifications.find((item) => item.canonicalId === node.canonicalId)!.qualification;
      const openIncidentEventId = incidentReconciliation.openByCanonicalId.get(node.canonicalId) ?? null;
      return {
        ...node,
        incidents: incidentReconciliation.events.filter((event) => event.eventId === openIncidentEventId).map(toIncidentProjection),
        incidentQualification: { ...qualification, openIncidentEventId },
      };
    });
    const controlPlaneNode = operationalNodes.find((node) => node.canonicalId === AUTHORITY_CONTROL_PLANE_ID);
    const controlPlaneStatus = conflicts.length ? 'FAIL' : controlPlaneNode?.status ?? 'NO_TELEMETRY';
    const mandateById = new Map(mandates.map((mandate) => [mandate.id, mandate]));
    const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
    const activeCommandChains = leases.map((lease) => {
      const mandate = mandateById.get(lease.mandateId);
      const decision = lease.decisionId ? decisionById.get(lease.decisionId) : undefined;
      return { leaseId: lease.id, scopeId: lease.scopeId, agentId: lease.agentId, providerId: lease.providerId, mode: lease.mode, mandateId: lease.mandateId, mandateKey: mandate?.mandateKey ?? null, decisionId: lease.decisionId, decisionKey: decision?.decisionKey ?? null, actionType: decision?.actionType ?? null, epoch: lease.epoch, fencingToken: lease.fencingToken, issuedAt: lease.issuedAt, expiresAt: lease.expiresAt };
    });
    const opportunityIntelligence = evaluateOpportunityIntelligence(opportunityCount, opportunityTelemetry, conflicts.length, now);
    return {
      generatedAt: new Date().toISOString(), contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION,
      controlPlane: { canonicalId: AUTHORITY_CONTROL_PLANE_ID, status: controlPlaneStatus, statusSource: controlPlaneNode?.statusSource ?? 'NO_TELEMETRY', statusObservedAt: controlPlaneNode?.statusObservedAt ?? null, invariant: 'ONE SCOPE → ONE ACTIVE EXECUTIVE AUTHORITY', activeExecutiveAuthorities: leases.filter((lease) => lease.mode === 'EXECUTIVE').length, executiveAuthorityAgents: leases.filter((lease) => lease.mode === 'EXECUTIVE').map((lease) => lease.agentId), conflicts, activeCommandChains, delegatedAuthority: activeCommandChains.filter((chain) => chain.agentId !== 'agm.human.product-owner'), invalidOrStaleAuthority },
      nodes: operationalNodes,
      departments: [...new Set(operationalNodes.map((node) => node.module))].map((module) => ({ module, nodeCount: operationalNodes.filter((node) => node.module === module).length })),
      incidents: incidentReconciliation.events.map(toIncidentProjection),
      incidentPipeline: {
        contractVersion: OPERATIONAL_INCIDENT_CONTRACT,
        eventStore: 'AuthorityAuditJournal',
        evaluatedAt: now,
        nonHealthy: qualifications.filter((item) => !['PASS', 'STANDBY'].includes(incidentCandidateNodes.find((node) => node.canonicalId === item.canonicalId)!.status)).length,
        qualified: qualifications.filter((item) => item.qualification.decision === 'QUALIFIED').length,
        notRequired: qualifications.filter((item) => item.qualification.decision === 'NOT_REQUIRED' && !['PASS', 'STANDBY'].includes(incidentCandidateNodes.find((node) => node.canonicalId === item.canonicalId)!.status)).length,
        open: incidentReconciliation.openByCanonicalId.size,
        opened: incidentReconciliation.opened,
        resolved: incidentReconciliation.resolved,
      },
      telemetryInventory: {
        contractVersion: BASIC_AGENT_TELEMETRY_INVENTORY_CONTRACT,
        evaluatedAt: now,
        runtimeEventWindow: {
          source: 'AgentRuntimeEvent',
          loaded: runtimeEvents.length,
          limit: 1000,
          oldestLoadedAt: runtimeEvents.length ? runtimeEvents[runtimeEvents.length - 1].occurredAt : null,
        },
        latestRuntimeEvents: [...lastRunByAgent.values()].map((event) => ({
          agentId: event.agentId,
          eventId: event.eventId,
          mandateId: event.mandateId,
          lifecycle: event.lifecycle,
          occurredAt: event.occurredAt,
          recordedAt: event.recordedAt,
          evidenceRef: event.evidenceRef,
        })),
        componentHeartbeats: heartbeats.map((heartbeat) => ({
          componentId: heartbeat.componentId,
          recordId: heartbeat.id,
          reportedStatus: heartbeat.reportedStatus,
          lastSeenAt: heartbeat.lastSeenAt,
          lastSuccessAt: heartbeat.lastSuccessAt,
          lastFailureAt: heartbeat.lastFailureAt,
          lastFailureReason: heartbeat.lastFailureReason,
        })),
      },
      telemetryPolicy: 'OBSERVE_ONLY_NEVER_COMMAND_OR_BLOCK',
      capabilityGaps: operationalNodes.filter((node) => node.registryPresence === 'MISSING' || node.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED').map((node) => ({ canonicalId: node.canonicalId, reason: node.reason, requiredAction: node.requiredAction })),
      opportunityIntelligence,
      recovery: recovery ? { executionId: recovery.id, status: recovery.status, startedAt: recovery.startedAt, completedAt: recovery.completedAt } : { executionId: null, status: 'NO_ACTIVITY', startedAt: null, completedAt: null },
    };
  }

  async registry(ctx: RequestContext) {
    await this.ensureFoundation(ctx);
    return this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId }, orderBy: { canonicalId: 'asc' } });
  }

  registryReadOnly(companyId: string) {
    return this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId }, orderBy: { canonicalId: 'asc' } });
  }

  async agentAccountability(ctx: RequestContext) {
    const now = new Date();
    const dashboard = await this.dashboard(ctx);
    const [mandates, runtimeEvents, validationEvents, failoverState, failoverEvents] = await Promise.all([
      this.prisma.authorityMandate.findMany({ where: { companyId: ctx.companyId, status: 'APPROVED', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.agentRuntimeEvent.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'desc' }, take: ACCOUNTABILITY_EVIDENCE_LOOKBACK_LIMIT }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId, eventType: 'AGENT_ACCOUNTABILITY_VALIDATED' }, orderBy: { occurredAt: 'desc' }, take: ACCOUNTABILITY_EVIDENCE_LOOKBACK_LIMIT }),
      this.prisma.authorityFailoverState.findUnique({ where: { companyId_scopeId: { companyId: ctx.companyId, scopeId: 'premium.release' } } }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId, eventType: { in: ['INSPECTOR_MANDATE_TRANSFERRED', 'SECONDARY_VALIDATION_COMPLETED', 'CONTROL_COVERAGE_LOST', 'CONTROL_COVERAGE_RESTORED'] } }, orderBy: { occurredAt: 'desc' }, take: 100 }),
    ]);
    const mandateByAgent = firstBy(mandates, (item) => item.agentId);
    const runtimeByAgent = firstBy(runtimeEvents, (item) => item.agentId);
    const primaryEvent = runtimeByAgent.get(PRIMARY_INSPECTOR_ID);
    const secondaryEvent = runtimeByAgent.get(SECONDARY_INSPECTOR_ID);
    const transferEvent = failoverEvents.find((event) => event.eventType === 'INSPECTOR_MANDATE_TRANSFERRED');
    const latestControlEvent = failoverEvents[0];
    const coverageExplicitlyLost = latestControlEvent?.eventType === 'CONTROL_COVERAGE_LOST';
    const failover = evaluateInspectorFailover({
      primary: runtimeSignal(primaryEvent),
      secondary: runtimeSignal(secondaryEvent),
      transferObservedAt: transferEvent?.occurredAt ?? null,
      activeValidatorId: coverageExplicitlyLost ? null : failoverState?.activeProviderId ?? null,
      secondaryId: SECONDARY_INSPECTOR_ID,
      freshnessWindowMs: ACCOUNTABILITY_FRESHNESS_MS,
      now,
    });
    const controlIncident = failover.controlCoverage === 'INCOMPLETE' ? await this.recordControlCoverageLost(ctx, latestControlEvent) : null;
    const agents = dashboard.nodes.filter((node) => node.kind !== 'HUMAN_AUTHORITY').map((node) => {
      const seed = premiumNetworkSeed.find((item) => item.canonicalId === node.canonicalId)!;
      const profile = operationalProfile(seed);
      const execution = runtimeSignal(runtimeByAgent.get(node.canonicalId)) ?? nodeSignal(node);
      const mandate = mandateByAgent.get(node.canonicalId);
      const declaredOperational = Boolean(mandate);
      const validationEvent = validationEvents.find((event) => {
        const metadata = jsonRecord(event.safeMetadata);
        const validatorMandate = mandateByAgent.get(event.actorId);
        const { outputRef } = metadata;
        return Boolean(
          mandate
          && execution
          && event.outcome === 'PASS'
          && event.actorId !== node.canonicalId
          && validatorMandate?.id === event.mandateId
          && metadata.agentId === node.canonicalId
          && metadata.validatorId === event.actorId
          && metadata.validatorMandateId === event.mandateId
          && metadata.targetMandateId === mandate.id
          && metadata.executionEventId === execution.id
          && metadata.executionEvidenceRef === execution.evidenceRef
          && metadata.executionOutputRef === execution.outputRef
          && metadata.result === 'PASS'
          && typeof outputRef === 'string'
          && /^sha256:[a-f0-9]{64}$/i.test(outputRef)
          && outputRef === `sha256:${event.payloadHash}`
        );
      });
      const validationMetadata = validationEvent ? jsonRecord(validationEvent.safeMetadata) : {};
      const validation: AccountabilitySignal | null = validationEvent ? {
        id: validationEvent.eventId,
        mandateId: validationEvent.mandateId,
        status: validationEvent.outcome,
        occurredAt: validationEvent.occurredAt,
        evidenceRef: `AuthorityAuditJournal:${validationEvent.eventId}`,
        outputRef: typeof validationMetadata.outputRef === 'string' ? validationMetadata.outputRef : null,
      } : null;
      const evaluation = evaluateAgentAccountability({
        capabilityDeclared: profile.runtimeMode !== 'CAPABILITY_NOT_IMPLEMENTED',
        runtimeAbsent: node.runtimePresence === 'ABSENT',
        mandateId: mandate?.id ?? null,
        execution,
        validation,
        freshnessWindowMs: profile.freshnessWindowMs ?? ACCOUNTABILITY_FRESHNESS_MS,
        controlCoverageLost: failover.controlCoverage === 'INCOMPLETE',
        now,
      });
      return {
        identity: node.canonicalId,
        kind: node.kind,
        declaredOperational,
        operationalDeclaration: declaredOperational ? 'ACTIVE_AUTHORITY_MANDATE' : 'INACTIVE_NO_CURRENT_MANDATE',
        authorizationSource: mandate ? 'AUTHORITY_MANDATE' : 'NONE',
        responsibility: node.currentFunction,
        executable: evaluation.executable,
        mandate: evaluation.mandate,
        mandateId: mandate?.id ?? null,
        trigger: accountabilityTrigger(profile.runtimeMode, node.canonicalId),
        executionCondition: accountabilityFrequency(profile.runtimeMode),
        lastExecution: execution?.occurredAt ?? null,
        lastResult: execution?.status ?? 'NO EXECUTION',
        executionEventId: execution?.id ?? null,
        outputRef: execution?.outputRef ?? null,
        executionEvidenceRef: execution?.evidenceRef ?? null,
        validation: evaluation.validation,
        validator: typeof validationMetadata.validatorId === 'string' ? validationMetadata.validatorId : failoverState?.activeProviderId ?? PRIMARY_INSPECTOR_ID,
        validationEvidenceRef: validation?.evidenceRef ?? null,
        lastValidation: validation?.occurredAt ?? null,
        freshness: evaluation.freshness,
        freshnessWindowSeconds: Math.round((profile.freshnessWindowMs ?? ACCOUNTABILITY_FRESHNESS_MS) / 1000),
        status: evaluation.status,
        statusSource: 'IDENTITY_MANDATE_EXECUTION_EVIDENCE_VALIDATION_ENGINE',
        reason: evaluation.reason,
        openResponsibilities: evaluation.status === 'ACTIVE' ? [] : [node.requiredAction ?? evaluation.reason],
        stopFailDegradedCondition: 'STOP on revoked/expired mandate; FAIL on failed execution; DEGRADED on missing/stale validation; STALE beyond declared SLA.',
        failover: failover.status === 'PASS' ? 'PROVEN' : 'NOT PROVEN',
      };
    });
    const falseActive = falseActiveCount(agents);
    const unexplainedDegraded = agents.filter((agent) => agent.status === 'DEGRADED' && !agent.reason).length;
    const controlSystemComplete = agents.length > 0
      && agents.every((agent) => agent.identity && agent.responsibility && agent.trigger && agent.executionCondition && agent.statusSource && agent.validator
        && agent.declaredOperational && Boolean(agent.validationEvidenceRef))
      && falseActive === 0 && unexplainedDegraded === 0;
    const openIncidents = dashboard.incidentPipeline.open + (controlIncident ? 1 : 0);
    const fleetNodes = dashboard.nodes.filter((node) => node.kind !== 'HUMAN_AUTHORITY');
    const fleet = {
      total: fleetNodes.length,
      healthy: fleetNodes.filter((node) => node.health === 'HEALTHY').length,
      degraded: fleetNodes.filter((node) => node.health === 'DEGRADED').length,
      failed: fleetNodes.filter((node) => node.health === 'FAILED').length,
      noTelemetry: fleetNodes.filter((node) => node.health === 'UNKNOWN').length,
      standby: fleetNodes.filter((node) => node.status === 'STANDBY').length,
    };
    const operationalAgents = agents.filter((agent) => agent.declaredOperational);
    const operationalFleet = {
      total: operationalAgents.length,
      active: operationalAgents.filter((agent) => agent.status === 'ACTIVE').length,
      degraded: operationalAgents.filter((agent) => agent.status === 'DEGRADED').length,
      failed: operationalAgents.filter((agent) => ['FAIL', 'CONTROL COVERAGE LOST'].includes(agent.status)).length,
      noTelemetry: operationalAgents.filter((agent) => ['UNKNOWN / NO TELEMETRY', 'STALE', 'NOT EXECUTABLE'].includes(agent.status)).length,
      mandateNotDemonstrated: operationalAgents.filter((agent) => agent.mandate !== 'PROVEN').length,
      inactive: agents.length - operationalAgents.length,
    };
    const overallOperationalState = operationalFleet.total === agents.length && operationalFleet.total > 0 && operationalFleet.active === operationalFleet.total ? 'PASS' as const : 'FAIL' as const;
    const verdict = evaluateAgentRuntimeVerdict({
      controlSystemComplete,
      agents,
      inspectorFailover: failover.status,
      controlCoverage: failover.controlCoverage,
      overallOperationalState,
      falseActive,
      unexplainedDegraded,
      primaryRecovered: failover.primaryRecovered,
      openIncidents,
    });
    return {
      contractVersion: AGENT_ACCOUNTABILITY_CONTRACT,
      generatedAt: now,
      agents,
      fleet,
      operationalFleet,
      inspector: {
        contractVersion: INSPECTOR_FAILOVER_CONTRACT,
        primaryInspector: PRIMARY_INSPECTOR_ID,
        primaryStatus: primaryEvent?.lifecycle ?? 'NO TELEMETRY',
        secondaryInspector: SECONDARY_INSPECTOR_ID,
        secondaryStatus: secondaryEvent?.lifecycle ?? 'NO TELEMETRY',
        activeValidator: failoverState?.activeProviderId ?? null,
        mandateTransferred: failover.transferProven,
        transferReason: failoverState?.transitionReason ?? null,
        transferredAt: failoverState?.lastTransitionAt ?? null,
        lastValidation: secondaryEvent?.occurredAt ?? null,
        transferEvidenceRef: transferEvent ? `AuthorityAuditJournal:${transferEvent.eventId}` : null,
        status: failover.status,
        controlStatus: failover.controlStatus,
        primaryRecovered: failover.primaryRecovered,
        failoverPreserved: failover.status === 'PASS' && failover.transferProven && failover.secondaryValidationProven,
      },
      incidents: { eventStore: 'AuthorityAuditJournal', open: openIncidents, inspectorFailureIncident: dashboard.nodes.find((node) => node.canonicalId === PRIMARY_INSPECTOR_ID)?.incidentQualification?.openIncidentEventId ?? controlIncident?.eventId ?? null, controlCoverageIncident: controlIncident?.eventId ?? (coverageExplicitlyLost ? latestControlEvent?.eventId ?? null : null) },
      verdict,
    };
  }

  private async recordControlCoverageLost(ctx: RequestContext, latestControlEvent: OperationalJournalEvent | undefined) {
    if (latestControlEvent?.eventType === 'CONTROL_COVERAGE_LOST') return latestControlEvent;
    const eventId = randomUUID();
    const incidentId = randomUUID();
    const metadata = { contractVersion: INSPECTOR_FAILOVER_CONTRACT, primaryInspector: PRIMARY_INSPECTOR_ID, secondaryInspector: SECONDARY_INSPECTOR_ID, controlCoverage: 'LOST', rationale: 'Primary inspection is unavailable and no current secondary validation proves coverage.' };
    const payloadHash = hash(metadata);
    await this.prisma.$transaction(async (tx) => {
      await tx.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId, eventType: 'CONTROL_COVERAGE_LOST', scopeId: 'premium.release', actorType: 'SYSTEM', actorId: 'agm.inspector-failover-controller', outcome: 'FAIL', reasonCode: 'NO_CURRENT_VALIDATOR', payloadHash, safeMetadata: json(metadata), correlationId: ctx.correlationId } });
      await tx.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId: incidentId, eventType: 'OPERATIONAL_INCIDENT_OPENED', scopeId: 'premium.release', actorType: 'SYSTEM', actorId: 'agm.inspector-failover-controller', outcome: 'OPEN', reasonCode: 'CONTROL_COVERAGE_LOST', payloadHash, safeMetadata: json({ ...metadata, evidenceReference: `AuthorityAuditJournal:${eventId}`, severity: 'CRITICAL' }), correlationId: ctx.correlationId } });
    });
    return { eventId } as OperationalJournalEvent;
  }

  async executeInspectorFailoverExercise(companyId: string, machineId: string) {
    const ctx: RequestContext = { companyId, userId: '00000000-0000-0000-0000-000000000001', roles: ['PRODUCT_OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
    await this.ensureFoundation(ctx);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ACCOUNTABILITY_FRESHNESS_MS);
    const inspectionReadSet = ['registry.read', 'telemetry.read', 'evidence.read'];
    const prohibitedActions = ['business.write', 'authority.expand', 'secret.read', 'production.deploy'];
    const mandates = await this.prisma.$transaction(async (tx) => Promise.all([PRIMARY_INSPECTOR_ID, SECONDARY_INSPECTOR_ID].map((agentId) => tx.authorityMandate.upsert({
      where: { companyId_mandateKey: { companyId, mandateKey: inspectorMandateKey(agentId) } },
      create: { companyId, mandateKey: inspectorMandateKey(agentId), scopeId: agentId === PRIMARY_INSPECTOR_ID ? 'premium.release' : 'premium.architecture', agentId, mode: 'INSPECTOR', contractHash: hash({ contract: INSPECTION_MANDATE_VERSION, agentId, inspectionReadSet, prohibitedActions }), readSet: json(inspectionReadSet), writeSet: json([]), resourceSelectors: json([]), prohibitedActions: json(prohibitedActions), approvedByUserId: ctx.userId, issuedAt, expiresAt },
      update: { status: 'APPROVED', revokedAt: null, expiresAt, readSet: json(inspectionReadSet), writeSet: json([]), resourceSelectors: json([]), prohibitedActions: json(prohibitedActions), contractHash: hash({ contract: INSPECTION_MANDATE_VERSION, agentId, inspectionReadSet, prohibitedActions }), version: { increment: 1 } },
    }))));
    const primaryMandate = mandates.find((item) => item.agentId === PRIMARY_INSPECTOR_ID)!;
    const operationalMandates = await this.prisma.$transaction(async (tx) => Promise.all(premiumNetworkSeed
      .filter((seed) => seed.kind !== 'HUMAN_AUTHORITY' && ![PRIMARY_INSPECTOR_ID, SECONDARY_INSPECTOR_ID].includes(seed.canonicalId))
      .map((seed) => tx.authorityMandate.upsert({
        where: { companyId_mandateKey: { companyId, mandateKey: `operational-duty:${seed.canonicalId}` } },
        create: { companyId, mandateKey: `operational-duty:${seed.canonicalId}`, scopeId: seed.scope, agentId: seed.canonicalId, mode: 'OPERATIONAL_DUTY', contractHash: hash({ contract: 'agent-operational-duty.v1', agentId: seed.canonicalId, readSet: seed.readPermissions }), readSet: json(seed.readPermissions), writeSet: json([]), resourceSelectors: json([]), prohibitedActions: json(Array.from(new Set(seed.prohibitedActions.concat(prohibitedActions)))), approvedByUserId: ctx.userId, issuedAt, expiresAt },
        update: { status: 'APPROVED', revokedAt: null, expiresAt, readSet: json(seed.readPermissions), writeSet: json([]), resourceSelectors: json([]), prohibitedActions: json(Array.from(new Set(seed.prohibitedActions.concat(prohibitedActions)))), contractHash: hash({ contract: 'agent-operational-duty.v1', agentId: seed.canonicalId, readSet: seed.readPermissions }), version: { increment: 1 } },
      }))));
    const allMandates = mandates.concat(operationalMandates);
    if (allMandates.length !== premiumNetworkSeed.filter((seed) => seed.kind !== 'HUMAN_AUTHORITY').length) throw new ConflictException('NON_HUMAN_MANDATE_COVERAGE_INCOMPLETE');

    const secondaryMandate = mandates.find((item) => item.agentId === SECONDARY_INSPECTOR_ID)!;
    const runId = randomUUID();
    const failureEventId = randomUUID();
    const transferEventId = randomUUID();
    const failureAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.agentRuntimeEvent.create({ data: { companyId, eventId: failureEventId, mandateId: primaryMandate.id, agentId: PRIMARY_INSPECTOR_ID, dossierId: `inspector-failover-${runId}`, lifecycle: 'FAILED', sequence: 1, occurredAt: failureAt, evidenceRef: `urn:agm:controlled-inspector-failure:${runId}`, outputRef: `urn:agm:incident:${failureEventId}`, evidenceHash: hash({ runId, injectedFailure: true }), detail: 'CONTROLLED_PRODUCTION_FAILOVER_EXERCISE: primary validation unavailable.' } });
      const incidentMetadata = { contractVersion: OPERATIONAL_INCIDENT_CONTRACT, canonicalId: PRIMARY_INSPECTOR_ID, decision: 'QUALIFIED', severity: 'CRITICAL', rootCauseClassification: 'RUNTIME_FAILURE', rationale: 'Chief Inspector failed during controlled Production failover exercise.', evidenceReference: `AgentRuntimeEvent:${failureEventId}` };
      await tx.authorityAuditJournal.create({ data: { companyId, eventId: randomUUID(), eventType: 'OPERATIONAL_INCIDENT_OPENED', scopeId: 'premium.release', mandateId: primaryMandate.id, actorType: 'MACHINE', actorId: machineId, outcome: 'OPEN', reasonCode: 'CHIEF_INSPECTOR_FAILED', payloadHash: hash(incidentMetadata), safeMetadata: json(incidentMetadata), correlationId: ctx.correlationId } });
      await tx.authorityFailoverState.upsert({ where: { companyId_scopeId: { companyId, scopeId: 'premium.release' } }, create: { companyId, scopeId: 'premium.release', primaryProviderId: PRIMARY_INSPECTOR_ID, activeProviderId: SECONDARY_INSPECTOR_ID, state: 'TRANSFERRED', epoch: 1, lastTransitionAt: failureAt, transitionReason: 'PRIMARY_INSPECTOR_FAILED' }, update: { primaryProviderId: PRIMARY_INSPECTOR_ID, activeProviderId: SECONDARY_INSPECTOR_ID, state: 'TRANSFERRED', activeLeaseId: null, epoch: { increment: 1 }, lastTransitionAt: failureAt, transitionReason: 'PRIMARY_INSPECTOR_FAILED', version: { increment: 1 } } });
      const transferMetadata = { contractVersion: INSPECTOR_FAILOVER_CONTRACT, from: PRIMARY_INSPECTOR_ID, to: SECONDARY_INSPECTOR_ID, runId, failureEventId };
      await tx.authorityAuditJournal.create({ data: { companyId, eventId: transferEventId, eventType: 'INSPECTOR_MANDATE_TRANSFERRED', scopeId: 'premium.release', mandateId: secondaryMandate.id, actorType: 'SYSTEM', actorId: 'agm.inspector-failover-controller', outcome: 'PASS', reasonCode: 'PRIMARY_INSPECTOR_FAILED', payloadHash: hash(transferMetadata), safeMetadata: json(transferMetadata), correlationId: ctx.correlationId, occurredAt: new Date(failureAt.getTime() + 1) } });
      await tx.agentRuntimeEvent.createMany({ data: [
        { companyId, eventId: randomUUID(), mandateId: secondaryMandate.id, agentId: SECONDARY_INSPECTOR_ID, dossierId: `inspector-failover-${runId}`, lifecycle: 'STARTED', sequence: 1, occurredAt: new Date(failureAt.getTime() + 2), evidenceRef: `AuthorityAuditJournal:${transferEventId}`, detail: 'Secondary Inspector accepted transferred validation mandate.' },
        { companyId, eventId: randomUUID(), mandateId: secondaryMandate.id, agentId: SECONDARY_INSPECTOR_ID, dossierId: `inspector-failover-${runId}`, lifecycle: 'WORKING', sequence: 2, occurredAt: new Date(failureAt.getTime() + 3), evidenceRef: `AuthorityAuditJournal:${transferEventId}`, detail: 'Secondary Inspector validating identity, mandate, execution, output, evidence and freshness.' },
      ] });
    });
    const dashboard = await this.dashboard(ctx);
    const validationAt = new Date();
    const validationOutput = { runId, registryNodes: dashboard.nodes.length, evaluatedAgents: dashboard.nodes.filter((item) => item.kind !== 'HUMAN_AUTHORITY').length, primaryFailureEventId: failureEventId, transferEventId };
    const validationHash = hash(validationOutput);
    const completedEventId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.agentRuntimeEvent.create({ data: { companyId, eventId: completedEventId, mandateId: secondaryMandate.id, agentId: SECONDARY_INSPECTOR_ID, dossierId: `inspector-failover-${runId}`, lifecycle: 'COMPLETED', sequence: 3, occurredAt: validationAt, evidenceRef: `AuthorityAuditJournal:${transferEventId}`, outputRef: `sha256:${validationHash}`, evidenceHash: validationHash, detail: JSON.stringify(validationOutput) } });
      const completedMetadata = { ...validationOutput, completedEventId, evidenceHash: validationHash };
      await tx.authorityAuditJournal.create({ data: { companyId, eventId: randomUUID(), eventType: 'SECONDARY_VALIDATION_COMPLETED', scopeId: 'premium.release', mandateId: secondaryMandate.id, actorType: 'AGENT', actorId: SECONDARY_INSPECTOR_ID, outcome: 'PASS', payloadHash: validationHash, safeMetadata: json(completedMetadata), correlationId: ctx.correlationId, occurredAt: new Date(validationAt.getTime() + 2) } });
      await tx.authorityAuditJournal.create({ data: { companyId, eventId: randomUUID(), eventType: 'CONTROL_COVERAGE_RESTORED', scopeId: 'premium.release', mandateId: secondaryMandate.id, actorType: 'SYSTEM', actorId: 'agm.inspector-failover-controller', outcome: 'PASS', payloadHash: validationHash, safeMetadata: json({ runId, activeValidator: SECONDARY_INSPECTOR_ID, uncoveredZones: 0 }), correlationId: ctx.correlationId, occurredAt: new Date(validationAt.getTime() + 3) } });
    });
    const domainDutyResults = await this.executeDomainReadDuties(ctx, secondaryMandate.id, runId);
    const fleetDutyResults = await this.operationalDuties.execute(ctx, allMandates, runId);
    const inspection = await this.inspectOperationalCapabilities(ctx);
    const inspectorValidations = [];
    for (const target of [
      { agentId: PRIMARY_INSPECTOR_ID, targetMandateId: primaryMandate.id, validatorId: SECONDARY_INSPECTOR_ID, validatorMandateId: secondaryMandate.id, scopeId: 'premium.release' },
      { agentId: SECONDARY_INSPECTOR_ID, targetMandateId: secondaryMandate.id, validatorId: PRIMARY_INSPECTOR_ID, validatorMandateId: primaryMandate.id, scopeId: 'premium.architecture' },
    ]) {
      const execution = inspection.evaluations.find((item) => item.agentId === target.agentId);
      if (!execution?.passed || !execution.runtimeEventId || !execution.evidenceRef || !execution.outputRef || !execution.evidenceHash) continue;
      const validatedAt = new Date(Math.max(Date.now(), inspection.evaluatedAt.getTime() + 1));
      const safeMetadata = { contractVersion: AGENT_ACCOUNTABILITY_CONTRACT, agentId: target.agentId, validatorId: target.validatorId, validatorMandateId: target.validatorMandateId, targetMandateId: target.targetMandateId, executionEventId: execution.runtimeEventId, executionEvidenceRef: execution.evidenceRef, executionOutputRef: execution.outputRef, executionEvidenceHash: execution.evidenceHash, validatedAt: validatedAt.toISOString(), result: 'PASS', runId };
      const outputRef = `sha256:${hash(safeMetadata)}`;
      const receipt = await this.prisma.authorityAuditJournal.create({ data: { companyId, eventId: randomUUID(), eventType: 'AGENT_ACCOUNTABILITY_VALIDATED', scopeId: target.scopeId, mandateId: target.validatorMandateId, actorType: 'AGENT', actorId: target.validatorId, outcome: 'PASS', payloadHash: hash(safeMetadata), safeMetadata: json({ ...safeMetadata, outputRef }), correlationId: ctx.correlationId, occurredAt: validatedAt } });
      inspectorValidations.push({ agentId: target.agentId, validatorId: target.validatorId, executionEventId: execution.runtimeEventId, validationEventId: receipt.eventId, outputRef });
    }
    await this.dashboard(ctx);
    const fleetValidations = await this.validateOperationalDutyResults(ctx, fleetDutyResults, secondaryMandate, runId);
    if (fleetValidations.length !== fleetDutyResults.length) throw new ConflictException('NON_HUMAN_DUTY_VALIDATION_INCOMPLETE');
    return { ...(await this.agentAccountability(ctx)), recovery: { runId, domainDutyResults, inspectorEvaluations: inspection.evaluations, inspectorValidations } };
  }

  private async validateOperationalDutyResults(
    ctx: RequestContext,
    executions: readonly OperationalAgentDutyResult[],
    validatorMandate: { id: string },
    runId: string,
  ) {
    const validations = [];
    for (const execution of executions) {
      if (!execution.passed) continue;
      const seed = premiumNetworkSeed.find((item) => item.canonicalId === execution.agentId)!;
      const validatedAt = new Date(Math.max(Date.now(), new Date(execution.executedAt).getTime() + 1));
      const safeMetadata = { contractVersion: AGENT_ACCOUNTABILITY_CONTRACT, agentId: execution.agentId, validatorId: SECONDARY_INSPECTOR_ID, validatorMandateId: validatorMandate.id, targetMandateId: execution.mandateId, executionEventId: execution.executionEventId, executionEvidenceRef: execution.evidenceRef, executionOutputRef: execution.outputRef, executionEvidenceHash: execution.outputRef.replace('sha256:', ''), validatedAt: validatedAt.toISOString(), result: 'PASS', runId };
      const outputRef = `sha256:${hash(safeMetadata)}`;
      const receipt = await this.prisma.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId: randomUUID(), eventType: 'AGENT_ACCOUNTABILITY_VALIDATED', scopeId: seed.scope, mandateId: validatorMandate.id, actorType: 'AGENT', actorId: SECONDARY_INSPECTOR_ID, outcome: 'PASS', payloadHash: hash(safeMetadata), safeMetadata: json({ ...safeMetadata, outputRef }), correlationId: ctx.correlationId, occurredAt: validatedAt } });
      validations.push({ agentId: execution.agentId, validatorId: SECONDARY_INSPECTOR_ID, executionEventId: execution.executionEventId, validationEventId: receipt.eventId, outputRef });
    }
    return validations;
  }

  private async executeDomainReadDuties(ctx: RequestContext, validatorMandateId: string, runId: string) {
    type DutyResult = { canonicalId: string; scopeId: string; operation: string; passed: boolean; reason: string | null; evidenceReferences: string[]; checks: Record<string, unknown> };
    type JobRow = { id: string };
    type IncidentRow = { id: string; status: string; severity: string; transportJobId: string };
    type EvidenceRow = { id: string; evidenceType: string; storageProvider: string; storageKey: string; checksumSha256: string | null };
    type JobFile = { contractVersion: string; subjectId: string; timeline: Array<Record<string, unknown>>; auditReferences: readonly string[]; financialEntries: Array<Record<string, unknown>>; invoices: Array<Record<string, unknown>>; analysis: { entryCount: number } };
    const providers = this.discovery.getProviders().map((wrapper) => wrapper.instance as unknown).filter((instance): instance is Record<string, unknown> => Boolean(instance && typeof instance === 'object'));
    const carMover = providers.find((provider) => provider.constructor.name === 'CarMoverService') as unknown as { list(context: RequestContext): Promise<JobRow[]>; getJobFile(id: string, context: RequestContext): Promise<JobFile> } | undefined;
    const incidents = providers.find((provider) => provider.constructor.name === 'IncidentsService') as unknown as { list(context: RequestContext): Promise<IncidentRow[]> } | undefined;
    const evidence = providers.find((provider) => provider.constructor.name === 'EvidenceService') as unknown as { list(context: RequestContext): Promise<EvidenceRow[]> } | undefined;
    const dutyContext: RequestContext = { ...ctx, roles: [...new Set([...ctx.roles, 'PREMIUM_ACCESS'])] };
    const results: DutyResult[] = [];
    if (!carMover) {
      results.push(
        { canonicalId: 'premium.car-mover.job-service', scopeId: 'premium.car-mover', operation: 'CarMoverService.list + getJobFile', passed: false, reason: 'RUNTIME_PROVIDER_NOT_LOADED', evidenceReferences: [], checks: {} },
        { canonicalId: 'premium.car-mover.primary-accounting', scopeId: 'premium.car-mover', operation: 'CarMoverService.getJobFile financial projection', passed: false, reason: 'RUNTIME_PROVIDER_NOT_LOADED', evidenceReferences: [], checks: {} },
      );
    } else {
      try {
        const jobs = await carMover.list(dutyContext);
        const jobFiles = await Promise.all(jobs.map((job) => carMover.getJobFile(job.id, dutyContext)));
        const jobFile = jobFiles[0];
        const accountingFile = jobFiles.find((file) => file.financialEntries.length > 0);
        const jobPassed = Boolean(jobFile && jobFile.contractVersion === 'car-mover-job-file.v1' && jobFile.subjectId === jobs[0]?.id && jobFile.timeline.length > 0 && jobFile.auditReferences.length > 0 && jobFile.timeline.every((event) => typeof event.eventId === 'string' && typeof event.aggregateVersion === 'number'));
        results.push({ canonicalId: 'premium.car-mover.job-service', scopeId: 'premium.car-mover', operation: 'CarMoverService.list + getJobFile', passed: jobPassed, reason: jobPassed ? null : 'JOB_FILE_INTEGRITY_NOT_PROVEN', evidenceReferences: jobFile ? [`CarMoverJob:${jobFile.subjectId}`, ...jobFile.auditReferences.map((id) => `AuditEvent:${id}`)] : [], checks: { returnedJobs: jobs.length, subjectId: jobFile?.subjectId ?? null, contractVersion: jobFile?.contractVersion ?? null, timelineEvents: jobFile?.timeline.length ?? 0, auditReferences: jobFile?.auditReferences.length ?? 0 } });
        const ledgerPassed = Boolean(accountingFile && accountingFile.financialEntries.length > 0 && accountingFile.analysis.entryCount === accountingFile.financialEntries.length && accountingFile.financialEntries.every((entry) => typeof entry.id === 'string' && typeof entry.entryType === 'string' && typeof entry.currencyCode === 'string' && entry.amount !== undefined));
        results.push({ canonicalId: 'premium.car-mover.primary-accounting', scopeId: 'premium.car-mover', operation: 'CarMoverService.getJobFile financial projection', passed: ledgerPassed, reason: ledgerPassed ? null : 'PRIMARY_LEDGER_INTEGRITY_NOT_PROVEN', evidenceReferences: accountingFile ? [`CarMoverJob:${accountingFile.subjectId}`, ...accountingFile.financialEntries.map((entry) => `CarMoverFinancialEntry:${String(entry.id)}`)] : [], checks: { subjectId: accountingFile?.subjectId ?? null, financialEntries: accountingFile?.financialEntries.length ?? 0, invoices: accountingFile?.invoices.length ?? 0, analyzedEntryCount: accountingFile?.analysis.entryCount ?? 0 } });
      } catch (error) {
        const reason = `REAL_DUTY_FAILED:${error instanceof Error ? error.constructor.name : 'UNKNOWN'}`;
        results.push(
          { canonicalId: 'premium.car-mover.job-service', scopeId: 'premium.car-mover', operation: 'CarMoverService.list + getJobFile', passed: false, reason, evidenceReferences: [], checks: {} },
          { canonicalId: 'premium.car-mover.primary-accounting', scopeId: 'premium.car-mover', operation: 'CarMoverService.getJobFile financial projection', passed: false, reason, evidenceReferences: [], checks: {} },
        );
      }
    }
    try {
      const rows = incidents ? await incidents.list(dutyContext) : [];
      const knownStatuses = new Set(['open', 'investigating', 'resolved', 'validated', 'archived']);
      const passed = Boolean(incidents && rows.length > 0 && rows.every((item) => Boolean(item.id && item.transportJobId && item.severity) && knownStatuses.has(item.status)));
      results.push({ canonicalId: 'premium.car-mover.incident-service', scopeId: 'premium.car-mover', operation: 'IncidentsService.list', passed, reason: passed ? null : incidents ? 'INCIDENT_STORE_INTEGRITY_NOT_PROVEN' : 'RUNTIME_PROVIDER_NOT_LOADED', evidenceReferences: rows.map((item) => `IncidentReport:${item.id}`), checks: { returnedIncidents: rows.length, openIncidents: rows.filter((item) => !['resolved', 'validated', 'archived'].includes(item.status)).length } });
    } catch (error) {
      results.push({ canonicalId: 'premium.car-mover.incident-service', scopeId: 'premium.car-mover', operation: 'IncidentsService.list', passed: false, reason: `REAL_DUTY_FAILED:${error instanceof Error ? error.constructor.name : 'UNKNOWN'}`, evidenceReferences: [], checks: {} });
    }
    try {
      const rows = evidence ? await evidence.list(dutyContext) : [];
      const passed = Boolean(evidence && rows.length > 0 && rows.every((item) => Boolean(item.id && item.evidenceType && item.storageProvider && item.storageKey) && (!item.checksumSha256 || /^[a-f0-9]{64}$/i.test(item.checksumSha256))));
      results.push({ canonicalId: 'premium.car-mover.evidence-service', scopeId: 'premium.car-mover', operation: 'EvidenceService.list', passed, reason: passed ? null : evidence ? 'EVIDENCE_STORE_INTEGRITY_NOT_PROVEN' : 'RUNTIME_PROVIDER_NOT_LOADED', evidenceReferences: rows.map((item) => `EvidenceMetadata:${item.id}`), checks: { returnedEvidence: rows.length, checksumsPresent: rows.filter((item) => Boolean(item.checksumSha256)).length } });
    } catch (error) {
      results.push({ canonicalId: 'premium.car-mover.evidence-service', scopeId: 'premium.car-mover', operation: 'EvidenceService.list', passed: false, reason: `REAL_DUTY_FAILED:${error instanceof Error ? error.constructor.name : 'UNKNOWN'}`, evidenceReferences: [], checks: {} });
    }
    const executedAt = new Date();
    for (const result of results) {
      const evidenceSetHash = hash(result.evidenceReferences.slice().sort());
      const output = { contract: DOMAIN_SERVICE_VALIDATION_CONTRACT, executionKind: 'REAL_DOMAIN_SERVICE_DUTY', canonicalId: result.canonicalId, operation: result.operation, checks: result.checks, evidenceReferences: result.evidenceReferences.slice(0, 100), evidenceSetHash, validatorId: SECONDARY_INSPECTOR_ID, validatorMandateId, executedAt: executedAt.toISOString(), result: result.passed ? 'PASS' : 'FAIL', reason: result.reason, runId };
      await this.prisma.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId: randomUUID(), eventType: 'DOMAIN_SERVICE_VALIDATED', scopeId: result.scopeId, mandateId: validatorMandateId, actorType: 'AGENT', actorId: SECONDARY_INSPECTOR_ID, outcome: result.passed ? 'PASS' : 'FAIL', reasonCode: result.reason ?? undefined, payloadHash: hash(output), safeMetadata: json({ ...output, outputRef: `sha256:${hash(output)}` }), correlationId: ctx.correlationId, occurredAt: executedAt } });
    }
    return results.map((result) => ({ canonicalId: result.canonicalId, operation: result.operation, passed: result.passed, reason: result.reason, evidenceReferences: result.evidenceReferences, checks: result.checks }));
  }

  async inspectOperationalCapabilities(ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    const now = new Date();
    const [registry, scopes, heartbeat, inspectorMandates] = await Promise.all([
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityScopePolicy.findMany({ where: { companyId: ctx.companyId, status: 'ACTIVE' } }),
      this.prisma.componentHeartbeat.findUnique({ where: { companyId_componentId: { companyId: ctx.companyId, componentId: AUTHORITY_CONTROL_PLANE_ID } } }),
      this.prisma.authorityMandate.findMany({ where: { companyId: ctx.companyId, agentId: { in: [PRIMARY_INSPECTOR_ID, SECONDARY_INSPECTOR_ID] }, status: 'APPROVED', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { issuedAt: 'desc' } }),
    ]);
    const mandateByAgent = firstBy(inspectorMandates, (item) => item.agentId);
    const expectedIds = new Set(premiumNetworkSeed.map((node) => node.canonicalId));
    const actualIds = new Set(registry.map((node) => node.canonicalId));
    const architectureChecks = {
      registryComplete: expectedIds.size === actualIds.size && [...expectedIds].every((id) => actualIds.has(id)),
      scopesPresent: authorityScopeSeed.every((scope) => scopes.some((item) => item.scopeId === scope.scopeId)),
      telemetryBindingsComplete: premiumNetworkSeed.every((node) => operationalProfile(node).expectedSource !== 'NONE'),
    };
    const heartbeatEvidence = safeObject(heartbeat?.lastDetail);
    const referencedRuntimeEventId = typeof heartbeatEvidence.runtimeEventId === 'string' ? heartbeatEvidence.runtimeEventId : null;
    const releaseEvent = referencedRuntimeEventId ? await this.prisma.agentRuntimeEvent.findFirst({ where: { companyId: ctx.companyId, agentId: AUTHORITY_CONTROL_PLANE_ID, eventId: referencedRuntimeEventId } }) : null;
    const releaseChecks = {
      runtimeEventPresent: Boolean(releaseEvent),
      heartbeatPresent: Boolean(heartbeat),
      correlated: Boolean(releaseEvent && heartbeatEvidence.runtimeEventId === releaseEvent.eventId),
      fresh: Boolean(heartbeat && now.getTime() - heartbeat.lastSeenAt.getTime() <= TURN_OPERATIONAL_TRUTH_CONTRACT.freshnessWindowMs),
      healthy: heartbeat?.reportedStatus === 'ONLINE',
    };
    const evaluations = [
      { agentId: 'premium.architecture-inspector', checks: architectureChecks, passed: Object.values(architectureChecks).every(Boolean), evidenceRef: `PremiumNetworkRegistryEntry:${registry.length};AuthorityScopePolicy:${scopes.length}` },
      { agentId: 'premium.release-inspector', checks: releaseChecks, passed: Object.values(releaseChecks).every(Boolean), evidenceRef: `AgentRuntimeEvent:${releaseEvent?.eventId ?? 'MISSING'};ComponentHeartbeat:${heartbeat?.id ?? 'MISSING'}` },
    ];
    const persistedEvaluations: Array<(typeof evaluations)[number] & { runtimeEventId: string; outputRef: string | null; evidenceHash: string | null }> = [];
    for (const evaluation of evaluations) {
      const activeMandate = mandateByAgent.get(evaluation.agentId);
      if (!activeMandate) throw new ConflictException('ACTIVE_INSPECTOR_MANDATE_REQUIRED');
      const output = { contract: AGENT_ACCOUNTABILITY_CONTRACT, agentId: evaluation.agentId, checks: evaluation.checks, result: evaluation.passed ? 'PASS' : 'FAIL' };
      const evidenceHash = hash(output);
      const event = await this.prisma.agentRuntimeEvent.create({ data: {
        companyId: ctx.companyId, eventId: randomUUID(), mandateId: activeMandate.id,
        agentId: evaluation.agentId, dossierId: `turn-operational-inspection-${evaluation.agentId}-${now.getTime()}`,
        lifecycle: evaluation.passed ? 'COMPLETED' : 'FAILED', sequence: 1, occurredAt: now,
        evidenceRef: evaluation.evidenceRef, outputRef: `sha256:${evidenceHash}`, evidenceHash, detail: JSON.stringify(output),
      } });
      await this.journal(this.prisma, ctx, { eventType: evaluation.passed ? 'OPERATIONAL_INSPECTION_COMPLETED' : 'OPERATIONAL_INSPECTION_FAILED', scopeId: evaluation.agentId === 'premium.release-inspector' ? 'premium.release' : 'premium.architecture', mandateId: activeMandate.id, outcome: evaluation.passed ? 'PASS' : 'FAIL', reasonCode: evaluation.passed ? undefined : 'INSPECTION_CHECK_FAILED', safeMetadata: { agentId: evaluation.agentId, checks: evaluation.checks, runtimeEventId: event.eventId, outputRef: `sha256:${evidenceHash}` } });
      persistedEvaluations.push({ ...evaluation, runtimeEventId: event.eventId, outputRef: event.outputRef, evidenceHash: event.evidenceHash });
    }
    return { evaluatedAt: now, evaluations: persistedEvaluations };
  }

  async createMandate(dto: CreateMandateDto, ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    await this.ensureFoundation(ctx);
    const scopeId = normalizeScope(dto.scopeId);
    const [scope, agent] = await Promise.all([
      this.prisma.authorityScopePolicy.findUnique({ where: { companyId_scopeId: { companyId: ctx.companyId, scopeId } } }),
      this.prisma.premiumNetworkRegistryEntry.findUnique({ where: { companyId_canonicalId: { companyId: ctx.companyId, canonicalId: dto.agentId } } }),
    ]);
    if (!scope) throw new BadRequestException('UNKNOWN_AUTHORITY_SCOPE');
    if (!agent) throw new BadRequestException('UNREGISTERED_AUTHORITY_AGENT');
    if (dto.writeSet.some((command) => dto.prohibitedActions.some((blocked) => isCommandAllowed(blocked, [command])))) throw new BadRequestException('MANDATE_PROHIBITED_ACTION');
    const canonical = { scopeId, agentId: dto.agentId, mode: dto.mode, readSet: dto.readSet, writeSet: dto.writeSet, resourceSelectors: dto.resourceSelectors, prohibitedActions: dto.prohibitedActions };
    const mandate = await this.prisma.authorityMandate.create({ data: {
      companyId: ctx.companyId, mandateKey: dto.mandateKey, ...canonical,
      contractHash: hash(canonical), approvedByUserId: ctx.userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      readSet: json(dto.readSet), writeSet: json(dto.writeSet), resourceSelectors: json(dto.resourceSelectors), prohibitedActions: json(dto.prohibitedActions),
    } });
    await this.journal(this.prisma, ctx, { eventType: 'MANDATE_ISSUED', scopeId, mandateId: mandate.id, outcome: 'PASS', safeMetadata: { mandateKey: dto.mandateKey, agentId: dto.agentId, mode: dto.mode } });
    return mandate;
  }

  async createDecision(dto: CreateDecisionDto, ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    const mandate = await this.prisma.authorityMandate.findFirst({ where: { id: dto.mandateId, companyId: ctx.companyId, status: 'APPROVED', revokedAt: null } });
    if (!mandate) throw new NotFoundException('ACTIVE_MANDATE_NOT_FOUND');
    const decision = await this.prisma.authorityDecision.create({ data: { companyId: ctx.companyId, decisionKey: dto.decisionKey, mandateId: mandate.id, proposalRef: dto.proposalRef, actionType: dto.actionType, subjectType: dto.subjectType, subjectId: dto.subjectId, decision: json(dto.decision), decidedByUserId: ctx.userId } });
    await this.journal(this.prisma, ctx, { eventType: 'DECISION_RECORDED', scopeId: mandate.scopeId, mandateId: mandate.id, decisionId: decision.id, outcome: 'PASS', safeMetadata: { decisionKey: dto.decisionKey, actionType: dto.actionType } });
    return decision;
  }

  async issueLease(dto: IssueLeaseDto, ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    try {
      return await this.prisma.$transaction((tx) => this.issueLeaseInTransaction(tx, dto, ctx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof ConflictException && error.message === 'NO_OVERLAPPING_EXECUTIVE_WRITE_AUTHORITY') {
        const mandate = await this.prisma.authorityMandate.findFirst({ where: { id: dto.mandateId, companyId: ctx.companyId } });
        await this.journal(this.prisma, ctx, { eventType: 'AUTHORITY_CONFLICT_REJECTED', scopeId: mandate?.scopeId, mandateId: mandate?.id, outcome: 'REJECTED', reasonCode: 'OVERLAPPING_EXECUTIVE_WRITE_AUTHORITY', safeMetadata: { requestId: dto.requestId, leaseKey: dto.leaseKey } });
      }
      throw error;
    }
  }

  async handoff(dto: HandoffLeaseDto, ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.authorityLease.findFirst({ where: { id: dto.previousLeaseId, companyId: ctx.companyId, state: { in: ACTIVE_LEASE_STATES } } });
      if (!previous) throw new NotFoundException('ACTIVE_PREVIOUS_LEASE_NOT_FOUND');
      await tx.authorityLease.update({ where: { id: previous.id }, data: { state: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } } });
      await this.journal(tx, ctx, { eventType: 'AUTHORITY_HANDOFF_REVOKE', scopeId: previous.scopeId, mandateId: previous.mandateId, leaseId: previous.id, outcome: 'PASS', safeMetadata: { reason: dto.reason, previousProviderId: previous.providerId } });
      const next = await this.issueLeaseInTransaction(tx, dto, ctx);
      await this.journal(tx, ctx, { eventType: 'AUTHORITY_HANDOFF_COMPLETE', scopeId: next.scopeId, mandateId: next.mandateId, leaseId: next.id, outcome: 'PASS', safeMetadata: { reason: dto.reason, previousLeaseId: previous.id, nextProviderId: next.providerId } });
      return next;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async revokeLease(leaseId: string, reason: string, ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    return this.prisma.$transaction(async (tx) => {
      const lease = await tx.authorityLease.findFirst({ where: { id: leaseId, companyId: ctx.companyId, state: { in: ACTIVE_LEASE_STATES } } });
      if (!lease) throw new NotFoundException('ACTIVE_LEASE_NOT_FOUND');
      const revoked = await tx.authorityLease.update({ where: { id: lease.id }, data: { state: 'REVOKED', revokedAt: new Date(), version: { increment: 1 } } });
      await tx.authorityFailoverState.updateMany({ where: { companyId: ctx.companyId, activeLeaseId: lease.id }, data: { state: 'STANDBY', activeLeaseId: null, activeProviderId: null, lastTransitionAt: new Date(), transitionReason: reason, version: { increment: 1 } } });
      await this.journal(tx, ctx, { eventType: 'AUTHORITY_REVOKED', scopeId: lease.scopeId, mandateId: lease.mandateId, leaseId: lease.id, outcome: 'PASS', safeMetadata: { reason } });
      return revoked;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async validateWrite(dto: ValidateWriteDto, ctx: RequestContext) {
    const lease = await this.prisma.authorityLease.findFirst({ where: { id: dto.leaseId, companyId: ctx.companyId } });
    let reason: string | undefined;
    if (!lease) reason = 'LEASE_NOT_FOUND';
    else {
      reason = evaluateWriteBoundary({ state: lease.state, expiresAt: lease.expiresAt, epoch: lease.epoch, fencingToken: lease.fencingToken, scopeId: lease.scopeId, writeSet: stringArray(lease.writeSet) }, dto);
      if (!reason && !resourceAllowed(dto.resource, selectorArray(lease.resourceSelectors))) reason = 'RESOURCE_BOUNDARY_VIOLATION';
    }
    if (reason) {
      await this.journal(this.prisma, ctx, { eventType: 'WRITE_BOUNDARY_REJECTED', scopeId: dto.scopeId, leaseId: lease?.id, mandateId: lease?.mandateId, outcome: 'REJECTED', reasonCode: reason, safeMetadata: { command: dto.command, suppliedEpoch: dto.epoch, suppliedFencingToken: dto.fencingToken } });
      throw new ForbiddenException(reason);
    }
    await this.journal(this.prisma, ctx, { eventType: 'WRITE_BOUNDARY_ADMITTED', scopeId: dto.scopeId, leaseId: lease!.id, mandateId: lease!.mandateId, outcome: 'PASS', safeMetadata: { command: dto.command, epoch: dto.epoch, fencingToken: dto.fencingToken } });
    return { admitted: true, leaseId: lease!.id, agentId: lease!.agentId, providerId: lease!.providerId, epoch: lease!.epoch, fencingToken: lease!.fencingToken, telemetryAdvisoryOnly: true };
  }

  async executeRecovery(dto: ExecuteRecoveryDto, ctx: RequestContext) {
    const [runbook, lease, mandate, decision] = await Promise.all([
      this.prisma.recoveryRunbook.findFirst({ where: { id: dto.runbookId, companyId: ctx.companyId, status: 'APPROVED' } }),
      this.prisma.authorityLease.findFirst({ where: { id: dto.authorityLeaseId, companyId: ctx.companyId } }),
      this.prisma.authorityMandate.findFirst({ where: { id: dto.mandateId, companyId: ctx.companyId } }),
      this.prisma.authorityDecision.findFirst({ where: { id: dto.decisionId, companyId: ctx.companyId } }),
    ]);
    if (!runbook || !lease || !mandate || !decision) throw new BadRequestException('RECOVERY_AUTHORITY_CHAIN_INCOMPLETE');
    if (lease.agentId !== 'premium.recovery-executor' || mandate.agentId !== lease.agentId || decision.mandateId !== mandate.id) throw new ForbiddenException('RECOVERY_EXECUTOR_CHAIN_MISMATCH');
    await this.validateWrite({ leaseId: lease.id, epoch: lease.epoch, fencingToken: dto.fencingToken, command: 'recovery.runbook.execute', scopeId: runbook.allowedScopeId }, ctx);
    const allowed = stringArray(runbook.allowedActions);
    if (!isRunbookActionSetAllowed(dto.actions, allowed)) {
      await this.journal(this.prisma, ctx, { eventType: 'RECOVERY_RUNBOOK_REJECTED', scopeId: runbook.allowedScopeId, mandateId: mandate.id, decisionId: decision.id, leaseId: lease.id, outcome: 'REJECTED', reasonCode: 'RUNBOOK_ACTION_NOT_ALLOWED', safeMetadata: { executionKey: dto.executionKey, requestedActions: dto.actions, allowedActions: allowed } });
      throw new ForbiddenException('RUNBOOK_ACTION_NOT_ALLOWED');
    }
    if (scopesOverlap(runbook.allowedScopeId, 'premium.security.secrets')) throw new ForbiddenException('GUARDIAN_BOUNDARY_PROTECTED');
    const execution = await this.prisma.recoveryExecution.create({ data: { companyId: ctx.companyId, executionKey: dto.executionKey, runbookId: runbook.id, mandateId: mandate.id, decisionId: decision.id, authorityLeaseId: lease.id, scopeId: runbook.allowedScopeId, fencingToken: dto.fencingToken, requestedActions: json(dto.actions), result: json({ outcome: 'PASS', executedActions: dto.actions, boundedByRunbook: true }), status: 'COMPLETED', executedBy: 'premium.recovery-executor', completedAt: new Date() } });
    await this.journal(this.prisma, ctx, { eventType: 'RECOVERY_RUNBOOK_COMPLETED', scopeId: execution.scopeId, mandateId: mandate.id, decisionId: decision.id, leaseId: lease.id, outcome: 'PASS', safeMetadata: { executionKey: dto.executionKey, runbookKey: runbook.runbookKey, actions: dto.actions } });
    return execution;
  }

  async assessGate(baselineEvidenceRefs: string[], ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    if (baselineEvidenceRefs.length < 3) throw new BadRequestException('BASELINE_EVIDENCE_INCOMPLETE');
    const [leases, journals, recovery, registry, guardianFailover] = await Promise.all([
      this.prisma.authorityLease.findMany({ where: { companyId: ctx.companyId }, orderBy: { epoch: 'asc' } }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'asc' } }),
      this.prisma.recoveryExecution.findFirst({ where: { companyId: ctx.companyId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } }),
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityFailoverState.count({ where: { companyId: ctx.companyId, scopeId: 'premium.security.secrets' } }),
    ]);
    const active = leases.filter((lease) => ACTIVE_LEASE_STATES.includes(lease.state) && lease.expiresAt > new Date());
    const checks = {
      persistentLease: leases.length > 0,
      epochAndFencing: leases.some((lease) => lease.epoch > 0 && lease.epoch === lease.fencingToken) && new Set(leases.map((lease) => lease.epoch)).size === leases.length,
      staleAuthorityRejected: journals.some((event) => event.eventType === 'WRITE_BOUNDARY_REJECTED' && ['STALE_AUTHORITY_STATE', 'STALE_FENCING_TOKEN'].includes(event.reasonCode ?? '')),
      parentChildCollisionRejected: journals.some((event) => event.eventType === 'AUTHORITY_CONFLICT_REJECTED' && event.reasonCode === 'OVERLAPPING_EXECUTIVE_WRITE_AUTHORITY'),
      revocationAndHandoffAuditable: journals.some((event) => event.eventType === 'AUTHORITY_HANDOFF_COMPLETE') && journals.some((event) => event.eventType === 'AUTHORITY_REVOKED'),
      recoveryExecutorBounded: Boolean(recovery) && journals.some((event) => event.eventType === 'RECOVERY_RUNBOOK_REJECTED' && event.reasonCode === 'RUNBOOK_ACTION_NOT_ALLOWED'),
      guardianUnaffected: registry.filter((entry) => entry.kind === 'GUARDIAN').map((entry) => entry.canonicalId).join(',') === 'agm.guardian.secrets' && guardianFailover === 0,
      oneExecutiveAuthority: findLeaseConflicts(active).length === 0,
      dashboardUsesRegistry: registry.length === premiumNetworkSeed.length,
      baselinePass: baselineEvidenceRefs.length >= 3,
    };
    if (Object.values(checks).some((passed) => !passed)) throw new ConflictException({ code: 'AUTHORITY_CONTROL_PLANE_GATE_FAILED', checks });
    const evidence = { checks, baselineEvidenceRefs, leaseIds: leases.map((lease) => lease.id), recoveryExecutionId: recovery?.id, contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION };
    const event = await this.journal(this.prisma, ctx, { eventType: 'AUTHORITY_CONTROL_PLANE_GATE_PASSED', scopeId: 'premium.authority', outcome: 'PASS', safeMetadata: evidence });
    return { verdict: 'PASS', authorityControlPlane: 'PASS', opportunityIntelligence: 'GO', evidenceEventId: event.eventId, checks };
  }

  private async issueLeaseInTransaction(tx: Prisma.TransactionClient, dto: IssueLeaseDto, ctx: RequestContext) {
    const existing = await tx.authorityLease.findUnique({ where: { companyId_requestId: { companyId: ctx.companyId, requestId: dto.requestId } } });
    if (existing) {
      if (existing.mandateId !== dto.mandateId || existing.providerId !== dto.providerId || existing.leaseKey !== dto.leaseKey) throw new ConflictException('IDEMPOTENCY_KEY_REUSE_MISMATCH');
      return existing;
    }
    const mandate = await tx.authorityMandate.findFirst({ where: { id: dto.mandateId, companyId: ctx.companyId, status: 'APPROVED', revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (!mandate) throw new NotFoundException('ACTIVE_MANDATE_NOT_FOUND');
    if (dto.decisionId) {
      const decision = await tx.authorityDecision.findFirst({ where: { id: dto.decisionId, companyId: ctx.companyId, mandateId: mandate.id, status: 'APPROVED' } });
      if (!decision) throw new BadRequestException('APPROVED_DECISION_NOT_FOUND');
    }
    const providerBindings = await tx.authorityProviderBinding.findMany({ where: { companyId: ctx.companyId, agentId: mandate.agentId, providerId: dto.providerId, status: 'ALLOWED' } });
    const provider = providerBindings.find((binding) => normalizeScope(mandate.scopeId) === normalizeScope(binding.scopeId) || normalizeScope(mandate.scopeId).startsWith(`${normalizeScope(binding.scopeId)}.`));
    if (!provider) throw new ForbiddenException('PROVIDER_NOT_BOUND_TO_MANDATE_SCOPE');
    const active = await tx.authorityLease.findMany({ where: { companyId: ctx.companyId, state: { in: ACTIVE_LEASE_STATES }, expiresAt: { gt: new Date() } } });
    const candidate = { scopeId: mandate.scopeId, mode: mandate.mode, writeSet: stringArray(mandate.writeSet), resourceSelectors: selectorArray(mandate.resourceSelectors) };
    const conflict = active.find((lease) => detectAuthorityConflict(candidate, { scopeId: lease.scopeId, mode: lease.mode, writeSet: stringArray(lease.writeSet), resourceSelectors: selectorArray(lease.resourceSelectors) }).conflict);
    if (conflict) throw new ConflictException('NO_OVERLAPPING_EXECUTIVE_WRITE_AUTHORITY');
    const epoch = await tx.authorityEpochState.upsert({ where: { companyId: ctx.companyId }, create: { companyId: ctx.companyId, currentEpoch: 1 }, update: { currentEpoch: { increment: 1 } } });
    const expiresAt = new Date(Date.now() + Math.min(dto.ttlSeconds, 86_400) * 1000);
    const lease = await tx.authorityLease.create({ data: { companyId: ctx.companyId, leaseKey: dto.leaseKey, requestId: dto.requestId, mandateId: mandate.id, decisionId: dto.decisionId, scopeId: mandate.scopeId, agentId: mandate.agentId, providerId: dto.providerId, mode: mandate.mode, state: 'ACTIVE', epoch: epoch.currentEpoch, fencingToken: epoch.currentEpoch, readSet: json(mandate.readSet), writeSet: json(mandate.writeSet), resourceSelectors: json(mandate.resourceSelectors), inheritedContractHash: mandate.contractHash, issuedByUserId: ctx.userId, expiresAt } });
    await tx.authorityFailoverState.upsert({ where: { companyId_scopeId: { companyId: ctx.companyId, scopeId: mandate.scopeId } }, create: { companyId: ctx.companyId, scopeId: mandate.scopeId, primaryProviderId: dto.providerId, activeProviderId: dto.providerId, activeLeaseId: lease.id, state: 'ACTIVE', epoch: lease.epoch, lastTransitionAt: new Date() }, update: { activeProviderId: dto.providerId, activeLeaseId: lease.id, state: 'ACTIVE', epoch: lease.epoch, lastTransitionAt: new Date(), transitionReason: 'LEASE_ISSUED', version: { increment: 1 } } });
    await this.journal(tx, ctx, { eventType: 'AUTHORITY_LEASE_ISSUED', scopeId: lease.scopeId, mandateId: mandate.id, decisionId: dto.decisionId, leaseId: lease.id, outcome: 'PASS', safeMetadata: { providerId: dto.providerId, epoch: lease.epoch, fencingToken: lease.fencingToken, expiresAt } });
    await tx.agentRuntimeEvent.create({ data: { companyId: ctx.companyId, eventId: randomUUID(), mandateId: mandate.id, agentId: 'premium.orchestrator', dossierId: lease.id, lifecycle: 'COMPLETED', sequence: 1, occurredAt: new Date(), evidenceRef: `AuthorityLease:${lease.id}`, detail: `Bounded dispatch to ${lease.agentId} for ${lease.scopeId}; epoch ${lease.epoch}; fencing ${lease.fencingToken}.` } });
    return lease;
  }

  private async domainActivity(companyId: string) {
    const [job, incident, evidence, accounting, archive, recovery] = await Promise.all([
      this.prisma.carMoverJob.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' }, select: { id: true, currentState: true, updatedAt: true } }),
      this.prisma.incidentReport.findFirst({ where: { companyId }, orderBy: { updatedAt: 'desc' }, select: { id: true, status: true, severity: true, updatedAt: true } }),
      this.prisma.evidenceMetadata.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { id: true, evidenceType: true, createdAt: true } }),
      this.prisma.carMoverFinancialEntry.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' }, select: { id: true, entryType: true, createdAt: true } }),
      this.prisma.carMoverJob.findFirst({ where: { companyId, currentState: 'ARCHIVED' }, orderBy: { updatedAt: 'desc' }, select: { id: true, currentState: true, updatedAt: true } }),
      this.prisma.recoveryExecution.findFirst({ where: { companyId }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, startedAt: true, completedAt: true } }),
    ]);
    const activity = new Map<string, DomainActivity>();
    if (job) activity.set('premium.car-mover.job-service', domainSignal(job.id, job.updatedAt, `Job lifecycle ${job.currentState}`));
    if (incident) activity.set('premium.car-mover.incident-service', domainSignal(incident.id, incident.updatedAt, `Incident ${incident.status} · ${incident.severity}`, incident.status === 'open' ? 'DEGRADED' : 'PASS'));
    if (evidence) activity.set('premium.car-mover.evidence-service', domainSignal(evidence.id, evidence.createdAt, `Evidence ${evidence.evidenceType}`));
    if (accounting) activity.set('premium.car-mover.primary-accounting', domainSignal(accounting.id, accounting.createdAt, `Accounting ${accounting.entryType}`));
    if (archive) activity.set('premium.car-mover.archive-retention', domainSignal(archive.id, archive.updatedAt, 'Archived job retained'));
    if (recovery) activity.set('premium.recovery-executor', domainSignal(recovery.id, recovery.completedAt ?? recovery.startedAt, `Recovery ${recovery.status}`, recovery.status === 'COMPLETED' ? 'PASS' : recovery.status === 'FAILED' ? 'FAIL' : 'DEGRADED'));
    return activity;
  }

  private async recordRuntimeCapabilityProbes(companyId: string) {
    await this.prisma.$queryRaw`SELECT 1`;
    const instances = this.discovery.getProviders().map((wrapper) => wrapper.instance as unknown).filter((instance): instance is Record<string, unknown> => Boolean(instance && typeof instance === 'object'));
    const providers = new Map(instances.map((instance) => [instance.constructor.name, instance]));
    const adapterProviders = instances.filter((instance) => typeof instance.category === 'string' && typeof instance.providerId === 'string' && typeof instance.configured === 'function');
    const now = new Date();
    const probes = premiumNetworkSeed.flatMap((node) => {
      const requirement = RUNTIME_CAPABILITY_REQUIREMENTS[node.canonicalId];
      if (!requirement) return [];
      const provider = providers.get(requirement.provider);
      const missingMethods = requirement.methods.filter((method) => typeof provider?.[method] !== 'function');
      const configuredProviders = requirement.adapterCategory
        ? adapterProviders.filter((candidate) => candidate.category === requirement.adapterCategory && !ARCHIVED_OPTIONAL_PROVIDER_IDS.has(String(candidate.providerId)) && safelyConfigured(candidate)).map((candidate) => String(candidate.providerId))
        : [];
      const reason = !provider
        ? `RUNTIME_PROVIDER_NOT_LOADED:${requirement.provider}`
        : missingMethods.length
          ? `RUNTIME_METHOD_NOT_LOADED:${requirement.provider}.${missingMethods.join(',')}`
          : requirement.adapterCategory && configuredProviders.length === 0
            ? `LIVE_PROVIDER_NOT_CONFIGURED:${requirement.adapterCategory}`
            : 'RUNTIME_CAPABILITY_PROBE_PASSED';
      const reportedStatus = reason === 'RUNTIME_CAPABILITY_PROBE_PASSED' ? 'ONLINE' : 'DEGRADED';
      const detail = JSON.stringify({ contract: RUNTIME_CAPABILITY_PROBE_VERSION, provider: requirement.provider, methods: requirement.methods, database: 'AVAILABLE', configuredProviders, processUptimeSeconds: Math.floor(process.uptime()) });
      return [{ node, reportedStatus, reason, detail }];
    });
    await Promise.all(probes.map(({ node, reportedStatus, reason, detail }) => this.prisma.componentHeartbeat.upsert({
      where: { companyId_componentId: { companyId, componentId: node.canonicalId } },
      create: { companyId, componentId: node.canonicalId, reportedStatus, lastSeenAt: now, lastSuccessAt: reportedStatus === 'ONLINE' ? now : null, lastFailureAt: reportedStatus === 'DEGRADED' ? now : null, lastFailureReason: reportedStatus === 'DEGRADED' ? reason : null, lastDetail: detail },
      update: {
        reportedStatus,
        lastSeenAt: now,
        // The correlated M2M evidence stored by TurnOperationalTruthService owns
        // ACP lastDetail. The continuous self-probe refreshes liveness without
        // erasing that independently verified request/event correlation.
        ...(node.canonicalId === AUTHORITY_CONTROL_PLANE_ID ? {} : { lastDetail: detail }),
        ...(reportedStatus === 'ONLINE' ? { lastSuccessAt: now, lastFailureReason: null } : { lastFailureAt: now, lastFailureReason: reason }),
      },
    })));
  }

  private async reconcileOperationalIncidents(
    ctx: RequestContext,
    evaluations: Array<{ canonicalId: string; scopeId: string; qualification: OperationalIncidentQualification }>,
    journals: OperationalJournalEvent[],
  ) {
    const events = journals.filter((event) => ['OPERATIONAL_INCIDENT_OPENED', 'OPERATIONAL_INCIDENT_RESOLVED'].includes(event.eventType));
    const latestByCanonicalId = new Map<string, OperationalJournalEvent>();
    for (const event of events) {
      const canonicalId = jsonRecord(event.safeMetadata).canonicalId;
      if (typeof canonicalId === 'string' && !latestByCanonicalId.has(canonicalId)) latestByCanonicalId.set(canonicalId, event);
    }
    let opened = 0;
    let resolved = 0;
    for (const evaluation of evaluations) {
      const latest = latestByCanonicalId.get(evaluation.canonicalId);
      const eventType = operationalIncidentTransition(evaluation.qualification, latest?.eventType ?? null);
      if (!eventType) continue;
      const shouldOpen = eventType === 'OPERATIONAL_INCIDENT_OPENED';
      const safeMetadata = {
        contractVersion: OPERATIONAL_INCIDENT_CONTRACT,
        canonicalId: evaluation.canonicalId,
        decision: evaluation.qualification.decision,
        severity: evaluation.qualification.severity,
        rootCauseClassification: evaluation.qualification.rootCauseClassification,
        rationale: evaluation.qualification.rationale,
        evidenceReference: evaluation.qualification.evidenceReference,
        previousEventId: latest?.eventId ?? null,
      };
      const eventId = deterministicUuid(`${ctx.companyId}:${evaluation.canonicalId}:${eventType}:${latest?.eventId ?? 'INITIAL'}`);
      let created: OperationalJournalEvent;
      let createdNow = false;
      try {
        created = await this.prisma.authorityAuditJournal.create({ data: {
          companyId: ctx.companyId,
          eventId,
          eventType,
          scopeId: evaluation.scopeId,
          actorType: 'SYSTEM',
          actorId: 'turn.operational-incident-evaluator',
          outcome: shouldOpen ? 'OPEN' : 'RESOLVED',
          reasonCode: evaluation.qualification.reasonCode,
          payloadHash: hash(safeMetadata),
          safeMetadata: json(safeMetadata),
          correlationId: ctx.correlationId,
        } });
        createdNow = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
        const concurrent = await this.prisma.authorityAuditJournal.findUnique({ where: { companyId_eventId: { companyId: ctx.companyId, eventId } } });
        if (!concurrent) throw error;
        created = concurrent;
      }
      events.unshift(created);
      latestByCanonicalId.set(evaluation.canonicalId, created);
      if (createdNow && shouldOpen) opened += 1;
      if (createdNow && !shouldOpen) resolved += 1;
    }
    const openByCanonicalId = new Map<string, string>();
    for (const [canonicalId, event] of latestByCanonicalId) if (event.eventType === 'OPERATIONAL_INCIDENT_OPENED') openByCanonicalId.set(canonicalId, event.eventId);
    return { events, openByCanonicalId, opened, resolved };
  }

  private async ensureFoundation(ctx: RequestContext) {
    await this.prisma.$transaction(async (tx) => {
      for (const item of premiumNetworkSeed) {
        await tx.premiumNetworkRegistryEntry.upsert({ where: { companyId_canonicalId: { companyId: ctx.companyId, canonicalId: item.canonicalId } }, create: { companyId: ctx.companyId, ...item, readPermissions: json(item.readPermissions), writePermissions: json(item.writePermissions), prohibitedActions: json(item.prohibitedActions), capabilities: json(item.capabilities), allowedProviders: json(item.allowedProviders), fallbackProviders: json(item.fallbackProviders), contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION }, update: { kind: item.kind, module: item.module, ownerId: item.ownerId, supervisorId: item.supervisorId, scope: item.scope, readPermissions: json(item.readPermissions), writePermissions: json(item.writePermissions), prohibitedActions: json(item.prohibitedActions), capabilities: json(item.capabilities), humanApprovalBoundary: item.humanApprovalBoundary, telemetryRequirement: item.telemetryRequirement, allowedProviders: json(item.allowedProviders), fallbackProviders: json(item.fallbackProviders), recoveryPolicy: item.recoveryPolicy, contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION } });
        for (const [priority, providerId] of [...item.allowedProviders, ...item.fallbackProviders.filter((provider) => !item.allowedProviders.includes(provider))].entries()) await tx.authorityProviderBinding.upsert({ where: { companyId_scopeId_agentId_providerId: { companyId: ctx.companyId, scopeId: item.scope, agentId: item.canonicalId, providerId } }, create: { companyId: ctx.companyId, scopeId: item.scope, agentId: item.canonicalId, providerId, priority, mode: item.kind === 'INSPECTOR' ? 'INSPECTOR' : 'EXECUTIVE' }, update: { priority, status: 'ALLOWED' } });
      }
      for (const scope of authorityScopeSeed) await tx.authorityScopePolicy.upsert({ where: { companyId_scopeId: { companyId: ctx.companyId, scopeId: scope.scopeId } }, create: { companyId: ctx.companyId, ...scope, resourceOwnership: json({ productId: 'agm-premium' }), allowedReadSet: json(['*']), allowedWriteSet: json(premiumNetworkSeed.filter((item) => item.scope === scope.scopeId).flatMap((item) => item.writePermissions)), contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION }, update: { parentScopeId: scope.parentScopeId, ownerId: scope.ownerId, contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION } });
      await tx.recoveryRunbook.upsert({ where: { companyId_runbookKey_version: { companyId: ctx.companyId, runbookKey: 'premium.telemetry.refresh', version: 1 } }, create: { companyId: ctx.companyId, runbookKey: 'premium.telemetry.refresh', version: 1, name: 'Refresh Premium telemetry projection', allowedScopeId: 'premium.recovery', allowedActions: json(['telemetry.refresh']), parameterSchema: json({ additionalProperties: false }), preconditions: json(['valid-authority-chain', 'guardian-boundary-intact']), approvedByUserId: ctx.userId }, update: { status: 'APPROVED' } });
    });
  }

  private journal(tx: Prisma.TransactionClient | PrismaService, ctx: RequestContext, input: { eventType: string; scopeId?: string; mandateId?: string; decisionId?: string; leaseId?: string; outcome: string; reasonCode?: string; safeMetadata: unknown }) {
    return tx.authorityAuditJournal.create({ data: { companyId: ctx.companyId, eventId: randomUUID(), eventType: input.eventType, scopeId: input.scopeId, mandateId: input.mandateId, decisionId: input.decisionId, leaseId: input.leaseId, actorType: 'USER', actorId: ctx.userId, outcome: input.outcome, reasonCode: input.reasonCode, payloadHash: hash(input.safeMetadata), safeMetadata: json(input.safeMetadata), correlationId: ctx.correlationId } });
  }
}

function requireAuthorityAdmin(ctx: RequestContext) {
  if (!ctx.roles.some((role) => AUTHORITY_ADMIN_ROLES.has(role.toUpperCase()))) throw new ForbiddenException('HUMAN_AUTHORITY_REQUIRED');
}

function firstBy<T>(items: readonly T[], key: (item: T) => string) {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(key(item))) map.set(key(item), item);
  return map;
}

function runtimeSignal(event: { eventId: string; mandateId: string | null; lifecycle: string; occurredAt: Date; evidenceRef: string; outputRef: string | null; evidenceHash: string | null } | undefined): AccountabilitySignal | null {
  return event ? { id: event.eventId, mandateId: event.mandateId, status: event.lifecycle, occurredAt: event.occurredAt, evidenceRef: event.evidenceRef, outputRef: event.outputRef ?? (event.evidenceHash ? `sha256:${event.evidenceHash}` : null) } : null;
}

function nodeSignal(node: { lastActivity: Date | null; lastRun: { lifecycle: string; occurredAt: Date; detail: unknown } | null; activityEvidence: { recordReference: string | null } }): AccountabilitySignal | null {
  if (!node.lastActivity || !node.activityEvidence.recordReference || !node.lastRun) return null;
  return { id: node.activityEvidence.recordReference, status: node.lastRun.lifecycle, occurredAt: node.lastActivity, evidenceRef: node.activityEvidence.recordReference, outputRef: node.activityEvidence.recordReference };
}

function accountabilityTrigger(runtimeMode: string, canonicalId: string) {
  if (canonicalId === AUTHORITY_CONTROL_PLANE_ID) return 'SCHEDULED_AUTHORITY_GRAPH_EVALUATION';
  if (canonicalId === PRIMARY_INSPECTOR_ID || canonicalId === SECONDARY_INSPECTOR_ID) return 'RELEASE_VALIDATION_OR_INSPECTOR_FAILURE';
  if (runtimeMode === 'CONTINUOUS_COMPONENT') return 'SCHEDULED_RUNTIME_PROBE';
  if (runtimeMode === 'REQUEST_DRIVEN') return 'AUTHORIZED_WORK_REQUEST';
  if (runtimeMode === 'EVENT_DRIVEN') return 'CANONICAL_DOMAIN_EVENT';
  return 'NO_EXECUTION_TRIGGER';
}

function accountabilityFrequency(runtimeMode: string) {
  if (runtimeMode === 'CONTINUOUS_COMPONENT') return 'EVERY_60_SECONDS';
  if (runtimeMode === 'REQUEST_DRIVEN') return 'ON_DEMAND_WHEN_WORK_EXISTS';
  if (runtimeMode === 'EVENT_DRIVEN') return 'ON_EACH_CANONICAL_EVENT';
  return 'NOT_APPLICABLE';
}

function inspectorMandateKey(agentId: string) {
  return `inspector-failover:${agentId}`;
}

function stringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function selectorArray(value: Prisma.JsonValue): AuthorityResourceSelector[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Prisma.JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item)).map((item) => ({ productId: typeof item.productId === 'string' ? item.productId : undefined, moduleId: typeof item.moduleId === 'string' ? item.moduleId : undefined, subjectType: typeof item.subjectType === 'string' ? item.subjectType : undefined, subjectIds: Array.isArray(item.subjectIds) ? item.subjectIds.filter((id): id is string => typeof id === 'string') : undefined }));
}

function resourceAllowed(resource: ResourceSelectorDto | undefined, selectors: readonly AuthorityResourceSelector[]) {
  if (!selectors.length) return true;
  if (!resource) return false;
  return selectors.some((selector) => (!selector.productId || selector.productId === resource.productId) && (!selector.moduleId || selector.moduleId === resource.moduleId) && (!selector.subjectType || selector.subjectType === resource.subjectType) && (!selector.subjectIds?.length || Boolean(resource.subjectIds?.every((id) => selector.subjectIds?.includes(id)))));
}

function adapterHealth(status: string) {
  if (status === 'HEALTHY') return 'PASS';
  if (['DEGRADED', 'RATE_LIMITED', 'STALE'].includes(status)) return 'DEGRADED';
  if (status === 'UNAVAILABLE') return 'FAIL';
  return 'NO_TELEMETRY';
}

function safelyConfigured(provider: Record<string, unknown>) {
  try {
    return (provider.configured as () => boolean).call(provider) === true;
  } catch {
    return false;
  }
}

function adapterRegistryId(category: string) {
  return `premium.adapters.${({ GEOCODING: 'geocoding', ROUTE: 'routing', TRAFFIC: 'traffic', TOLL: 'toll', TRANSIT: 'transit', PLATFORM_FEED: 'platform-feed' } as Record<string, string>)[category] ?? category.toLowerCase()}`;
}

function findLeaseConflicts(leases: Array<{ id: string; scopeId: string; mode: string; writeSet: Prisma.JsonValue; resourceSelectors: Prisma.JsonValue }>) {
  const conflicts: Array<{ leftLeaseId: string; rightLeaseId: string }> = [];
  for (let left = 0; left < leases.length; left += 1) for (let right = left + 1; right < leases.length; right += 1) {
    if (detectAuthorityConflict({ scopeId: leases[left].scopeId, mode: leases[left].mode, writeSet: stringArray(leases[left].writeSet), resourceSelectors: selectorArray(leases[left].resourceSelectors) }, { scopeId: leases[right].scopeId, mode: leases[right].mode, writeSet: stringArray(leases[right].writeSet), resourceSelectors: selectorArray(leases[right].resourceSelectors) }).conflict) conflicts.push({ leftLeaseId: leases[left].id, rightLeaseId: leases[right].id });
  }
  return conflicts;
}

function domainSignal(recordId: string, observedAt: Date, detail: string, status = 'PASS'): DomainActivity {
  return { status, observedAt, recordId, detail, dependencyState: status === 'PASS' ? 'PASS' : status };
}

function evidenceReference(canonicalId: string, ...ids: Array<string | null | undefined>) {
  const id = ids.find(Boolean);
  return id ? `${canonicalId}:${id}` : null;
}

function dependencyFailures(
  live: { status: string; lastErrorCode: string | null; rateLimitState: string } | undefined,
  opportunity: { health: string; dependencyHealth: string; freshnessStatus: string; backlog: number } | undefined,
  heartbeat: { lastFailureReason: string | null; reportedStatus: string } | undefined,
  secretFailures: string[] = [],
) {
  const failures: string[] = [];
  if (live && live.status !== 'HEALTHY') failures.push(live.lastErrorCode ?? `ADAPTER_${live.status}`);
  if (live && live.rateLimitState !== 'CLEAR') failures.push(`RATE_LIMIT_${live.rateLimitState}`);
  if (opportunity && !['PASS', 'HEALTHY'].includes(opportunity.health)) failures.push(`AGENT_${opportunity.health}`);
  if (opportunity && !['PASS', 'HEALTHY'].includes(opportunity.dependencyHealth)) failures.push(`DEPENDENCY_${opportunity.dependencyHealth}`);
  if (opportunity?.freshnessStatus === 'STALE') failures.push('TELEMETRY_STALE');
  if ((opportunity?.backlog ?? 0) > 0) failures.push(`BACKLOG_${opportunity!.backlog}`);
  if (heartbeat?.lastFailureReason) failures.push(heartbeat.lastFailureReason);
  if (heartbeat && !['PASS', 'ONLINE', 'HEALTHY'].includes(heartbeat.reportedStatus)) failures.push(`HEARTBEAT_${heartbeat.reportedStatus}`);
  failures.push(...secretFailures);
  return [...new Set(failures)];
}

function evaluateOpportunityIntelligence(
  opportunityCount: number,
  telemetry: Array<{ agentId: string; health: string; freshnessStatus: string; dependencyHealth: string; backlog: number; lastRunAt: Date; outputReference: string | null }>,
  conflictCount: number,
  now: Date,
) {
  const required = ['premium.car-mover.route-mobility', 'premium.car-mover.cost-risk', 'premium.car-mover.opportunity-planner', 'premium.car-mover.opportunity-judge'];
  const byId = new Map(telemetry.map((item) => [item.agentId, item]));
  const missing = required.filter((id) => !byId.has(id));
  const stale = required.filter((id) => {
    const item = byId.get(id);
    return Boolean(item && (item.freshnessStatus === 'STALE' || now.getTime() - item.lastRunAt.getTime() > 24 * 60 * 60 * 1000));
  });
  const unhealthy = required.filter((id) => {
    const item = byId.get(id);
    return Boolean(item && (!['PASS', 'HEALTHY'].includes(item.health) || !['PASS', 'HEALTHY'].includes(item.dependencyHealth) || item.backlog > 0));
  });
  const sources = required.flatMap((id) => {
    const item = byId.get(id);
    return item ? [{ agentId: id, observedAt: item.lastRunAt, outputReference: item.outputReference, health: item.health, dependencyHealth: item.dependencyHealth }] : [];
  });
  if (conflictCount) return { gate: 'FAIL', reason: 'Active authority conflicts make opportunity decisions unsafe.', requiredAction: 'Resolve active authority conflicts.', evaluatedAt: now, missing, stale, unhealthy, sources };
  if (!opportunityCount) return { gate: 'NO_ACTIVITY', reason: 'The real opportunity store contains zero opportunities; no operational verdict is inferred.', requiredAction: null, evaluatedAt: now, missing, stale, unhealthy, sources };
  if (missing.length) return { gate: 'UNKNOWN', reason: 'Opportunity records exist but required agent telemetry is missing.', requiredAction: `Run real analysis for: ${missing.join(', ')}.`, evaluatedAt: now, missing, stale, unhealthy, sources };
  if (stale.length || unhealthy.length) return { gate: 'DEGRADED', reason: 'Current opportunity evidence is stale, unhealthy, or backlogged.', requiredAction: `Recalculate and repair: ${[...new Set([...stale, ...unhealthy])].join(', ')}.`, evaluatedAt: now, missing, stale, unhealthy, sources };
  return { gate: 'GO', reason: 'Current persisted analyses, dependencies and authority conflict evaluation are healthy.', requiredAction: null, evaluatedAt: now, missing, stale, unhealthy, sources };
}

function safeObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toIncidentProjection(item: OperationalJournalEvent) {
  return { eventId: item.eventId, eventType: item.eventType, scopeId: item.scopeId, reasonCode: item.reasonCode, occurredAt: item.occurredAt, correlationId: item.correlationId, leaseId: item.leaseId };
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function deterministicUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  const stable = hex.join('');
  return `${stable.slice(0, 8)}-${stable.slice(8, 12)}-${stable.slice(12, 16)}-${stable.slice(16, 20)}-${stable.slice(20)}`;
}
