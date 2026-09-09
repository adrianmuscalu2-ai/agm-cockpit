import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../machine-auth/github-actions-oidc.contract';
import { MACHINE_AUTH_CONTRACT, type MachineRequestContext } from '../machine-auth/machine-auth.contract';
import { PrismaService } from '../prisma/prisma.service';
import { TURN_OPERATIONAL_TRUTH_CONTRACT, type TurnOperationalTruthStatus } from './turn-operational-truth.contract';

type AuthenticatedReadInput = {
  machine: MachineRequestContext;
  route: string;
  responseBody: unknown;
  registryNodeCount: number;
};

type ReadMetadata = {
  requestId: string;
  correlationId: string;
  runtimeEventId: string;
  machineIdentityId: string;
  credentialId: string;
  subject: string;
  scopes: string[];
  route: string;
  responseDigest: string;
  registryNodeCount: number;
  authContract: string;
};

@Injectable()
export class TurnOperationalTruthService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAuthenticatedAcpRead(input: AuthenticatedReadInput) {
    const observedAt = new Date();
    const runtimeEventId = randomUUID();
    const evidenceRef = `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${input.machine.requestId}`;
    const responseDigest = digest(input.responseBody);
    const metadata: ReadMetadata = {
      requestId: input.machine.requestId,
      correlationId: input.machine.correlationId,
      runtimeEventId,
      machineIdentityId: input.machine.machineIdentityId,
      credentialId: input.machine.credentialId,
      subject: input.machine.subject,
      scopes: [...input.machine.scopes],
      route: input.route,
      responseDigest,
      registryNodeCount: input.registryNodeCount,
      authContract: MACHINE_AUTH_CONTRACT.version,
    };
    const heartbeatDetail = JSON.stringify({
      contract: TURN_OPERATIONAL_TRUTH_CONTRACT.version,
      source: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType,
      requestId: input.machine.requestId,
      runtimeEventId,
      responseDigest,
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.authorityAuditJournal.create({ data: {
        companyId: input.machine.companyId,
        eventId: randomUUID(),
        eventType: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType,
        scopeId: 'authority-control-plane.read',
        actorType: 'MACHINE',
        actorId: input.machine.subject,
        outcome: 'PASS',
        payloadHash: digest(metadata),
        safeMetadata: metadata as unknown as Prisma.InputJsonValue,
        correlationId: input.machine.correlationId,
        occurredAt: observedAt,
      } });
      await tx.agentRuntimeEvent.create({ data: {
        companyId: input.machine.companyId,
        eventId: runtimeEventId,
        mandateId: `m2m-acp-read:${input.machine.correlationId}`,
        agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        dossierId: input.machine.requestId,
        lifecycle: 'COMPLETED',
        sequence: 1,
        occurredAt: observedAt,
        evidenceRef,
        evidenceHash: responseDigest,
        detail: `Authenticated M2M ACP read persisted; ${input.registryNodeCount} registry nodes observed.`,
      } });
      await tx.componentHeartbeat.upsert({
        where: { companyId_componentId: { companyId: input.machine.companyId, componentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId } },
        create: {
          companyId: input.machine.companyId,
          componentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
          reportedStatus: 'ONLINE',
          lastSeenAt: observedAt,
          lastSuccessAt: observedAt,
          lastDetail: heartbeatDetail,
        },
        update: {
          reportedStatus: 'ONLINE',
          lastSeenAt: observedAt,
          lastSuccessAt: observedAt,
          lastFailureAt: null,
          lastFailureReason: null,
          lastDetail: heartbeatDetail,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { observedAt: observedAt.toISOString(), runtimeEventId, evidenceRef, responseDigest };
  }

  async snapshot(now = new Date()) {
    const companyId = GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId;
    const [accessAudit, heartbeat, mandate] = await Promise.all([
      this.prisma.authorityAuditJournal.findFirst({ where: { companyId, eventType: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType, outcome: 'PASS', actorType: 'MACHINE' }, orderBy: { occurredAt: 'desc' } }),
      this.prisma.componentHeartbeat.findUnique({ where: {
        companyId_componentId: { companyId, componentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId },
      } }),
      this.prisma.authorityMandate.findFirst({ where: {
        companyId,
        agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        status: 'APPROVED',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      }, orderBy: { issuedAt: 'desc' } }),
    ]);
    if (!accessAudit && !heartbeat && !mandate) return emptySnapshot(now);
    const metadata = readMetadata(accessAudit?.safeMetadata);
    const [accessRuntimeEvent, runtimeEvent] = await Promise.all([
      metadata ? this.prisma.agentRuntimeEvent.findFirst({ where: {
        companyId,
        eventId: metadata.runtimeEventId,
        agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        evidenceRef: `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${metadata.requestId}`,
        evidenceHash: metadata.responseDigest,
      } }) : Promise.resolve(null),
      mandate ? this.prisma.agentRuntimeEvent.findFirst({ where: {
        companyId,
        mandateId: mandate.id,
        agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
      }, orderBy: { occurredAt: 'desc' } }) : Promise.resolve(null),
    ]);
    const validationEvents = runtimeEvent ? await this.prisma.authorityAuditJournal.findMany({ where: {
      companyId,
      eventType: 'AGENT_ACCOUNTABILITY_VALIDATED',
      outcome: 'PASS',
    }, orderBy: { occurredAt: 'desc' }, take: 100 }) : [];
    const validation = runtimeEvent && mandate ? validationEvents.find((event) => {
      const value = jsonRecord(event.safeMetadata);
      return event.actorId !== runtimeEvent.agentId
        && value.agentId === runtimeEvent.agentId
        && value.targetMandateId === mandate.id
        && value.executionEventId === runtimeEvent.eventId
        && value.executionEvidenceRef === runtimeEvent.evidenceRef
        && value.executionOutputRef === runtimeEvent.outputRef
        && value.validatorId === event.actorId
        && value.validatorMandateId === event.mandateId
        && value.result === 'PASS';
    }) : undefined;
    const validatorMandate = validation?.mandateId ? await this.prisma.authorityMandate.findFirst({ where: {
      id: validation.mandateId,
      companyId,
      agentId: validation.actorId,
      status: 'APPROVED',
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    } }) : null;

    const heartbeatEvidence = heartbeatDetail(heartbeat?.lastDetail);
    const accessCorrelated = Boolean(
      accessAudit
      && metadata
      && accessRuntimeEvent
      && heartbeatEvidence
      && heartbeatEvidence.requestId === metadata.requestId
      && heartbeatEvidence.runtimeEventId === metadata.runtimeEventId
      && heartbeatEvidence.responseDigest === metadata.responseDigest,
    );
    const accessAgeMs = accessAudit ? Math.max(0, now.getTime() - accessAudit.occurredAt.getTime()) : null;
    const accessFresh = accessAgeMs !== null && accessAgeMs <= TURN_OPERATIONAL_TRUTH_CONTRACT.accessProofFreshnessWindowMs;
    const executionComplete = Boolean(runtimeEvent && runtimeEvent.lifecycle === 'COMPLETED' && runtimeEvent.evidenceRef && runtimeEvent.outputRef && runtimeEvent.evidenceHash);
    const heartbeatAgeMs = heartbeat ? Math.max(0, now.getTime() - heartbeat.lastSeenAt.getTime()) : Number.POSITIVE_INFINITY;
    const executionAgeMs = runtimeEvent ? Math.max(0, now.getTime() - runtimeEvent.occurredAt.getTime()) : Number.POSITIVE_INFINITY;
    const validationAgeMs = validation ? Math.max(0, now.getTime() - validation.occurredAt.getTime()) : Number.POSITIVE_INFINITY;
    const ageMs = Math.max(heartbeatAgeMs, executionAgeMs, validationAgeMs);
    const fresh = ageMs <= TURN_OPERATIONAL_TRUTH_CONTRACT.freshnessWindowMs;
    const heartbeatHealthy = Boolean(heartbeat && heartbeat.reportedStatus === 'ONLINE');
    const runtimeComplete = Boolean(mandate && executionComplete && validation && validatorMandate && heartbeatHealthy);
    const complete = runtimeComplete && fresh && accessCorrelated;
    const evidencePresent = Boolean(mandate || runtimeEvent || validation || heartbeat);
    const overallStatus: TurnOperationalTruthStatus = complete ? 'PASS' : evidencePresent ? 'DEGRADED' : 'NO_TELEMETRY';
    const reason = !accessCorrelated
      ? 'M2M_ACCESS_PROOF_CORRELATION_MISSING'
      : !mandate
        ? 'ACP_ACTIVE_MANDATE_MISSING'
        : !runtimeEvent
          ? 'ACP_PERIODIC_DUTY_MISSING'
          : runtimeEvent.lifecycle !== 'COMPLETED'
            ? `ACP_PERIODIC_DUTY_${runtimeEvent.lifecycle}`
            : !executionComplete
              ? 'ACP_PERIODIC_DUTY_EVIDENCE_INCOMPLETE'
              : !validation
                ? 'ACP_PERIODIC_VALIDATION_CORRELATION_MISSING'
                : !validatorMandate
                  ? 'ACP_VALIDATOR_MANDATE_MISSING'
                  : !heartbeatHealthy
                    ? `ACP_HEARTBEAT_${heartbeat?.reportedStatus ?? 'MISSING'}`
                    : !fresh
                      ? 'ACP_PERIODIC_DUTY_STALE'
                      : 'ACP_PERIODIC_DUTY_CURRENT';

    return {
      contractVersion: TURN_OPERATIONAL_TRUTH_CONTRACT.version,
      generatedAt: now.toISOString(),
      overallStatus,
      reason,
      falseGreen: 0,
      unexplainedDegraded: 0,
      observedAt: runtimeEvent?.occurredAt.toISOString() ?? null,
      ageSeconds: Number.isFinite(ageMs) ? Math.floor(ageMs / 1_000) : null,
      freshness: fresh ? 'LIVE' : 'STALE',
      authStatus: accessCorrelated ? 'M2M AUTHENTICATED' : 'AUTH REQUIRED',
      telemetryStatus: runtimeComplete ? (fresh ? 'LIVE TELEMETRY' : 'STALE TELEMETRY') : 'NO TELEMETRY',
      authorityControlPlane: {
        canonicalId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        status: overallStatus,
        statusSource: 'ACTIVE_MANDATE_AGENT_RUNTIME_EVENT_INDEPENDENT_VALIDATION_COMPONENT_HEARTBEAT',
        observedAt: runtimeEvent?.occurredAt.toISOString() ?? null,
      },
      accessProof: {
        status: !accessCorrelated ? 'MISSING' : accessFresh ? 'CURRENT' : 'STALE',
        observedAt: accessAudit?.occurredAt.toISOString() ?? null,
        ageSeconds: accessAgeMs === null ? null : Math.floor(accessAgeMs / 1_000),
        freshnessWindowSeconds: Math.round(TURN_OPERATIONAL_TRUTH_CONTRACT.accessProofFreshnessWindowMs / 1_000),
        role: 'HISTORICAL_RELEASE_ACCESS_PROOF_NOT_RUNTIME_FRESHNESS',
      },
      chain: {
        machineIdentity: { status: accessCorrelated ? 'VERIFIED' : 'MISSING', ref: metadata ? publicRef(metadata.machineIdentityId) : null, source: 'VALIDATED_MACHINE_JWT_CONTEXT' },
        credential: { status: accessCorrelated ? 'VERIFIED' : 'MISSING', ref: metadata ? publicRef(metadata.credentialId) : null, source: 'ACTIVE_CREDENTIAL_AT_AUTHENTICATION' },
        token: { status: accessCorrelated ? 'VERIFIED' : 'MISSING', scope: metadata?.scopes.join(' ') ?? null, contract: metadata?.authContract ?? MACHINE_AUTH_CONTRACT.version, source: 'MACHINE_JWT_GUARD' },
        authenticatedAcpRead: { status: accessCorrelated ? 'PASS' : 'MISSING', route: metadata ? publicRoute(metadata.route, companyId) : null, requestId: metadata?.requestId ?? null, responseDigest: metadata?.responseDigest ?? null, registryNodeCount: metadata?.registryNodeCount ?? null, source: 'HISTORICAL_RELEASE_ACCESS_PROOF' },
        telemetry: { status: heartbeatHealthy && fresh ? 'PASS' : heartbeat ? 'STALE' : 'MISSING', source: 'CURRENT_COMPONENT_HEARTBEAT', observedAt: heartbeat?.lastSeenAt.toISOString() ?? null },
        eventStore: { status: executionComplete && validation ? 'PERSISTED' : 'MISSING', eventId: runtimeEvent?.eventId ?? null, recordedAt: runtimeEvent?.recordedAt.toISOString() ?? null, source: validation ? `VALIDATED_BY:${validation.actorId}` : 'NO_CORRELATED_VALIDATION' },
        api: { status: 'PASS', source: 'TURN_OPERATIONAL_TRUTH_PROJECTION', responseDigest: metadata?.responseDigest ?? null },
        turn: { status: complete ? 'EVIDENCE AVAILABLE' : 'NO TELEMETRY', source: 'LIVE API ONLY_NO_REGISTRY_FALLBACK', eventId: runtimeEvent?.eventId ?? null },
        ui: { status: complete ? 'READY FOR LIVE RENDER' : 'NO TELEMETRY', source: 'NO_FALLBACK' },
      },
      latestEvent: runtimeEvent ? {
        eventId: runtimeEvent.eventId,
        mandateId: runtimeEvent.mandateId,
        agentId: runtimeEvent.agentId,
        dossierId: runtimeEvent.dossierId,
        lifecycle: runtimeEvent.lifecycle,
        sequence: runtimeEvent.sequence,
        occurredAt: runtimeEvent.occurredAt.toISOString(),
        recordedAt: runtimeEvent.recordedAt.toISOString(),
        evidenceRef: runtimeEvent.evidenceRef,
        evidenceHash: runtimeEvent.evidenceHash,
        detail: runtimeEvent.detail,
      } : null,
    };
  }
}

function emptySnapshot(now: Date) {
  return {
    contractVersion: TURN_OPERATIONAL_TRUTH_CONTRACT.version,
    generatedAt: now.toISOString(),
    overallStatus: 'NO_TELEMETRY' as const,
    reason: 'M2M_ACCESS_PROOF_CORRELATION_MISSING',
    falseGreen: 0,
    unexplainedDegraded: 0,
    observedAt: null,
    ageSeconds: null,
    freshness: 'UNKNOWN',
    authStatus: 'AUTH REQUIRED',
    telemetryStatus: 'NO TELEMETRY',
    authorityControlPlane: { canonicalId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId, status: 'NO_TELEMETRY' as const, statusSource: 'NONE', observedAt: null },
    accessProof: { status: 'MISSING', observedAt: null, ageSeconds: null, freshnessWindowSeconds: Math.round(TURN_OPERATIONAL_TRUTH_CONTRACT.accessProofFreshnessWindowMs / 1_000), role: 'HISTORICAL_RELEASE_ACCESS_PROOF_NOT_RUNTIME_FRESHNESS' },
    chain: {
      machineIdentity: { status: 'MISSING', ref: null, source: 'NO_FALLBACK' },
      credential: { status: 'MISSING', ref: null, source: 'NO_FALLBACK' },
      token: { status: 'MISSING', scope: null, contract: MACHINE_AUTH_CONTRACT.version, source: 'NO_FALLBACK' },
      authenticatedAcpRead: { status: 'MISSING', route: null, requestId: null, responseDigest: null, registryNodeCount: null },
      telemetry: { status: 'MISSING', source: 'NO_FALLBACK', observedAt: null },
      eventStore: { status: 'MISSING', eventId: null, recordedAt: null },
      api: { status: 'PASS', source: 'TURN_OPERATIONAL_TRUTH_PROJECTION', responseDigest: null },
      turn: { status: 'NO TELEMETRY', source: 'LIVE API ONLY', eventId: null },
      ui: { status: 'NO TELEMETRY', source: 'NO FALLBACK' },
    },
    latestEvent: null,
  };
}

function jsonRecord(value: Prisma.JsonValue | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Prisma.JsonObject : {};
}

function readMetadata(value: Prisma.JsonValue | undefined): ReadMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Prisma.JsonObject;
  const scopes = Array.isArray(item.scopes) ? item.scopes.filter((scope): scope is string => typeof scope === 'string') : [];
  const required = ['requestId', 'correlationId', 'runtimeEventId', 'machineIdentityId', 'credentialId', 'subject', 'route', 'responseDigest', 'authContract'] as const;
  if (required.some((key) => typeof item[key] !== 'string') || typeof item.registryNodeCount !== 'number') return null;
  return { ...item, scopes } as unknown as ReadMetadata;
}

function heartbeatDetail(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.requestId !== 'string' || typeof parsed.runtimeEventId !== 'string' || typeof parsed.responseDigest !== 'string') return null;
    return parsed as { requestId: string; runtimeEventId: string; responseDigest: string };
  } catch {
    return null;
  }
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function publicRef(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function publicRoute(route: string, companyId: string) {
  return route.replace(companyId, `{${publicRef(companyId)}}`);
}
