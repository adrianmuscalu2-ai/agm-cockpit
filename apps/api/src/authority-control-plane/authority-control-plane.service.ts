import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { detectAuthorityConflict, evaluateWriteBoundary, isCommandAllowed, isRunbookActionSetAllowed, normalizeScope, scopesOverlap, type AuthorityResourceSelector } from './authority-scope';
import { authorityScopeSeed, PREMIUM_NETWORK_CONTRACT_VERSION, premiumNetworkSeed } from './premium-network.seed';
import type { CreateDecisionDto, CreateMandateDto, ExecuteRecoveryDto, HandoffLeaseDto, IssueLeaseDto, ResourceSelectorDto, ValidateWriteDto } from './dto';
import { resolveCanonicalNodeState } from './canonical-node-state';

const ACTIVE_LEASE_STATES = ['AUTHORIZED', 'ACTIVE', 'DRAINING'];
const AUTHORITY_ADMIN_ROLES = new Set(['OWNER', 'PRODUCT_OWNER', 'COMPANY_OWNER', 'ADMIN']);
const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class AuthorityControlPlaneService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(ctx: RequestContext) {
    await this.ensureFoundation(ctx);
    const [registry, heartbeats, runtimeEvents, leases, failover, incidents, gatePass] = await Promise.all([
      this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId }, orderBy: [{ module: 'asc' }, { canonicalId: 'asc' }] }),
      this.prisma.componentHeartbeat.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.agentRuntimeEvent.findMany({ where: { companyId: ctx.companyId }, orderBy: { occurredAt: 'desc' }, take: 1000 }),
      this.prisma.authorityLease.findMany({ where: { companyId: ctx.companyId, state: { in: ACTIVE_LEASE_STATES }, expiresAt: { gt: new Date() } }, orderBy: { issuedAt: 'desc' } }),
      this.prisma.authorityFailoverState.findMany({ where: { companyId: ctx.companyId } }),
      this.prisma.authorityAuditJournal.findMany({ where: { companyId: ctx.companyId, outcome: 'REJECTED' }, orderBy: { occurredAt: 'desc' }, take: 50 }),
      this.prisma.authorityAuditJournal.findFirst({ where: { companyId: ctx.companyId, eventType: 'AUTHORITY_CONTROL_PLANE_GATE_PASSED', outcome: 'PASS' }, orderBy: { occurredAt: 'desc' } }),
    ]);
    const heartbeatById = new Map(heartbeats.map((item) => [item.componentId, item]));
    const lastRunByAgent = new Map<string, (typeof runtimeEvents)[number]>();
    for (const event of runtimeEvents) if (!lastRunByAgent.has(event.agentId)) lastRunByAgent.set(event.agentId, event);
    const leaseByAgent = new Map(leases.map((lease) => [lease.agentId, lease]));
    const failoverByScope = new Map(failover.map((item) => [item.scopeId, item]));
    const nodes = registry.map((item) => {
      const heartbeat = heartbeatById.get(item.canonicalId);
      const lastRun = lastRunByAgent.get(item.canonicalId);
      const lease = leaseByAgent.get(item.canonicalId);
      const failoverState = failoverByScope.get(item.scope);
      const canonicalState = resolveCanonicalNodeState({
        registryLifecycleStatus: item.lifecycleStatus,
        ...(heartbeat ? { heartbeat: { status: heartbeat.reportedStatus, observedAt: heartbeat.lastSeenAt } } : {}),
        ...(lastRun ? { runtimeEvent: { status: lastRun.lifecycle, observedAt: lastRun.occurredAt } } : {}),
        ...(lease ? { authorityState: { status: lease.state, observedAt: lease.issuedAt } } : {}),
      });
      return {
        canonicalId: item.canonicalId, kind: item.kind, module: item.module, ownerId: item.ownerId,
        supervisorId: item.supervisorId, scope: item.scope,
        lifecycleStatus: item.lifecycleStatus,
        status: canonicalState.status,
        statusLabel: canonicalState.label,
        statusSource: canonicalState.source,
        statusObservedAt: canonicalState.observedAt,
        telemetry: heartbeat ? { reportedStatus: heartbeat.reportedStatus, lastSeenAt: heartbeat.lastSeenAt, lastSuccessAt: heartbeat.lastSuccessAt, lastFailureAt: heartbeat.lastFailureAt, detail: heartbeat.lastDetail } : null,
        dependencyState: heartbeat?.lastFailureReason ? 'DEGRADED' : heartbeat ? 'PASS' : 'NO_TELEMETRY',
        authorityState: lease ? { state: lease.state, epoch: lease.epoch, fencingToken: lease.fencingToken, providerId: lease.providerId, expiresAt: lease.expiresAt } : { state: item.writePermissions ? 'STANDBY' : 'ADVISORY' },
        failoverState: failoverState?.state ?? 'STANDBY',
        lastRun: lastRun ? { lifecycle: lastRun.lifecycle, occurredAt: lastRun.occurredAt, detail: lastRun.detail } : null,
      };
    });
    const conflicts = findLeaseConflicts(leases);
    return {
      generatedAt: new Date().toISOString(), contractVersion: PREMIUM_NETWORK_CONTRACT_VERSION,
      controlPlane: { canonicalId: 'agm.authority.control-plane', status: conflicts.length ? 'FAIL' : 'PASS', invariant: 'ONE SCOPE → ONE ACTIVE EXECUTIVE AUTHORITY', activeExecutiveAuthorities: leases.filter((lease) => lease.mode === 'EXECUTIVE').length, conflicts },
      nodes,
      departments: [...new Set(nodes.map((node) => node.module))].map((module) => ({ module, nodeCount: nodes.filter((node) => node.module === module).length })),
      incidents: incidents.map((item) => ({ eventId: item.eventId, eventType: item.eventType, scopeId: item.scopeId, reasonCode: item.reasonCode, occurredAt: item.occurredAt })),
      telemetryPolicy: 'OBSERVE_ONLY_NEVER_COMMAND_OR_BLOCK',
      opportunityIntelligence: gatePass ? { gate: 'GO', reason: 'Authority Control Plane runtime gate passed.', evidenceEventId: gatePass.eventId } : { gate: 'NO-GO', reason: 'Requires complete runtime gate evidence.' },
    };
  }

  async registry(ctx: RequestContext) {
    await this.ensureFoundation(ctx);
    return this.prisma.premiumNetworkRegistryEntry.findMany({ where: { companyId: ctx.companyId }, orderBy: { canonicalId: 'asc' } });
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
    return lease;
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

function findLeaseConflicts(leases: Array<{ id: string; scopeId: string; mode: string; writeSet: Prisma.JsonValue; resourceSelectors: Prisma.JsonValue }>) {
  const conflicts: Array<{ leftLeaseId: string; rightLeaseId: string }> = [];
  for (let left = 0; left < leases.length; left += 1) for (let right = left + 1; right < leases.length; right += 1) {
    if (detectAuthorityConflict({ scopeId: leases[left].scopeId, mode: leases[left].mode, writeSet: stringArray(leases[left].writeSet), resourceSelectors: selectorArray(leases[left].resourceSelectors) }, { scopeId: leases[right].scopeId, mode: leases[right].mode, writeSet: stringArray(leases[right].writeSet), resourceSelectors: selectorArray(leases[right].resourceSelectors) }).conflict) conflicts.push({ leftLeaseId: leases[left].id, rightLeaseId: leases[right].id });
  }
  return conflicts;
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
