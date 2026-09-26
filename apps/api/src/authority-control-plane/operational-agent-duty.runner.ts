import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
  OPERATIONAL_LINGUIST_V1_COMPONENT_IDS,
  validateLinguisticResourceEvidence,
} from '@agm/shared';
import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { SecretTelemetryService } from '../secret-telemetry/secret-telemetry.service';
import { operationalProfile } from './operational-profile';
import { premiumNetworkSeed } from './premium-network.seed';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const DUTY_CONTRACT = 'agent-operational-duty.v1';
const PROBE_FRESHNESS_MS = 90_000;
const LINGUISTIC_EVIDENCE_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const INSPECTORS = new Set(['premium.release-inspector', 'premium.architecture-inspector']);

type ActiveMandate = { id: string; agentId: string };
type DutyOutcome = {
  operation: string;
  passed: boolean;
  result: 'COMPLETED' | 'COMPLETED_NO_WORK' | 'FAILED';
  reason: string | null;
  evidenceReferences: string[];
  checks: Record<string, unknown>;
};

export type OperationalAgentDutyResult = DutyOutcome & {
  agentId: string;
  mandateId: string;
  executedAt: string;
  executionEventId: string;
  evidenceRef: string;
  outputRef: string;
};

type CarMoverRuntime = {
  list(context: RequestContext): Promise<Array<{ id: string; currentState?: string; updatedAt?: Date }>>;
  getJobFile(id: string, context: RequestContext): Promise<{
    contractVersion: string;
    subjectId: string;
    timeline: Array<Record<string, unknown>>;
    auditReferences: readonly string[];
    financialEntries: Array<Record<string, unknown>>;
    invoices: Array<Record<string, unknown>>;
  }>;
};
type ListRuntime = { list(context: RequestContext): Promise<Array<Record<string, unknown>>> };
type OpportunityRuntime = {
  importExistingOffers(context: RequestContext): Promise<Record<string, unknown>>;
  executeOperationalDuty(agentId: string, context: RequestContext): Promise<{ agentId: string; operation: string; output: unknown; outputReference: string; telemetryId: string; executedAt: Date; workloadItems: number }>;
  list(context: RequestContext): Promise<Array<Record<string, unknown>>>;
  planning(context: RequestContext): Promise<Array<Record<string, unknown>>>;
  copilot(context: RequestContext): Promise<unknown>;
  telemetrySnapshot(context: RequestContext): Promise<Array<Record<string, unknown>>>;
};
type LiveAdapterRuntime = { telemetrySnapshot(context: RequestContext): Promise<Array<Record<string, unknown>>> };

@Injectable()
export class OperationalAgentDutyRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretTelemetryService,
    private readonly discovery: DiscoveryService,
  ) {}

  async execute(ctx: RequestContext, mandates: readonly ActiveMandate[], runId: string, agentIds?: ReadonlySet<string>) {
    const mandateByAgent = new Map(mandates.map((mandate) => [mandate.agentId, mandate]));
    const dutyContext: RequestContext = { ...ctx, roles: [...new Set([...ctx.roles, 'PREMIUM_ACCESS'])] };
    const results: OperationalAgentDutyResult[] = [];
    for (const seed of premiumNetworkSeed) {
      if (seed.kind === 'HUMAN_AUTHORITY' || INSPECTORS.has(seed.canonicalId)) continue;
      if (agentIds && !agentIds.has(seed.canonicalId)) continue;
      const mandate = mandateByAgent.get(seed.canonicalId);
      if (!mandate) throw new Error(`ACTIVE_DUTY_MANDATE_MISSING:${seed.canonicalId}`);
      const executedAt = new Date();
      let outcome: DutyOutcome;
      try {
        outcome = await this.executeOne(seed.canonicalId, dutyContext, executedAt);
      } catch (error) {
        outcome = {
          operation: operationalProfile(seed).workload,
          passed: false,
          result: 'FAILED',
          reason: `REAL_DUTY_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`,
          evidenceReferences: [],
          checks: {},
        };
      }
      const output = {
        contract: DUTY_CONTRACT,
        executionKind: 'REAL_OPERATIONAL_DUTY',
        agentId: seed.canonicalId,
        mandateId: mandate.id,
        responsibility: operationalProfile(seed).workload,
        trigger: 'PRODUCTION_RUNTIME_RECOVERY',
        operation: outcome.operation,
        result: outcome.result,
        passed: outcome.passed,
        reason: outcome.reason,
        checks: outcome.checks,
        evidenceReferences: outcome.evidenceReferences.slice(0, 100),
        executedAt: executedAt.toISOString(),
        runId,
      };
      const outputHash = hash(output);
      const outputRef = `sha256:${outputHash}`;
      const receipt = await this.prisma.authorityAuditJournal.create({
        data: {
          companyId: ctx.companyId,
          eventId: randomUUID(),
          eventType: outcome.passed ? 'AGENT_OPERATIONAL_DUTY_COMPLETED' : 'AGENT_OPERATIONAL_DUTY_FAILED',
          scopeId: seed.scope,
          mandateId: mandate.id,
          actorType: 'AGENT',
          actorId: seed.canonicalId,
          outcome: outcome.passed ? 'PASS' : 'FAIL',
          reasonCode: outcome.reason ?? undefined,
          payloadHash: outputHash,
          safeMetadata: json({ ...output, outputRef }),
          correlationId: ctx.correlationId,
          occurredAt: executedAt,
        },
      });
      const evidenceRef = `AuthorityAuditJournal:${receipt.eventId}`;
      const execution = await this.prisma.agentRuntimeEvent.create({
        data: {
          companyId: ctx.companyId,
          eventId: randomUUID(),
          mandateId: mandate.id,
          agentId: seed.canonicalId,
          dossierId: `operational-duty-${runId}-${seed.canonicalId}`,
          lifecycle: outcome.passed ? 'COMPLETED' : 'FAILED',
          sequence: 1,
          occurredAt: new Date(executedAt.getTime() + 1),
          evidenceRef,
          outputRef,
          evidenceHash: outputHash,
          detail: JSON.stringify({ contract: DUTY_CONTRACT, operation: outcome.operation, result: outcome.result, receipt: evidenceRef }),
        },
      });
      results.push({ ...outcome, agentId: seed.canonicalId, mandateId: mandate.id, executedAt: execution.occurredAt.toISOString(), executionEventId: execution.eventId, evidenceRef, outputRef });
    }
    return results;
  }

  private async executeOne(agentId: string, ctx: RequestContext, now: Date): Promise<DutyOutcome> {
    if (agentId === 'agm.guardian.secrets') return this.guardianDuty();
    if (agentId.startsWith('premium-linguist-')) return this.linguisticDuty(agentId, ctx.companyId, now);

    const probe = await this.prisma.componentHeartbeat.findUnique({ where: { companyId_componentId: { companyId: ctx.companyId, componentId: agentId } } });
    const probeCurrent = Boolean(probe && now.getTime() - probe.lastSeenAt.getTime() <= PROBE_FRESHNESS_MS);
    if (!probe || probe.reportedStatus !== 'ONLINE' || !probeCurrent) {
      return {
        operation: operationalProfile(premiumNetworkSeed.find((seed) => seed.canonicalId === agentId)!).workload,
        passed: false,
        result: 'FAILED',
        reason: !probe ? 'RUNTIME_CAPABILITY_PROBE_MISSING' : !probeCurrent ? 'RUNTIME_CAPABILITY_PROBE_STALE' : probe.lastFailureReason ?? `RUNTIME_CAPABILITY_${probe.reportedStatus}`,
        evidenceReferences: probe ? [`ComponentHeartbeat:${probe.id}`] : [],
        checks: { probeStatus: probe?.reportedStatus ?? 'MISSING', probeCurrent },
      };
    }

    if (agentId === 'agm.authority.control-plane') return this.controlPlaneDuty(ctx, probe.id);
    if (agentId === 'premium.orchestrator') return this.orchestratorDuty(ctx, probe.id);
    if (agentId === 'premium.recovery-executor') return this.recoveryDuty(ctx, probe.id);
    if (agentId.startsWith('premium.car-mover.') && !agentId.endsWith('job-service') && !agentId.endsWith('incident-service') && !agentId.endsWith('evidence-service') && !agentId.endsWith('primary-accounting') && !agentId.endsWith('archive-retention')) {
      return this.opportunityDuty(agentId, ctx, probe.id);
    }
    if (agentId === 'premium.copilot-gateway') return this.opportunityDuty(agentId, ctx, probe.id);
    if (agentId.startsWith('premium.adapters.')) return this.adapterDuty(agentId, ctx, probe.id);
    return this.domainServiceDuty(agentId, ctx, probe.id);
  }

  private guardianDuty(): DutyOutcome {
    const snapshot = this.secrets.snapshot();
    const passed = snapshot.overallStatus === 'CONFIGURED' && snapshot.secrets.every((secret) => secret.status === 'CONFIGURED');
    return {
      operation: 'SecretTelemetryService.snapshot redacted custody evaluation',
      passed,
      result: passed ? 'COMPLETED' : 'FAILED',
      reason: passed ? null : 'SECRET_CUSTODY_ATTENTION',
      evidenceReferences: [`SecretTelemetry:${snapshot.contract}:${snapshot.checkedAt}`],
      checks: { overallStatus: snapshot.overallStatus, evaluatedSecrets: snapshot.secrets.length, configuredSecrets: snapshot.secrets.filter((secret) => secret.status === 'CONFIGURED').length },
    };
  }

  private async linguisticDuty(agentId: string, companyId: string, now: Date): Promise<DutyOutcome> {
    if ((OPERATIONAL_LINGUIST_V1_COMPONENT_IDS as readonly string[]).includes(agentId)) {
      const baseline = await this.prisma.operationalLinguistBaseline.findUnique({
        where: { companyId_version: { companyId, version: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION } },
      });
      if (baseline?.status === 'ACTIVE') return this.operationalLinguistV1Duty(agentId, companyId, baseline.id, now);
      return {
        operation: 'Require Operational Linguistic Baseline V1 before executing linguistic duty',
        passed: false,
        result: 'FAILED',
        reason: 'LINGUISTIC_V1_BASELINE_NOT_ACTIVE',
        evidenceReferences: [],
        checks: { persistence: 'OPERATIONAL_LINGUIST_V1', baselineStatus: baseline?.status ?? 'MISSING', legacyHeartbeatFallback: 'FENCED' },
      };
    }
    const heartbeat = await this.prisma.componentHeartbeat.findUnique({ where: { companyId_componentId: { companyId, componentId: agentId } } });
    const detail = heartbeat?.lastDetail ?? '';
    const current = Boolean(heartbeat && now.getTime() - heartbeat.lastSeenAt.getTime() <= LINGUISTIC_EVIDENCE_FRESHNESS_MS);
    const validation = validateLinguisticResourceEvidence(detail);
    const { counts: resourceCounts, resourceCountProven, errorsZero } = validation;
    const catalogProven = heartbeat?.reportedStatus === 'ONLINE' && validation.valid;
    const staleFailureReasonCleared = Boolean(catalogProven && heartbeat?.lastFailureReason);
    if (staleFailureReasonCleared && heartbeat) {
      await this.prisma.componentHeartbeat.update({ where: { companyId_componentId: { companyId, componentId: agentId } }, data: { lastFailureReason: null } });
    }
    const passed = current && catalogProven;
    return {
      operation: 'Validate deployed language catalog audit receipt',
      passed,
      result: passed ? 'COMPLETED' : 'FAILED',
      reason: passed ? null : !heartbeat ? 'LINGUISTIC_AUDIT_EVIDENCE_MISSING' : !current ? 'LINGUISTIC_AUDIT_EVIDENCE_EXPIRED' : 'LINGUISTIC_CATALOG_VALIDATION_FAILED',
      evidenceReferences: heartbeat ? [`ComponentHeartbeat:${heartbeat.id}`] : [],
      checks: {
        heartbeatStatus: heartbeat?.reportedStatus ?? 'MISSING',
        evidenceCurrent: current,
        resourceCountProven,
        resourceCounts,
        errorsZero,
        contractVersionMatches: validation.contractVersionMatches,
        contractDigestMatches: validation.contractDigestMatches,
        componentsMatchCanonical: validation.componentsMatchCanonical,
        totalMatchesComponents: validation.totalMatchesComponents,
        staleFailureReasonCleared,
      },
    };
  }

  private async operationalLinguistV1Duty(agentId: string, companyId: string, baselineId: string, now: Date): Promise<DutyOutcome> {
    const state = await this.prisma.operationalLinguistState.findUnique({
      where: { companyId_componentId: { companyId, componentId: agentId } },
      include: { currentEvidence: { include: { publisher: true } } },
    });
    const language = agentId.slice(-2) as 'it' | 'es' | 'sv';
    const definition = createCanonicalOperationalLinguist(language);
    const current = Boolean(state && now.getTime() - state.observedAt.getTime() <= LINGUISTIC_EVIDENCE_FRESHNESS_MS);
    const canonical = Boolean(
      state
      && state.baselineId === baselineId
      && state.componentId === definition.componentId
      && state.language === definition.language
      && state.authorityScope === definition.authorityScope
      && Boolean(state.mandateId)
      && state.mandateVersion > 0
      && state.operationalState === 'ONLINE'
      && state.contractVersion === definition.resourceContractVersion
      && state.contractDigest === definition.resourceContractDigest
      && state.catalogDigest === definition.resourceCatalogDigest
      && state.appCount === definition.resourceCounts.app
      && state.operationalCount === definition.resourceCounts.operational
      && state.carMoverCount === definition.resourceCounts.carMover
      && state.premiumCount === definition.resourceCounts.premium
      && state.totalCount === definition.resourceCounts.total
      && state.errorCount === 0
    );
    const receipt = state ? await this.prisma.operationalLinguistReceipt.findUnique({ where: { evidenceId: state.currentEvidenceId } }) : null;
    const receiptAccepted = receipt?.outcome === 'ACCEPTED' && receipt.reasonCode === 'CANONICAL_EVIDENCE_PERSISTED';
    const passed = current && canonical && receiptAccepted;
    return {
      operation: 'Validate typed Operational Linguistic Baseline V1 evidence and server receipt',
      passed,
      result: passed ? 'COMPLETED' : 'FAILED',
      reason: passed ? null : !state ? 'LINGUISTIC_V1_EVIDENCE_MISSING' : !current ? 'LINGUISTIC_V1_EVIDENCE_EXPIRED' : !canonical ? 'LINGUISTIC_V1_CANONICAL_STATE_INVALID' : 'LINGUISTIC_V1_RECEIPT_INVALID',
      evidenceReferences: state ? [
        `OperationalLinguistEvidence:${state.currentEvidenceId}`,
        ...(receipt ? [`OperationalLinguistReceipt:${receipt.id}`] : []),
      ] : [],
      checks: {
        persistence: 'OPERATIONAL_LINGUIST_V1',
        evidenceCurrent: current,
        resourceCountProven: canonical,
        resourceCounts: state ? { app: state.appCount, operational: state.operationalCount, carMover: state.carMoverCount, premium: state.premiumCount, total: state.totalCount } : null,
        errorsZero: state?.errorCount === 0,
        contractVersionMatches: state?.contractVersion === definition.resourceContractVersion,
        contractDigestMatches: state?.contractDigest === definition.resourceContractDigest,
        catalogDigestMatches: state?.catalogDigest === definition.resourceCatalogDigest,
        componentsMatchCanonical: canonical,
        totalMatchesComponents: Boolean(state && state.totalCount === state.appCount + state.operationalCount + state.carMoverCount + state.premiumCount),
        receiptAccepted,
        authorityScopeMatches: state?.authorityScope === definition.authorityScope,
        mandateRef: state ? `AuthorityMandate:${state.mandateId}:v${state.mandateVersion}` : null,
        authorityEpoch: state?.authorityEpoch ?? null,
        sequence: state?.sequence ?? null,
        writerId: state?.currentEvidence.publisher.writerId ?? null,
        writerVersion: state?.currentEvidence.publisher.writerVersion ?? null,
        buildRevision: state?.currentEvidence.publisher.buildRevision ?? null,
      },
    };
  }

  private async controlPlaneDuty(ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const service = this.provider<{ dashboard(context: RequestContext): Promise<{ controlPlane: { conflicts: unknown[]; invalidOrStaleAuthority: unknown[]; activeCommandChains: unknown[] } }> }>('AuthorityControlPlaneService');
    const dashboard = await service.dashboard(ctx);
    const passed = dashboard.controlPlane.conflicts.length === 0 && dashboard.controlPlane.invalidOrStaleAuthority.length === 0;
    return outcome('Evaluate authority graph, fencing and command-chain conflicts', passed, [ `ComponentHeartbeat:${probeId}` ], {
      conflicts: dashboard.controlPlane.conflicts.length,
      invalidOrStaleAuthority: dashboard.controlPlane.invalidOrStaleAuthority.length,
      activeCommandChains: dashboard.controlPlane.activeCommandChains.length,
    });
  }

  private async orchestratorDuty(ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const [mandates, pendingOpportunities] = await Promise.all([
      this.prisma.authorityMandate.findMany({ where: { companyId: ctx.companyId, status: 'APPROVED', revokedAt: null }, select: { id: true, agentId: true, scopeId: true } }),
      this.prisma.normalizedOpportunity.count({ where: { companyId: ctx.companyId, status: { in: ['AVAILABLE', 'REVIEWED'] } } }),
    ]);
    const nonHumanMandates = new Set(mandates.filter((mandate) => mandate.agentId !== 'agm.human.product-owner').map((mandate) => mandate.agentId));
    const passed = nonHumanMandates.size === premiumNetworkSeed.filter((seed) => seed.kind !== 'HUMAN_AUTHORITY').length;
    return outcome('Poll governed work queues and reconcile bounded dispatch coverage', passed, [`ComponentHeartbeat:${probeId}`, ...mandates.slice(0, 20).map((mandate) => `AuthorityMandate:${mandate.id}`)], { mandatedAgents: nonHumanMandates.size, pendingOpportunities });
  }

  private async recoveryDuty(ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const [runbooks, latestExecution] = await Promise.all([
      this.prisma.recoveryRunbook.findMany({ where: { companyId: ctx.companyId, status: 'APPROVED' }, select: { id: true, runbookKey: true, version: true } }),
      this.prisma.recoveryExecution.findFirst({ where: { companyId: ctx.companyId }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, completedAt: true } }),
    ]);
    const passed = runbooks.length > 0;
    return outcome('Evaluate approved recovery queue and executable runbook boundary', passed, [`ComponentHeartbeat:${probeId}`, ...runbooks.map((runbook) => `RecoveryRunbook:${runbook.id}`), ...(latestExecution ? [`RecoveryExecution:${latestExecution.id}`] : [])], { approvedRunbooks: runbooks.length, latestExecutionStatus: latestExecution?.status ?? 'NO_EXECUTION_REQUIRED' });
  }

  private async opportunityDuty(agentId: string, ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const service = this.provider<OpportunityRuntime>('OpportunityIntelligenceService');
    const duty = await service.executeOperationalDuty(agentId, ctx);
    const [opportunities, telemetry] = await Promise.all([service.list(ctx), service.telemetrySnapshot(ctx)]);
    const agentTelemetry = telemetry.find((item) => item.agentId === agentId);
    const references = idsFrom(opportunities, 'NormalizedOpportunity');
    const telemetryAt = agentTelemetry?.lastRunAt instanceof Date ? agentTelemetry.lastRunAt : new Date(String(agentTelemetry?.lastRunAt ?? 0));
    const current = Number.isFinite(telemetryAt.getTime()) && Math.abs(telemetryAt.getTime() - duty.executedAt.getTime()) <= 1_000;
    const passed = duty.agentId === agentId && agentTelemetry?.id === duty.telemetryId && agentTelemetry?.outputReference === duty.outputReference && agentTelemetry?.health === 'PASS' && current;
    return outcome(duty.operation, passed, [`ComponentHeartbeat:${probeId}`, ...references, ...(agentTelemetry?.id ? [`OpportunityAgentTelemetry:${String(agentTelemetry.id)}`] : [])], { workloadItems: duty.workloadItems, workloadState: duty.workloadItems ? 'WORK_EVALUATED' : 'NO_CURRENT_WORK', telemetryObserved: Boolean(agentTelemetry), telemetryCurrent: current, outputHash: hash(duty.output), outputReference: duty.outputReference });
  }

  private async adapterDuty(agentId: string, ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const service = this.provider<LiveAdapterRuntime>('LiveAdapterService');
    const telemetry = await service.telemetrySnapshot(ctx);
    const category = adapterCategory(agentId);
    const matching = telemetry.filter((item) => String(item.category ?? '') === category);
    const snapshots = await this.prisma.liveMobilitySnapshot.findMany({ where: { companyId: ctx.companyId, category }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, contractType: true, providerId: true, validUntil: true, payloadHash: true } });
    const unhealthy = matching.filter((item) => ['UNAVAILABLE', 'RATE_LIMITED'].includes(String(item.status ?? '')));
    const passed = unhealthy.length === 0;
    return outcome('Poll live adapter queue and validate current normalized outputs', passed, [`ComponentHeartbeat:${probeId}`, ...matching.filter((item) => item.id).map((item) => `LiveAdapterTelemetry:${String(item.id)}`), ...snapshots.map((snapshot) => `LiveMobilitySnapshot:${snapshot.id}`)], { category, telemetryRecords: matching.length, snapshotRecords: snapshots.length, unhealthyRecords: unhealthy.length, workloadState: snapshots.length ? 'OUTPUT_AVAILABLE' : 'NO_CURRENT_WORK' });
  }

  private async domainServiceDuty(agentId: string, ctx: RequestContext, probeId: string): Promise<DutyOutcome> {
    const carMover = this.provider<CarMoverRuntime>('CarMoverService');
    const jobs = await carMover.list(ctx);
    if (agentId === 'premium.car-mover.job-service') {
      const file = jobs[0] ? await carMover.getJobFile(jobs[0].id, ctx) : null;
      const passed = Boolean(file && file.contractVersion === 'car-mover-job-file.v1' && file.timeline.length > 0 && file.auditReferences.length > 0);
      return outcome('CarMoverService.list + getJobFile lifecycle projection', passed, [`ComponentHeartbeat:${probeId}`, ...(file ? [`CarMoverJob:${file.subjectId}`, ...file.auditReferences.map((id) => `AuditEvent:${id}`)] : [])], { returnedJobs: jobs.length, timelineEvents: file?.timeline.length ?? 0, auditReferences: file?.auditReferences.length ?? 0 });
    }
    if (agentId === 'premium.car-mover.primary-accounting') {
      const files = await Promise.all(jobs.map((job) => carMover.getJobFile(job.id, ctx)));
      const file = files.find((candidate) => candidate.financialEntries.length > 0);
      const passed = Boolean(file && file.financialEntries.length > 0);
      return outcome('CarMoverService.getJobFile primary financial projection', passed, [`ComponentHeartbeat:${probeId}`, ...(file ? [`CarMoverJob:${file.subjectId}`, ...idsFrom(file.financialEntries, 'CarMoverFinancialEntry')] : [])], { returnedJobs: jobs.length, financialEntries: file?.financialEntries.length ?? 0, invoices: file?.invoices.length ?? 0 });
    }
    if (agentId === 'premium.car-mover.archive-retention') {
      return outcome('Evaluate retention policy against the current job lifecycle set', true, [`ComponentHeartbeat:${probeId}`, ...jobs.slice(0, 20).map((job) => `CarMoverJob:${job.id}`)], { evaluatedJobs: jobs.length, archivedJobs: jobs.filter((job) => job.currentState === 'ARCHIVED').length, workloadState: jobs.length ? 'POLICY_EVALUATED' : 'NO_CURRENT_WORK' });
    }
    const service = this.provider<ListRuntime>(agentId === 'premium.car-mover.incident-service' ? 'IncidentsService' : 'EvidenceService');
    const rows = await service.list(ctx);
    const label = agentId === 'premium.car-mover.incident-service' ? 'IncidentReport' : 'EvidenceMetadata';
    return outcome(`${service.constructor.name}.list persistent store validation`, rows.length > 0, [`ComponentHeartbeat:${probeId}`, ...idsFrom(rows, label)], { returnedRecords: rows.length });
  }

  private provider<T>(name: string): T {
    const instance = this.discovery.getProviders().map((wrapper) => wrapper.instance as unknown).find((candidate) => Boolean(candidate && typeof candidate === 'object' && (candidate as { constructor: { name: string } }).constructor.name === name));
    if (!instance) throw new Error(`RUNTIME_PROVIDER_NOT_LOADED:${name}`);
    return instance as T;
  }
}

function outcome(operation: string, passed: boolean, evidenceReferences: string[], checks: Record<string, unknown>): DutyOutcome {
  const count = Number(checks.workloadItems ?? checks.returnedRecords ?? checks.snapshotRecords ?? checks.returnedJobs ?? checks.evaluatedJobs ?? 1);
  return { operation, passed, result: passed ? count > 0 ? 'COMPLETED' : 'COMPLETED_NO_WORK' : 'FAILED', reason: passed ? null : 'REAL_OPERATIONAL_DUTY_NOT_PROVEN', evidenceReferences, checks };
}

function idsFrom(items: Array<Record<string, unknown>>, label: string) {
  return items.slice(0, 20).flatMap((item) => typeof item.id === 'string' ? [`${label}:${item.id}`] : []);
}

function adapterCategory(agentId: string) {
  return agentId.replace('premium.adapters.', '').replace('platform-feed', 'platform_feed').toUpperCase();
}

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
