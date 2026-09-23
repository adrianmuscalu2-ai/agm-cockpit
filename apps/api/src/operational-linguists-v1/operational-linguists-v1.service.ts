import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
  OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
  OPERATIONAL_LINGUIST_V1_COMPONENT_IDS,
  OPERATIONAL_LINGUIST_V1_WRITER_ID,
  OPERATIONAL_LINGUIST_V1_WRITER_VERSION,
  validateOperationalLinguistV1Evidence,
  type OperationalLinguistV1Evidence,
} from '@agm/shared';
import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, type OperationalLinguistBaseline, type OperationalLinguistPublisher } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPERATIONAL_LINGUIST_V1_FRESHNESS_MS,
  OPERATIONAL_LINGUIST_V1_MAX_FUTURE_SKEW_MS,
  OPERATIONAL_LINGUIST_V1_MAX_PAST_SKEW_MS,
  OPERATIONAL_LINGUIST_V1_PUBLISHER_TTL_MS,
  type OperationalLinguistV1Actor,
} from './operational-linguists-v1.contract';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class OperationalLinguistsV1Service {
  constructor(private readonly prisma: PrismaService) {}

  async registerPublisher(actor: OperationalLinguistV1Actor) {
    this.requirePublisherRole(actor);
    const now = new Date();
    return this.serializable(async (tx) => {
      await lock(tx, actor.companyId);
      let baseline = await tx.operationalLinguistBaseline.findUnique({
        where: { companyId_version: { companyId: actor.companyId, version: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION } },
      });
      if (!baseline) {
        this.requireDeploymentRole(actor);
        baseline = await tx.operationalLinguistBaseline.create({
          data: {
            companyId: actor.companyId,
            version: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
            digest: OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
            status: 'PREPARED',
          },
        });
      }
      if (baseline.digest !== OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST || baseline.status === 'SUSPENDED') {
        throw new ConflictException('OPERATIONAL_LINGUIST_V1_BASELINE_UNAVAILABLE');
      }
      if (actor.roles[0] === 'AGENT_RUNTIME_CONTINUITY' && baseline.status !== 'ACTIVE') {
        throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_CONTINUITY_REQUIRES_ACTIVE_BASELINE');
      }
      await tx.operationalLinguistPublisher.updateMany({
        where: { baselineId: baseline.id, revokedAt: null },
        data: { revokedAt: now },
      });
      const authorityEpoch = baseline.authorityEpoch + 1;
      baseline = await tx.operationalLinguistBaseline.update({
        where: { id: baseline.id },
        data: { authorityEpoch },
      });
      const publisher = await tx.operationalLinguistPublisher.create({
        data: {
          companyId: actor.companyId,
          baselineId: baseline.id,
          authorityEpoch,
          writerId: OPERATIONAL_LINGUIST_V1_WRITER_ID,
          writerVersion: OPERATIONAL_LINGUIST_V1_WRITER_VERSION,
          buildRevision: requiredMetadata(actor, 'sha'),
          workflowRef: requiredMetadata(actor, 'workflowRef'),
          runId: requiredMetadata(actor, 'runId'),
          runAttempt: requiredMetadata(actor, 'runAttempt'),
          authorityRole: actor.roles[0],
          issuedAt: now,
          expiresAt: new Date(now.getTime() + OPERATIONAL_LINGUIST_V1_PUBLISHER_TTL_MS),
        },
      });
      return publicPublisher(publisher, baseline.status);
    });
  }

  async activate(input: unknown, actor: OperationalLinguistV1Actor) {
    this.requireDeploymentRole(actor);
    if (!record(input) || !Array.isArray(input.evidence) || Object.keys(input).some((key) => key !== 'evidence')) {
      throw new UnprocessableEntityException('OPERATIONAL_LINGUIST_V1_ACTIVATION_INVALID');
    }
    const evidence = input.evidence.map((item) => this.validateEvidence(item, new Date()));
    const componentIds = evidence.map((item) => item.componentId);
    if (evidence.length !== OPERATIONAL_LINGUIST_V1_COMPONENT_IDS.length
      || new Set(componentIds).size !== OPERATIONAL_LINGUIST_V1_COMPONENT_IDS.length
      || OPERATIONAL_LINGUIST_V1_COMPONENT_IDS.some((componentId) => !componentIds.includes(componentId))) {
      throw new UnprocessableEntityException('OPERATIONAL_LINGUIST_V1_ACTIVATION_REQUIRES_COMPLETE_UNIQUE_FLEET');
    }
    return this.serializable(async (tx) => {
      await lock(tx, actor.companyId);
      const { baseline, publisher } = await this.resolveAuthority(tx, actor, evidence[0].publisher.registrationId, 'ACTIVATABLE');
      if (evidence.some((item) => item.publisher.registrationId !== publisher.id || item.publisher.authorityEpoch !== publisher.authorityEpoch)) {
        throw new ConflictException('OPERATIONAL_LINGUIST_V1_ACTIVATION_AUTHORITY_MISMATCH');
      }
      const mandates = new Map<string, Awaited<ReturnType<OperationalLinguistsV1Service['assertMandate']>>>();
      for (const item of evidence) mandates.set(item.componentId, await this.assertMandate(tx, actor.companyId, item, new Date()));
      const accepted = [];
      for (const item of evidence) accepted.push(await this.accept(tx, baseline, publisher, item, mandates.get(item.componentId)!, new Date()));
      await tx.operationalLinguistBaseline.update({ where: { id: baseline.id }, data: { status: 'ACTIVE', activatedAt: new Date() } });
      return { baselineVersion: baseline.version, baselineDigest: baseline.digest, status: 'ACTIVE', components: accepted };
    });
  }

  async heartbeat(input: unknown, actor: OperationalLinguistV1Actor) {
    this.requirePublisherRole(actor);
    const now = new Date();
    const evidence = this.validateEvidence(input, now);
    return this.serializable(async (tx) => {
      await componentLock(tx, actor.companyId, evidence.componentId);
      const { baseline, publisher } = await this.resolveAuthority(tx, actor, evidence.publisher.registrationId, 'ACTIVE');
      const mandate = await this.assertMandate(tx, actor.companyId, evidence, now);
      return this.accept(tx, baseline, publisher, evidence, mandate, now);
    });
  }

  async state(companyId: string, now = new Date()) {
    const baseline = await this.prisma.operationalLinguistBaseline.findUnique({
      where: { companyId_version: { companyId, version: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION } },
    });
    if (!baseline) return { baselineVersion: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION, baselineDigest: OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST, status: 'NOT_ACTIVATED', components: [] };
    const states = await this.prisma.operationalLinguistState.findMany({
      where: { companyId, baselineId: baseline.id },
      orderBy: { componentId: 'asc' },
      include: { currentEvidence: { include: { publisher: true } } },
    });
    return {
      baselineVersion: baseline.version,
      baselineDigest: baseline.digest,
      status: baseline.status,
      authorityEpoch: baseline.authorityEpoch,
      components: states.map((state) => ({
        componentId: state.componentId,
        language: state.language,
        authorityScope: state.authorityScope,
        mandateRef: `AuthorityMandate:${state.mandateId}:v${state.mandateVersion}`,
        operationalState: state.operationalState,
        observedAt: state.observedAt.toISOString(),
        acceptedAt: state.acceptedAt.toISOString(),
        authorityEpoch: state.authorityEpoch,
        sequence: state.sequence,
        revision: state.revision,
        contractVersion: state.contractVersion,
        contractDigest: state.contractDigest,
        catalogDigest: state.catalogDigest,
        current: state.operationalState === 'ONLINE' && state.errorCount === 0 && now.getTime() - state.observedAt.getTime() <= OPERATIONAL_LINGUIST_V1_FRESHNESS_MS,
        evidenceRef: `OperationalLinguistEvidence:${state.currentEvidenceId}`,
        publisher: {
          writerId: state.currentEvidence.publisher.writerId,
          writerVersion: state.currentEvidence.publisher.writerVersion,
          buildRevision: state.currentEvidence.publisher.buildRevision,
          workflowRef: state.currentEvidence.publisher.workflowRef,
          runId: state.currentEvidence.publisher.runId,
          runAttempt: state.currentEvidence.publisher.runAttempt,
          authorityRole: state.currentEvidence.publisher.authorityRole,
        },
      })),
    };
  }

  private validateEvidence(input: unknown, now: Date) {
    const validation = validateOperationalLinguistV1Evidence(input);
    if (!validation.valid || !validation.evidence) {
      throw new UnprocessableEntityException({ code: 'OPERATIONAL_LINGUIST_V1_EVIDENCE_REJECTED', issues: validation.issues });
    }
    const observedAt = new Date(validation.evidence.observedAt);
    const skew = observedAt.getTime() - now.getTime();
    if (skew < -OPERATIONAL_LINGUIST_V1_MAX_PAST_SKEW_MS) throw new UnprocessableEntityException('OPERATIONAL_LINGUIST_V1_EVIDENCE_STALE');
    if (skew > OPERATIONAL_LINGUIST_V1_MAX_FUTURE_SKEW_MS) throw new UnprocessableEntityException('OPERATIONAL_LINGUIST_V1_EVIDENCE_FROM_FUTURE');
    return validation.evidence;
  }

  private async resolveAuthority(tx: Transaction, actor: OperationalLinguistV1Actor, registrationId: string, requiredStatus: 'ACTIVE' | 'ACTIVATABLE') {
    const publisher = await tx.operationalLinguistPublisher.findUnique({ where: { id: registrationId } });
    if (!publisher || publisher.companyId !== actor.companyId || publisher.revokedAt || publisher.expiresAt <= new Date()) {
      throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_PUBLISHER_INACTIVE');
    }
    if (publisher.authorityRole !== actor.roles[0]
      || publisher.buildRevision !== requiredMetadata(actor, 'sha')
      || publisher.workflowRef !== requiredMetadata(actor, 'workflowRef')
      || publisher.runId !== requiredMetadata(actor, 'runId')
      || publisher.runAttempt !== requiredMetadata(actor, 'runAttempt')) {
      throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_PUBLISHER_PROVENANCE_MISMATCH');
    }
    const baseline = await tx.operationalLinguistBaseline.findUnique({ where: { id: publisher.baselineId } });
    const statusAccepted = requiredStatus === 'ACTIVATABLE'
      ? baseline?.status === 'PREPARED' || baseline?.status === 'ACTIVE'
      : baseline?.status === requiredStatus;
    if (!baseline || baseline.companyId !== actor.companyId || !statusAccepted || baseline.authorityEpoch !== publisher.authorityEpoch) {
      throw new ConflictException('OPERATIONAL_LINGUIST_V1_AUTHORITY_EPOCH_STALE');
    }
    return { baseline, publisher };
  }

  private async accept(tx: Transaction, baseline: OperationalLinguistBaseline, publisher: OperationalLinguistPublisher, evidence: OperationalLinguistV1Evidence, mandate: { id: string; version: number; scopeId: string }, now: Date) {
    if (evidence.publisher.registrationId !== publisher.id || evidence.publisher.authorityEpoch !== publisher.authorityEpoch) {
      throw new ConflictException('OPERATIONAL_LINGUIST_V1_PUBLISHER_BINDING_MISMATCH');
    }
    const payloadHash = hash(evidence);
    const current = await tx.operationalLinguistState.findUnique({
      where: { companyId_componentId: { companyId: publisher.companyId, componentId: evidence.componentId } },
    });
    if (!current || current.authorityEpoch < publisher.authorityEpoch) {
      if (evidence.publisher.sequence !== 1) throw new ConflictException('OPERATIONAL_LINGUIST_V1_SEQUENCE_MUST_START_AT_ONE');
    } else if (current.authorityEpoch > publisher.authorityEpoch || evidence.publisher.sequence < current.sequence) {
      throw new ConflictException('OPERATIONAL_LINGUIST_V1_SEQUENCE_STALE');
    } else if (evidence.publisher.sequence === current.sequence) {
      const existing = await tx.operationalLinguistEvidence.findUnique({
        where: { publisherId_componentId_sequence: { publisherId: publisher.id, componentId: evidence.componentId, sequence: evidence.publisher.sequence } },
      });
      if (existing?.payloadHash === payloadHash) return receipt(existing.id, current.revision, evidence, true);
      throw new ConflictException('OPERATIONAL_LINGUIST_V1_SEQUENCE_HASH_CONFLICT');
    }

    const observedAt = new Date(evidence.observedAt);
    const created = await tx.operationalLinguistEvidence.create({
      data: {
        companyId: publisher.companyId,
        baselineId: baseline.id,
        publisherId: publisher.id,
        componentId: evidence.componentId,
        language: evidence.language,
        authorityScope: mandate.scopeId,
        mandateId: mandate.id,
        mandateVersion: mandate.version,
        schemaVersion: evidence.schemaVersion,
        baselineVersion: evidence.baselineVersion,
        baselineDigest: evidence.baselineDigest,
        operationalState: evidence.operationalState,
        observedAt,
        acceptedAt: now,
        authorityEpoch: evidence.publisher.authorityEpoch,
        sequence: evidence.publisher.sequence,
        contractVersion: evidence.resources.contractVersion,
        contractDigest: evidence.resources.contractDigest,
        catalogDigest: evidence.resources.catalogDigest,
        appCount: evidence.resources.app,
        operationalCount: evidence.resources.operational,
        carMoverCount: evidence.resources.carMover,
        premiumCount: evidence.resources.premium,
        totalCount: evidence.resources.total,
        errorCount: evidence.errors.count,
        errorCodes: evidence.errors.codes,
        payloadHash,
      },
    });
    const definition = createCanonicalOperationalLinguist(evidence.language as 'it' | 'es' | 'sv');
    if (definition.componentId !== evidence.componentId) throw new ConflictException('OPERATIONAL_LINGUIST_V1_IDENTITY_CHANGED_DURING_ACCEPTANCE');
    const state = await tx.operationalLinguistState.upsert({
      where: { companyId_componentId: { companyId: publisher.companyId, componentId: evidence.componentId } },
      create: {
        companyId: publisher.companyId, baselineId: baseline.id, componentId: evidence.componentId, language: evidence.language,
        authorityScope: mandate.scopeId, mandateId: mandate.id, mandateVersion: mandate.version,
        currentEvidenceId: created.id, operationalState: evidence.operationalState, observedAt, acceptedAt: now,
        authorityEpoch: evidence.publisher.authorityEpoch, sequence: evidence.publisher.sequence,
        contractVersion: evidence.resources.contractVersion, contractDigest: evidence.resources.contractDigest, catalogDigest: evidence.resources.catalogDigest,
        appCount: evidence.resources.app, operationalCount: evidence.resources.operational, carMoverCount: evidence.resources.carMover,
        premiumCount: evidence.resources.premium, totalCount: evidence.resources.total, errorCount: evidence.errors.count,
      },
      update: {
        baselineId: baseline.id, language: evidence.language, authorityScope: mandate.scopeId, mandateId: mandate.id, mandateVersion: mandate.version,
        currentEvidenceId: created.id, operationalState: evidence.operationalState,
        observedAt, acceptedAt: now, authorityEpoch: evidence.publisher.authorityEpoch, sequence: evidence.publisher.sequence,
        revision: { increment: 1 }, contractVersion: evidence.resources.contractVersion, contractDigest: evidence.resources.contractDigest, catalogDigest: evidence.resources.catalogDigest,
        appCount: evidence.resources.app, operationalCount: evidence.resources.operational, carMoverCount: evidence.resources.carMover,
        premiumCount: evidence.resources.premium, totalCount: evidence.resources.total, errorCount: evidence.errors.count,
      },
    });
    await tx.operationalLinguistReceipt.create({
      data: { companyId: publisher.companyId, baselineId: baseline.id, evidenceId: created.id, componentId: evidence.componentId, outcome: 'ACCEPTED', reasonCode: 'CANONICAL_EVIDENCE_PERSISTED', payloadHash, acceptedAt: now },
    });
    return receipt(created.id, state.revision, evidence, false);
  }

  private requirePublisherRole(actor: OperationalLinguistV1Actor) {
    if (actor.roles.length !== 1 || !['DEPLOYMENT_PROVISIONER', 'AGENT_RUNTIME_CONTINUITY'].includes(actor.roles[0])) throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_PUBLISHER_AUTHORITY_REQUIRED');
  }

  private async serializable<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!isSerializableConflict(error) || attempt === 3) throw error;
      }
    }
    throw new ConflictException('OPERATIONAL_LINGUIST_V1_TRANSACTION_RETRY_EXHAUSTED');
  }

  private async assertMandate(tx: Transaction, companyId: string, evidence: OperationalLinguistV1Evidence, now: Date) {
    const definition = createCanonicalOperationalLinguist(evidence.language as 'it' | 'es' | 'sv');
    const mandate = await tx.authorityMandate.findFirst({
      where: {
        companyId,
        agentId: definition.componentId,
        scopeId: definition.authorityScope,
        status: 'APPROVED',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, scopeId: true },
    });
    if (!mandate) throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_ACTIVE_MANDATE_REQUIRED');
    return mandate;
  }

  private requireDeploymentRole(actor: OperationalLinguistV1Actor) {
    if (actor.roles.length !== 1 || actor.roles[0] !== 'DEPLOYMENT_PROVISIONER') throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_ACTIVATION_AUTHORITY_REQUIRED');
  }
}

function publicPublisher(publisher: OperationalLinguistPublisher, baselineStatus: string) {
  return { registrationId: publisher.id, authorityEpoch: publisher.authorityEpoch, writerId: publisher.writerId, writerVersion: publisher.writerVersion, buildRevision: publisher.buildRevision, expiresAt: publisher.expiresAt.toISOString(), baselineStatus };
}

function receipt(evidenceId: string, revision: number, evidence: OperationalLinguistV1Evidence, idempotent: boolean) {
  return { outcome: 'ACCEPTED', reasonCode: idempotent ? 'IDEMPOTENT_REPLAY' : 'CANONICAL_EVIDENCE_PERSISTED', componentId: evidence.componentId, language: evidence.language, evidenceRef: `OperationalLinguistEvidence:${evidenceId}`, authorityEpoch: evidence.publisher.authorityEpoch, sequence: evidence.publisher.sequence, revision, idempotent };
}

function requiredMetadata(actor: OperationalLinguistV1Actor, key: string) {
  const value = actor.actorMetadata[key];
  if (!value) throw new ForbiddenException('OPERATIONAL_LINGUIST_V1_OIDC_METADATA_INCOMPLETE');
  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hash(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function isSerializableConflict(error: unknown): error is { code: 'P2034' } {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034');
}

async function lock(tx: Transaction, companyId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT 1 AS "acquired" WHERE pg_advisory_xact_lock(hashtext(${'agm-operational-linguist-v1:' + companyId})) IS NULL`);
}

async function componentLock(tx: Transaction, companyId: string, componentId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT 1 AS "acquired" WHERE pg_advisory_xact_lock(hashtext(${'agm-operational-linguist-v1:' + companyId + ':' + componentId})) IS NULL`);
}
