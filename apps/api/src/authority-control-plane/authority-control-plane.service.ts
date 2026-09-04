import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

const ACTIVE_LEASE_STATES = ['AUTHORIZED', 'ACTIVE', 'DRAINING'];
const AUTHORITY_ADMIN_ROLES = new Set(['OWNER', 'PRODUCT_OWNER', 'COMPANY_OWNER', 'ADMIN']);
const AUTHORITY_CONTROL_PLANE_ID = TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId;
const json = (value: unknown) => value as Prisma.InputJsonValue;
type DomainActivity = { status: string; observedAt: Date; recordId: string; detail: string; dependencyState: string };

@Injectable()
export class AuthorityControlPlaneService {
  constructor(private readonly prisma: PrismaService, private readonly secretTelemetry: SecretTelemetryService) {}

  async dashboard(ctx: RequestContext) {
    const now = new Date();
    const secretSnapshot = this.secretTelemetry.snapshot();
    const [registry, heartbeats, runtimeEvents, opportunityTelemetry, liveAdapterTelemetry, allLeases, failover, journals, mandates, decisions, recovery, domainActivity, opportunityCount] = await Promise.all([
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId }, orderBy: [{ module: 'asc' }, { canonicalId: 'asc' }] }),
      this.prisma.componentHeartbeat.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.agentRuntimeEvent.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'desc' }, take: 1000 }),
      this.prisma.opportunityAgentTelemetry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.liveAdapterTelemetry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityLease.findMany({ where: { companyId: ctx.companyId }, orderBy: { issuedAt: 'desc' }, take: 1000 }),
      this.prisma.authorityFailoverState.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'desc' }, take: 500 }),
      this.prisma.authorityMandate.findMany({ where: { companyId: ctx.companyId }, orderBy: { issuedAt: 'desc' }, take: 1000 }),
      this.prisma.authorityDecision.findMany({ where: { companyId: ctx.companyId }, orderBy: { decidedAt: 'desc' }, take: 1000 }),
      this.prisma.recoveryExecution.findFirst({ where: { companyId: ctx.companyId }, orderBy: { startedAt: 'desc' } }),
      this.domainActivity(ctx.companyId),
      this.prisma.normalizedOpportunity.count({ where: { companyId: ctx.companyId } }),
    ]);
    const leases = allLeases.filter((lease) => ACTIVE_LEASE_STATES.includes(lease.state) && lease.expiresAt > now);
    const heartbeatById = new Map(heartbeats.map((item) => [item.componentId, item]));
    const opportunityTelemetryById = new Map(opportunityTelemetry.map((item) => [item.agentId, item]));
    const liveTelemetryById = new Map(liveAdapterTelemetry.map((item) => [adapterRegistryId(item.category), item]));
    const lastRunByAgent = new Map<string, (typeof runtimeEvents)[number]>();
    for (const event of runtimeEvents) if (!lastRunByAgent.has(event.agentId)) lastRunByAgent.set(event.agentId, event);
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
      const secretRun = item.canonicalId === 'agm.guardian.secrets' ? secretSnapshot : null;
      const canonicalState = resolveCanonicalNodeState({
        registryLifecycleStatus: item.lifecycleStatus,
        ...(profile.expectedSource === 'LIVE_ADAPTER' && liveRun ? { liveAdapter: { status: adapterHealth(liveRun.status), observedAt: liveRun.lastAttemptAt } } : {}),
        ...(profile.expectedSource === 'OPPORTUNITY_TELEMETRY' && opportunityRun ? { opportunityTelemetry: { status: opportunityRun.health, freshnessStatus: opportunityRun.freshnessStatus, observedAt: opportunityRun.lastRunAt } } : {}),
        ...(profile.expectedSource === 'COMPONENT_HEARTBEAT' && heartbeat ? { heartbeat: { status: heartbeat.reportedStatus, observedAt: heartbeat.lastSeenAt, staleAfterMs: profile.freshnessWindowMs ?? undefined } } : {}),
        ...(profile.expectedSource === 'SECRET_TELEMETRY' && secretRun ? { secretTelemetry: { status: secretRun.overallStatus === 'CONFIGURED' ? 'PASS' : 'DEGRADED', observedAt: new Date(secretRun.checkedAt) } } : {}),
        ...(profile.expectedSource === 'RUNTIME_EVENT' && lastRun ? { runtimeEvent: { status: lastRun.lifecycle, observedAt: lastRun.occurredAt } } : {}),
        ...(profile.expectedSource === 'DOMAIN_EVENT_STORE' && domainRun ? { domainEvent: { status: domainRun.status, observedAt: domainRun.observedAt } } : {}),
      });
      const observedAt = canonicalState.observedAt;
      const stale = Boolean(observedAt && profile.freshnessWindowMs && now.getTime() - observedAt.getTime() > profile.freshnessWindowMs);
      const runtimePresence = profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' ? 'ABSENT' : observedAt ? 'OBSERVED' : 'NOT_OBSERVED';
      const sourceStatus = profile.runtimeMode === 'HUMAN' ? 'STANDBY' : profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' ? 'FAIL' : stale && canonicalState.status === 'PASS' ? 'DEGRADED' : canonicalState.status;
      const effectiveStatus = persisted ? sourceStatus : 'FAIL';
      const secretIssue = secretRun?.secrets.filter((secret) => secret.status !== 'CONFIGURED').map((secret) => `${secret.id}:${secret.status}`).join(', ') || null;
      const reason = !persisted ? 'Canonical identity is absent from PremiumNetworkRegistryEntry.' : profile.missingCapability ?? (stale ? `Last real observation exceeds ${Math.round((profile.freshnessWindowMs ?? 0) / 60000)} minutes.` : effectiveStatus === 'NO_TELEMETRY' ? `No ${profile.expectedSource} observation exists for this identity.` : secretIssue ?? heartbeat?.lastFailureReason ?? liveRun?.lastErrorCode ?? null);
      const requiredAction = !persisted ? 'Apply the approved registry provisioning migration; do not infer identity presence from telemetry.' : profile.requiredAction ?? (stale ? `Run the real ${profile.workload} path or restore its telemetry producer.` : effectiveStatus === 'FAIL' || effectiveStatus === 'DEGRADED' ? 'Inspect the cited evidence and restore the failed dependency or execution path.' : effectiveStatus === 'NO_TELEMETRY' ? `Exercise the real function to create ${profile.expectedSource} evidence; do not infer runtime from registry.` : null);
      return {
        canonicalId: item.canonicalId, kind: item.kind, module: item.module, ownerId: item.ownerId,
        supervisorId: item.supervisorId, scope: item.scope,
        registryPresence,
        lifecycleStatus: item.lifecycleStatus,
        runtimeMode: profile.runtimeMode,
        runtimePresence,
        currentFunction: profile.workload,
        status: effectiveStatus,
        statusLabel: profile.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED' ? 'CAPABILITY NOT IMPLEMENTED' : profile.runtimeMode === 'HUMAN' ? 'HUMAN AUTHORITY' : stale ? 'STALE' : canonicalState.label,
        statusSource: canonicalState.source,
        statusObservedAt: observedAt,
        health: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : effectiveStatus === 'PASS' ? 'HEALTHY' : effectiveStatus === 'FAIL' ? 'FAILED' : effectiveStatus === 'DEGRADED' ? 'DEGRADED' : 'UNKNOWN',
        freshness: profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : !observedAt ? 'NO_OBSERVATION' : stale ? 'STALE' : 'CURRENT',
        lastHeartbeat: heartbeat?.lastSeenAt ?? null,
        lastActivity: observedAt,
        reason,
        requiredAction,
        evidence: { source: profile.expectedSource, observedAt, recordReference: secretRun?.contract ?? evidenceReference(item.canonicalId, liveRun?.id, opportunityRun?.id, heartbeat?.id, lastRun?.eventId, domainRun?.recordId) },
        telemetry: secretRun ? { reportedStatus: secretRun.overallStatus, lastSeenAt: secretRun.checkedAt, lastSuccessAt: secretRun.overallStatus === 'CONFIGURED' ? secretRun.checkedAt : null, lastFailureAt: secretRun.overallStatus === 'ATTENTION' ? secretRun.checkedAt : null, detail: { contract: secretRun.contract, checkedSecrets: secretRun.secrets.length, valuesExposed: false } } : liveRun ? { reportedStatus: liveRun.status, lastSeenAt: liveRun.lastAttemptAt, lastSuccessAt: liveRun.lastSuccessAt, lastFailureAt: liveRun.lastErrorCode ? liveRun.lastAttemptAt : null, detail: { latencyMs: liveRun.latencyMs, errorRateBps: liveRun.errorRateBps, rateLimitState: liveRun.rateLimitState, fallbackActivation: liveRun.fallbackActivation, cacheAgeSeconds: liveRun.cacheAgeSeconds, providerId: liveRun.providerId, contractVersion: liveRun.contractVersion } } : opportunityRun ? { reportedStatus: opportunityRun.health, lastSeenAt: opportunityRun.lastRunAt, lastSuccessAt: opportunityRun.health === 'PASS' ? opportunityRun.lastRunAt : null, lastFailureAt: opportunityRun.health === 'FAIL' ? opportunityRun.lastRunAt : null, detail: { durationMs: opportunityRun.durationMs, freshnessStatus: opportunityRun.freshnessStatus, backlog: opportunityRun.backlog, dependencyHealth: opportunityRun.dependencyHealth, confidence: opportunityRun.confidence, outputReference: opportunityRun.outputReference, providerId: opportunityRun.providerId, contractVersion: opportunityRun.contractVersion } } : heartbeat ? { reportedStatus: heartbeat.reportedStatus, lastSeenAt: heartbeat.lastSeenAt, lastSuccessAt: heartbeat.lastSuccessAt, lastFailureAt: heartbeat.lastFailureAt, detail: heartbeat.lastDetail } : null,
        dependencyState: secretRun ? secretRun.overallStatus : liveRun ? adapterHealth(liveRun.status) : opportunityRun ? opportunityRun.dependencyHealth : heartbeat?.lastFailureReason ? 'DEGRADED' : domainRun?.dependencyState ?? (profile.runtimeMode === 'HUMAN' ? 'NOT_APPLICABLE' : 'UNKNOWN'),
        dependencyFailures: dependencyFailures(liveRun, opportunityRun, heartbeat, secretRun?.secrets.filter((secret) => secret.status !== 'CONFIGURED').map((secret) => `${secret.id}:${secret.status}`)),
        authorityState: lease ? { state: lease.state, epoch: lease.epoch, fencingToken: lease.fencingToken, providerId: lease.providerId, expiresAt: lease.expiresAt } : { state: item.writePermissions ? 'STANDBY' : 'ADVISORY' },
        failoverState: failoverState?.state ?? 'STANDBY',
        lastRun: lastRun ? { lifecycle: lastRun.lifecycle, occurredAt: lastRun.occurredAt, detail: lastRun.detail } : liveRun ? { lifecycle: liveRun.status, occurredAt: liveRun.lastAttemptAt, detail: { latencyMs: liveRun.latencyMs, providerId: liveRun.providerId } } : opportunityRun ? { lifecycle: 'COMPLETED', occurredAt: opportunityRun.lastRunAt, detail: { durationMs: opportunityRun.durationMs, outputReference: opportunityRun.outputReference } } : domainRun ? { lifecycle: domainRun.status, occurredAt: domainRun.observedAt, detail: domainRun.detail } : null,
      };
    });
    const conflicts = findLeaseConflicts(leases);
    const controlPlaneNode = nodes.find((node) => node.canonicalId === AUTHORITY_CONTROL_PLANE_ID);
    const controlPlaneStatus = conflicts.length ? 'FAIL' : controlPlaneNode?.status ?? 'NO_TELEMETRY';
    const mandateById = new Map(mandates.map((mandate) => [mandate.id, mandate]));
    const decisionById = new Map(decisions.map((decision) => [decision.id, decision]));
    const activeCommandChains = leases.map((lease) => {
      const mandate = mandateById.get(lease.mandateId);
      const decision = lease.decisionId ? decisionById.get(lease.decisionId) : undefined;
      return { leaseId: lease.id, scopeId: lease.scopeId, agentId: lease.agentId, providerId: lease.providerId, mode: lease.mode, mandateId: lease.mandateId, mandateKey: mandate?.mandateKey ?? null, decisionId: lease.decisionId, decisionKey: decision?.decisionKey ?? null, actionType: decision?.actionType ?? null, epoch: lease.epoch, fencingToken: lease.fencingToken, issuedAt: lease.issuedAt, expiresAt: lease.expiresAt };
    });
    const invalidOrStaleAuthority = allLeases.filter((lease) => ACTIVE_LEASE_STATES.includes(lease.state) && lease.expiresAt <= now).map((lease) => ({ leaseId: lease.id, agentId: lease.agentId, scopeId: lease.scopeId, reason: 'ACTIVE_STATE_WITH_EXPIRED_TTL', expiredAt: lease.expiresAt }));
    const opportunityIntelligence = evaluateOpportunityIntelligence(opportunityCount, opportunityTelemetry, conflicts.length, now);
    return {
      generatedAt: new Date().toISOString(), contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION,
      controlPlane: { canonicalId: AUTHORITY_CONTROL_PLANE_ID, status: controlPlaneStatus, statusSource: controlPlaneNode?.statusSource ?? 'NO_TELEMETRY', statusObservedAt: controlPlaneNode?.statusObservedAt ?? null, invariant: 'ONE SCOPE → ONE ACTIVE EXECUTIVE AUTHORITY', activeExecutiveAuthorities: leases.filter((lease) => lease.mode === 'EXECUTIVE').length, executiveAuthorityAgents: leases.filter((lease) => lease.mode === 'EXECUTIVE').map((lease) => lease.agentId), conflicts, activeCommandChains, delegatedAuthority: activeCommandChains.filter((chain) => chain.agentId !== 'agm.human.product-owner'), invalidOrStaleAuthority },
      nodes,
      departments: [...new Set(nodes.map((node) => node.module))].map((module) => ({ module, nodeCount: nodes.filter((node) => node.module === module).length })),
      incidents: journals.filter((item) => item.outcome === 'REJECTED').map((item) => ({ eventId: item.eventId, eventType: item.eventType, scopeId: item.scopeId, reasonCode: item.reasonCode, occurredAt: item.occurredAt, correlationId: item.correlationId, leaseId: item.leaseId })),
      telemetryPolicy: 'OBSERVE_ONLY_NEVER_COMMAND_OR_BLOCK',
      capabilityGaps: nodes.filter((node) => node.registryPresence === 'MISSING' || node.runtimeMode === 'CAPABILITY_NOT_IMPLEMENTED').map((node) => ({ canonicalId: node.canonicalId, reason: node.reason, requiredAction: node.requiredAction })),
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

  async inspectOperationalCapabilities(ctx: RequestContext) {
    requireAuthorityAdmin(ctx);
    const now = new Date();
    const [registry, scopes, releaseEvent, heartbeat] = await Promise.all([
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityScopePolicy.findMany({ where: { companyId: ctx.companyId, status: 'ACTIVE' } }),
      this.prisma.agentRuntimeEvent.findFirst({ where: { companyId: ctx.companyId, agentId: AUTHORITY_CONTROL_PLANE_ID }, orderBy: { occurredAt: 'desc' } }),
      this.prisma.componentHeartbeat.findUnique({ where: { companyId_componentId: { companyId: ctx.companyId, componentId: AUTHORITY_CONTROL_PLANE_ID } } }),
    ]);
    const expectedIds = new Set(premiumNetworkSeed.map((node) => node.canonicalId));
    const actualIds = new Set(registry.map((node) => node.canonicalId));
    const architectureChecks = {
      registryComplete: expectedIds.size === actualIds.size && [...expectedIds].every((id) => actualIds.has(id)),
      scopesPresent: authorityScopeSeed.every((scope) => scopes.some((item) => item.scopeId === scope.scopeId)),
      telemetryBindingsComplete: premiumNetworkSeed.every((node) => operationalProfile(node).expectedSource !== 'NONE'),
    };
    const heartbeatEvidence = safeObject(heartbeat?.lastDetail);
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
    for (const evaluation of evaluations) {
      const event = await this.prisma.agentRuntimeEvent.create({ data: {
        companyId: ctx.companyId, eventId: randomUUID(), mandateId: `turn-operational-inspection-${now.getTime()}`,
        agentId: evaluation.agentId, dossierId: `turn-operational-inspection-${evaluation.agentId}-${now.getTime()}`,
        lifecycle: evaluation.passed ? 'COMPLETED' : 'FAILED', sequence: 1, occurredAt: now,
        evidenceRef: evaluation.evidenceRef, detail: JSON.stringify(evaluation.checks),
      } });
      await this.journal(this.prisma, ctx, { eventType: evaluation.passed ? 'OPERATIONAL_INSPECTION_COMPLETED' : 'OPERATIONAL_INSPECTION_FAILED', scopeId: evaluation.agentId === 'premium.release-inspector' ? 'premium.release' : 'premium.architecture', outcome: evaluation.passed ? 'PASS' : 'FAIL', reasonCode: evaluation.passed ? undefined : 'INSPECTION_CHECK_FAILED', safeMetadata: { agentId: evaluation.agentId, checks: evaluation.checks, runtimeEventId: event.eventId } });
    }
    return { evaluatedAt: now, evaluations };
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

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
