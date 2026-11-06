import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PROTOCOL_VERSION = 'AGM_MANDATORY_SESSION_MANDATE_PROTOCOL';
const json = (value: unknown) => value as Prisma.InputJsonValue;

export type SessionStartInput = {
  sessionId: string; protocolVersion: string; protocolRead: boolean; archiveInterrogated: boolean;
  librariansActivated: boolean; currentBaseline: string; canonicalSourcesLoaded: boolean;
  actorMatrixLoaded: boolean; worktreeRegistryLoaded: boolean; activeIncidentsLoaded: boolean;
  openMandatesLoaded: boolean; riskKnowledgeAvailable: boolean; actorId: string;
  environmentClass: string; correlationId?: string; evidenceRefs: unknown;
};

export type MandateStartInput = {
  mandateId: string; sessionId: string; mandateRegistered: boolean; archiveSearchComplete: boolean;
  librarianHandoffComplete: boolean; precedentsLoaded: boolean; canonicalSourcesVerified: boolean;
  actorsVerified: boolean; worktreeVerified: boolean; dependencyReview: string; riskPrecheck: string;
  snapshotRef: string; executionAuthorized: boolean; actorRefs: unknown; riskAssessmentId: string; protectionSetId: string; correlationId?: string; evidenceRefs: unknown;
};

export type RiskPrecheckInput = { mandateId: string; verdict: string; baselineRefs: unknown; predictedRisks: unknown; candidateRef: string; worktreeRef: string; canonicalSourceRefs: unknown; writerAuthorityRefs: unknown; createdBy: string; correlationId?: string };

export type MandateEndInput = {
  mandateId: string; technicalResult: string; independentValidation: string; riskPostReview: string;
  finalVerdict: string; incidentsUpdated: boolean; versionUpdated: boolean; cscPcrUpdated: boolean;
  recoveryEvidenceRef?: string; eventLedgerUpdated: boolean; archiveUpdated: boolean;
  lessonsLearned?: string; nextAuthorizedAction?: string; mandateClosed: boolean;
  validatorId: string; riskReviewerId: string; riskPostAssessmentId: string; closedAt?: Date; correlationId?: string; evidenceRefs: unknown;
};

@Injectable()
export class UniversalLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    /* eslint-disable @typescript-eslint/no-explicit-any -- delegate typing kept as validated; lint-only, no behavior change */
    return this.prisma as PrismaService & {
      universalSessionLifecycleRecord: any;
      universalMandateLifecycleRecord: any;
      universalMandateEndRecord: any;
      universalLifecycleEvent: any;
      riskKnowledgeAssessment: any;
      riskKnowledgeProtectionSet: any;
      riskKnowledgeRecheck: any;
      riskKnowledgeComparison: any;
      riskKnowledgeOverride: any;
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  async createSessionStartRecord(input: SessionStartInput) {
    this.require(input.protocolVersion === PROTOCOL_VERSION, 'SESSION_PROTOCOL_VERSION_INVALID');
    const required = [input.protocolRead, input.archiveInterrogated, input.librariansActivated, input.canonicalSourcesLoaded,
      input.actorMatrixLoaded, input.worktreeRegistryLoaded, input.activeIncidentsLoaded, input.openMandatesLoaded, input.riskKnowledgeAvailable];
    this.require(required.every(Boolean), 'SESSION_START_BLOCKED');
    const correlationId = input.correlationId ?? randomUUID();
    const record = await this.db.universalSessionLifecycleRecord.create({ data: {
      sessionId: input.sessionId, protocolVersion: input.protocolVersion, protocolRead: input.protocolRead,
      archiveInterrogated: input.archiveInterrogated, librariansActivated: input.librariansActivated,
      currentBaseline: input.currentBaseline, canonicalSourcesLoaded: input.canonicalSourcesLoaded,
      actorMatrixLoaded: input.actorMatrixLoaded, worktreeRegistryLoaded: input.worktreeRegistryLoaded,
      activeIncidentsLoaded: input.activeIncidentsLoaded, openMandatesLoaded: input.openMandatesLoaded,
      riskKnowledgeAvailable: input.riskKnowledgeAvailable, sessionAuthorized: true, actorId: input.actorId,
      environmentClass: input.environmentClass, correlationId, evidenceRefs: json(input.evidenceRefs), finalStatus: 'AUTHORIZED',
    } });
    await this.appendEvent({ eventType: 'SESSION_START_AUTHORIZED', sessionId: input.sessionId, actor: input.actorId, correlationId, payload: { recordId: record.id } });
    return record;
  }

  async createMandateStartRecord(input: MandateStartInput) {
    const session = await this.db.universalSessionLifecycleRecord.findUnique({ where: { sessionId: input.sessionId } });
    this.require(Boolean(session?.sessionAuthorized && !session.invalidatedAt), 'SESSION_NOT_AUTHORIZED');
    const required = [input.mandateRegistered, input.archiveSearchComplete, input.librarianHandoffComplete, input.precedentsLoaded,
      input.canonicalSourcesVerified, input.actorsVerified, input.worktreeVerified, input.executionAuthorized];
    this.require(required.every(Boolean) && input.riskPrecheck !== 'BLOCK' && input.riskPrecheck !== 'INSUFFICIENT_EVIDENCE', 'MANDATE_START_BLOCKED');
    const assessment = await this.db.riskKnowledgeAssessment.findUnique({ where: { id: input.riskAssessmentId } });
    const protectionSet = await this.db.riskKnowledgeProtectionSet.findUnique({ where: { id: input.protectionSetId } });
    this.require(Boolean(assessment && protectionSet && assessment.mandateId === input.mandateId && assessment.verdict !== 'BLOCK' && protectionSet.mandateId === input.mandateId), 'RISK_PRECHECK_NOT_PERSISTED');
    const correlationId = input.correlationId ?? randomUUID();
    const record = await this.db.universalMandateLifecycleRecord.create({ data: {
      mandateId: input.mandateId, sessionId: input.sessionId, mandateRegistered: input.mandateRegistered,
      archiveSearchComplete: input.archiveSearchComplete, librarianHandoffComplete: input.librarianHandoffComplete,
      precedentsLoaded: input.precedentsLoaded, canonicalSourcesVerified: input.canonicalSourcesVerified,
      actorsVerified: input.actorsVerified, worktreeVerified: input.worktreeVerified, dependencyReview: input.dependencyReview,
      riskPrecheck: input.riskPrecheck, snapshotRef: input.snapshotRef, executionAuthorized: input.executionAuthorized,
      actorRefs: json(input.actorRefs), correlationId, evidenceRefs: json(input.evidenceRefs), status: 'AUTHORIZED',
    } });
    await this.appendEvent({ eventType: 'MANDATE_START_AUTHORIZED', sessionId: input.sessionId, mandateId: input.mandateId, actor: 'universal-lifecycle-writer', correlationId, payload: { recordId: record.id } });
    return record;
  }

  async createRiskPrecheck(input: RiskPrecheckInput) {
    this.require(input.verdict !== 'PASS' || Boolean(input.baselineRefs), 'RISK_BASELINE_REQUIRED');
    const correlationId = input.correlationId ?? randomUUID();
    const assessment = await this.db.riskKnowledgeAssessment.create({ data: { mandateId: input.mandateId, phase: 'PRECHECK', verdict: input.verdict, baselineRefs: json(input.baselineRefs), predictedRisks: json(input.predictedRisks), actualEffects: json([]), missedRisks: json([]), falsePositives: json([]), newPrecedents: json([]), candidateRef: input.candidateRef, worktreeRef: input.worktreeRef, canonicalSourceRefs: json(input.canonicalSourceRefs), writerAuthorityRefs: json(input.writerAuthorityRefs), originalVerdict: input.verdict, correlationId } });
    const protectionSet = await this.db.riskKnowledgeProtectionSet.create({ data: { mandateId: input.mandateId, items: json(input.baselineRefs), createdBy: input.createdBy, correlationId } });
    await this.appendEvent({ eventType: 'RISK_REGRESSION_PRECHECK', mandateId: input.mandateId, actor: input.createdBy, correlationId, payload: { assessmentId: assessment.id, protectionSetId: protectionSet.id } });
    await this.appendEvent({ eventType: 'REGRESSION_PROTECTION_SET_CREATED', mandateId: input.mandateId, actor: input.createdBy, correlationId, payload: { protectionSetId: protectionSet.id } });
    return { assessment, protectionSet };
  }

  async recordRiskRecheck(input: { mandateId: string; trigger: string; verdict: string; stale: boolean; evidenceRefs: unknown; actor: string; correlationId?: string }) {
    const correlationId = input.correlationId ?? randomUUID();
    const recheck = await this.db.riskKnowledgeRecheck.create({ data: { mandateId: input.mandateId, trigger: input.trigger, verdict: input.verdict, stale: input.stale, evidenceRefs: json(input.evidenceRefs), correlationId } });
    await this.appendEvent({ eventType: input.stale ? 'RISK_RECHECK_REQUIRED' : 'RISK_RECHECK_COMPLETED', mandateId: input.mandateId, actor: input.actor, correlationId, payload: { recheckId: recheck.id, trigger: input.trigger } });
    return recheck;
  }

  async recordRiskOverride(input: { mandateId: string; originalRiskVerdict: string; actor: string; reason: string; acceptedRisk: string; scope: string; evidenceRef: string; correlationId?: string }) {
    const correlationId = input.correlationId ?? randomUUID();
    const override = await this.db.riskKnowledgeOverride.create({ data: { mandateId: input.mandateId, originalRiskVerdict: input.originalRiskVerdict, actor: input.actor, reason: input.reason, acceptedRisk: input.acceptedRisk, scope: input.scope, evidenceRef: input.evidenceRef, correlationId } });
    await this.appendEvent({ eventType: 'RISK_OVERRIDE_RECORDED', mandateId: input.mandateId, actor: input.actor, correlationId, payload: { overrideId: override.id, originalRiskVerdict: input.originalRiskVerdict } });
    return override;
  }

  async recordRiskComparison(input: { mandateId: string; capability: string; beforeStatus: string; afterStatus: string; result: string; priority: string; evidenceRef: string; explanation?: string; actor: string }) {
    const comparison = await this.db.riskKnowledgeComparison.create({ data: { mandateId: input.mandateId, capability: input.capability, beforeStatus: input.beforeStatus, afterStatus: input.afterStatus, result: input.result, priority: input.priority, evidenceRef: input.evidenceRef, explanation: input.explanation } });
    await this.appendEvent({ eventType: ['DEGRADED', 'DISCONNECTED', 'LOST'].includes(input.afterStatus) ? 'REGRESSION_DETECTED' : 'REGRESSION_COMPARISON_RECORDED', mandateId: input.mandateId, actor: input.actor, correlationId: randomUUID(), payload: { comparisonId: comparison.id, capability: input.capability, beforeStatus: input.beforeStatus, afterStatus: input.afterStatus } });
    return comparison;
  }

  async recordRiskPostReview(input: { mandateId: string; verdict: string; actualEffects: unknown; missedRisks: unknown; falsePositives: unknown; newPrecedents: unknown; candidateRef: string; worktreeRef: string; actor: string; correlationId?: string }) {
    const correlationId = input.correlationId ?? randomUUID();
    const assessment = await this.db.riskKnowledgeAssessment.create({ data: { mandateId: input.mandateId, phase: 'POST_REVIEW', verdict: input.verdict, baselineRefs: json([]), predictedRisks: json([]), actualEffects: json(input.actualEffects), missedRisks: json(input.missedRisks), falsePositives: json(input.falsePositives), newPrecedents: json(input.newPrecedents), candidateRef: input.candidateRef, worktreeRef: input.worktreeRef, canonicalSourceRefs: json([]), writerAuthorityRefs: json([]), originalVerdict: input.verdict, correlationId } });
    await this.appendEvent({ eventType: 'REGRESSION_POST_REVIEW', mandateId: input.mandateId, actor: input.actor, correlationId, payload: { assessmentId: assessment.id, verdict: input.verdict } });
    return assessment;
  }

  async createMandateEndRecord(input: MandateEndInput) {
    const start = await this.db.universalMandateLifecycleRecord.findUnique({ where: { mandateId: input.mandateId } });
    this.require(Boolean(start?.executionAuthorized && !start.invalidatedAt), 'MANDATE_START_NOT_PERSISTED');
    this.require(input.technicalResult === 'PASS' && input.independentValidation === 'PASS' && input.riskPostReview !== 'BLOCK', 'MANDATE_CLOSURE_BLOCKED');
    this.require(input.finalVerdict === 'PASS' && input.mandateClosed, 'FINAL_VERDICT_NOT_CLOSED');
    this.require(input.incidentsUpdated && input.versionUpdated && input.cscPcrUpdated && input.eventLedgerUpdated && input.archiveUpdated, 'MANDATE_CLOSURE_EVIDENCE_INCOMPLETE');
    const postReview = await this.db.riskKnowledgeAssessment.findUnique({ where: { id: input.riskPostAssessmentId } });
    const comparisons = await this.db.riskKnowledgeComparison.findMany({ where: { mandateId: input.mandateId } });
    this.require(Boolean(postReview && postReview.mandateId === input.mandateId && postReview.phase === 'POST_REVIEW' && postReview.verdict !== 'BLOCK'), 'RISK_POST_REVIEW_NOT_PERSISTED');
    this.require(comparisons.length > 0 && comparisons.every((item: { afterStatus: string; priority: string }) => !(item.priority === 'P0' || item.priority === 'P1') || item.afterStatus === 'PRESERVED' || item.afterStatus === 'INTENTIONALLY_SUPERSEDED'), 'REGRESSION_COMPARISON_BLOCKS_CLOSURE');
    const correlationId = input.correlationId ?? randomUUID();
    const record = await this.db.universalMandateEndRecord.create({ data: {
      mandateId: input.mandateId, technicalResult: input.technicalResult, independentValidation: input.independentValidation,
      riskPostReview: input.riskPostReview, finalVerdict: input.finalVerdict, incidentsUpdated: input.incidentsUpdated,
      versionUpdated: input.versionUpdated, cscPcrUpdated: input.cscPcrUpdated, recoveryEvidenceRef: input.recoveryEvidenceRef,
      eventLedgerUpdated: input.eventLedgerUpdated, archiveUpdated: input.archiveUpdated, lessonsLearned: input.lessonsLearned,
      nextAuthorizedAction: input.nextAuthorizedAction, mandateClosed: input.mandateClosed, validatorId: input.validatorId,
      riskReviewerId: input.riskReviewerId, closedAt: input.closedAt ?? new Date(), correlationId, evidenceRefs: json(input.evidenceRefs),
    } });
    await this.appendEvent({ eventType: 'MANDATE_CLOSED', mandateId: input.mandateId, actor: input.validatorId, correlationId, payload: { recordId: record.id, finalVerdict: input.finalVerdict } });
    return record;
  }

  async assertOperationalExecution(sessionId: string | undefined, mandateId: string) {
    this.require(Boolean(sessionId?.trim()), 'SESSION_ID_REQUIRED_FOR_OPERATIONAL_EXECUTION');
    const session = await this.db.universalSessionLifecycleRecord.findUnique({ where: { sessionId } });
    const mandate = await this.db.universalMandateLifecycleRecord.findUnique({ where: { mandateId } });
    this.require(Boolean(session?.sessionAuthorized && !session.invalidatedAt), 'SESSION_NOT_AUTHORIZED');
    this.require(Boolean(mandate?.sessionId === sessionId && mandate.executionAuthorized && !mandate.invalidatedAt), 'MANDATE_START_NOT_PERSISTED');
    return { sessionId, mandateId, authorized: true as const };
  }

  private async appendEvent(input: { eventType: string; sessionId?: string; mandateId?: string; actor: string; correlationId: string; payload: unknown }) {
    const previous = await this.db.universalLifecycleEvent.findFirst({ orderBy: { occurredAt: 'desc' } });
    const id = randomUUID();
    const eventDigest = createHash('sha256').update(JSON.stringify({ id, ...input, previousEventId: previous?.id ?? null, previousDigest: previous?.eventDigest ?? null })).digest('hex');
    return this.db.universalLifecycleEvent.create({ data: { id, ...input, previousEventId: previous?.id, previousDigest: previous?.eventDigest, eventDigest, payload: json(input.payload) } });
  }

  private require(condition: boolean, reason: string): asserts condition {
    if (!condition) throw new ForbiddenException(reason);
  }
}
