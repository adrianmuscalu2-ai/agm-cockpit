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
    const audit = await this.prisma.authorityAuditJournal.findFirst({
      where: {
        companyId,
        eventType: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType,
        outcome: 'PASS',
        actorType: 'MACHINE',
      },
      orderBy: { occurredAt: 'desc' },
    });
    const metadata = readMetadata(audit?.safeMetadata);
    if (!audit || !metadata) return emptySnapshot(now);

    const [runtimeEvent, heartbeat] = await Promise.all([
      this.prisma.agentRuntimeEvent.findFirst({ where: {
        companyId,
        eventId: metadata.runtimeEventId,
        agentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        evidenceRef: `${TURN_OPERATIONAL_TRUTH_CONTRACT.evidencePrefix}${metadata.requestId}`,
        evidenceHash: metadata.responseDigest,
      } }),
      this.prisma.componentHeartbeat.findUnique({ where: {
        companyId_componentId: { companyId, componentId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId },
      } }),
    ]);
    const heartbeatEvidence = heartbeatDetail(heartbeat?.lastDetail);
    const eventStoreCorrelated = Boolean(runtimeEvent);
    const telemetryCorrelated = Boolean(
      heartbeat
      && heartbeatEvidence
      && heartbeatEvidence.requestId === metadata.requestId
      && heartbeatEvidence.runtimeEventId === metadata.runtimeEventId
      && heartbeatEvidence.responseDigest === metadata.responseDigest,
    );
    const ageMs = Math.max(0, now.getTime() - audit.occurredAt.getTime());
    const fresh = ageMs <= TURN_OPERATIONAL_TRUTH_CONTRACT.freshnessWindowMs;
    const complete = eventStoreCorrelated && telemetryCorrelated;
    const overallStatus: TurnOperationalTruthStatus = !complete ? 'NO_TELEMETRY' : fresh ? 'PASS' : 'DEGRADED';
    const reason = !eventStoreCorrelated
      ? 'EVENTSTORE_CORRELATION_MISSING'
      : !telemetryCorrelated
        ? 'ACP_TELEMETRY_CORRELATION_MISSING'
        : fresh
          ? 'AUTHENTICATED_M2M_ACP_READ_LIVE'
          : 'AUTHENTICATED_M2M_ACP_READ_STALE';

    return {
      contractVersion: TURN_OPERATIONAL_TRUTH_CONTRACT.version,
      generatedAt: now.toISOString(),
      overallStatus,
      reason,
      falseGreen: 0,
      unexplainedDegraded: 0,
      observedAt: audit.occurredAt.toISOString(),
      ageSeconds: Math.floor(ageMs / 1_000),
      freshness: fresh ? 'LIVE' : 'STALE',
      authStatus: 'M2M AUTHENTICATED',
      telemetryStatus: complete ? (fresh ? 'LIVE TELEMETRY' : 'STALE TELEMETRY') : 'NO TELEMETRY',
      authorityControlPlane: {
        canonicalId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId,
        status: overallStatus,
        statusSource: TURN_OPERATIONAL_TRUTH_CONTRACT.authenticatedReadEventType,
        observedAt: audit.occurredAt.toISOString(),
      },
      chain: {
        machineIdentity: { status: 'VERIFIED', ref: publicRef(metadata.machineIdentityId), source: 'VALIDATED_MACHINE_JWT_CONTEXT' },
        credential: { status: 'VERIFIED', ref: publicRef(metadata.credentialId), source: 'ACTIVE_CREDENTIAL_AT_AUTHENTICATION' },
        token: { status: 'VERIFIED', scope: metadata.scopes.join(' '), contract: metadata.authContract, source: 'MACHINE_JWT_GUARD' },
        authenticatedAcpRead: { status: 'PASS', route: publicRoute(metadata.route, companyId), requestId: metadata.requestId, responseDigest: metadata.responseDigest, registryNodeCount: metadata.registryNodeCount },
        telemetry: { status: telemetryCorrelated ? 'PASS' : 'MISSING', source: 'CORRELATED_COMPONENT_HEARTBEAT', observedAt: heartbeat?.lastSeenAt.toISOString() ?? null },
        eventStore: { status: eventStoreCorrelated ? 'PERSISTED' : 'MISSING', eventId: runtimeEvent?.eventId ?? null, recordedAt: runtimeEvent?.recordedAt.toISOString() ?? null },
        api: { status: 'PASS', source: 'TURN_OPERATIONAL_TRUTH_PROJECTION', responseDigest: metadata.responseDigest },
        turn: { status: complete ? 'EVIDENCE AVAILABLE' : 'NO TELEMETRY', source: 'LIVE API ONLY', eventId: runtimeEvent?.eventId ?? null },
        ui: { status: complete ? 'READY FOR LIVE RENDER' : 'NO TELEMETRY', source: 'NO FALLBACK' },
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
    reason: 'NO_AUTHENTICATED_M2M_ACP_READ',
    falseGreen: 0,
    unexplainedDegraded: 0,
    observedAt: null,
    ageSeconds: null,
    freshness: 'UNKNOWN',
    authStatus: 'AUTH REQUIRED',
    telemetryStatus: 'NO TELEMETRY',
    authorityControlPlane: { canonicalId: TURN_OPERATIONAL_TRUTH_CONTRACT.authorityControlPlaneId, status: 'NO_TELEMETRY' as const, statusSource: 'NONE', observedAt: null },
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
