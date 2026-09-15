import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_GUARDIAN_CONTRACT, type GuardianDecision } from './permission-guardian.contract';
import type { PermissionGuardianRequestDto } from './permission-guardian.dto';

@Injectable()
export class PermissionGuardianService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(ctx: RequestContext, request: PermissionGuardianRequestDto) {
    const observedAt = new Date();
    const allowedScopes = (PERMISSION_GUARDIAN_CONTRACT.allowed as Record<string, readonly string[]>)[request.requestedCapability];
    const allowlisted = Boolean(allowedScopes?.includes(request.requestedPermissionOrScope));
    const evidencePresent = request.evidence.trim().length >= 8;
    const authorityAcceptable = request.currentAuthority === 'AUTHORIZED' || request.currentAuthority === 'NOT_REQUIRED';
    const authorityRequired = request.phase !== 'REQUEST';
    const decision: GuardianDecision = !allowlisted ? 'DENIED' : !evidencePresent || (authorityRequired && !authorityAcceptable) ? 'NOT_PROVEN' : 'APPROVED';
    const reasonCode = !allowedScopes ? 'CAPABILITY_NOT_ALLOWLISTED'
      : !allowlisted ? 'PERMISSION_OR_SCOPE_NOT_ALLOWLISTED'
        : !evidencePresent ? 'EVIDENCE_MISSING'
          : authorityRequired && !authorityAcceptable ? `AUTHORITY_${request.currentAuthority}`
            : 'ALLOWLIST_AND_AUTHORITY_VERIFIED';
    const evidenceId = randomUUID();
    const metadata = {
      contractVersion: PERMISSION_GUARDIAN_CONTRACT.version,
      requestDetected: true,
      phase: request.phase,
      requestedCapability: request.requestedCapability,
      requestedPermissionOrScope: request.requestedPermissionOrScope,
      requestor: request.requestor,
      reason: request.reason,
      risk: request.risk,
      currentAuthority: request.currentAuthority,
      decision,
      evidence: request.evidence,
      timestamp: observedAt.toISOString(),
      authorityGranted: decision === 'APPROVED',
    };
    await this.prisma.$transaction(async (tx) => {
      await tx.authorityAuditJournal.create({ data: {
        companyId: ctx.companyId, eventId: evidenceId, eventType: PERMISSION_GUARDIAN_CONTRACT.eventType,
        scopeId: 'android.action.permission', actorType: 'GUARDIAN', actorId: PERMISSION_GUARDIAN_CONTRACT.actorId,
        outcome: decision, reasonCode, payloadHash: digest(metadata), safeMetadata: metadata as unknown as Prisma.InputJsonValue,
        correlationId: ctx.correlationId, occurredAt: observedAt,
      } });
      if (decision === 'DENIED') {
        const findingId = randomUUID();
        await tx.authorityAuditJournal.create({ data: {
          companyId: ctx.companyId, eventId: findingId, eventType: PERMISSION_GUARDIAN_CONTRACT.findingEventType,
          scopeId: 'android.action.permission', actorType: 'GUARDIAN', actorId: PERMISSION_GUARDIAN_CONTRACT.actorId,
          outcome: 'OPEN', reasonCode, payloadHash: digest({ evidenceId, reasonCode }),
          safeMetadata: { contractVersion: PERMISSION_GUARDIAN_CONTRACT.version, evaluationEventId: evidenceId, severity: request.risk, authorityGranted: false } as Prisma.InputJsonValue,
          correlationId: ctx.correlationId, occurredAt: observedAt,
        } });
      }
    });
    return { ...metadata, evidenceId, reasonCode, correlationId: ctx.correlationId };
  }

  async status(ctx: RequestContext) {
    const evaluations = await this.prisma.authorityAuditJournal.findMany({
      where: { companyId: ctx.companyId, eventType: PERMISSION_GUARDIAN_CONTRACT.eventType }, orderBy: { occurredAt: 'desc' }, take: 50,
    });
    if (!evaluations.length) return { contractVersion: PERMISSION_GUARDIAN_CONTRACT.version, guardian: 'NOT_PROVEN', reason: 'NO_EVALUATION_TELEMETRY', evaluations: [] };
    const rows = evaluations.map((event) => ({ evidenceId: event.eventId, decision: event.outcome, reasonCode: event.reasonCode, timestamp: event.occurredAt.toISOString(), evidence: event.safeMetadata }));
    return {
      contractVersion: PERMISSION_GUARDIAN_CONTRACT.version,
      guardian: rows.some((row) => row.decision === 'DENIED') ? 'CONTROL_FINDING' : rows.some((row) => row.decision === 'APPROVED') ? 'PROVEN' : 'NOT_PROVEN',
      reason: rows[0]!.reasonCode,
      evaluations: rows,
    };
  }
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
