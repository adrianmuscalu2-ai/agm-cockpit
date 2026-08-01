import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';

interface TransitionRecordDefinition {
  businessAction: string;
  reason?: string;
}

interface RecordTransitionAuditInput {
  audit: AuditService;
  tx: Prisma.TransactionClient;
  ctx: RequestContext;
  definition: TransitionRecordDefinition;
  transportId: string;
  beforeSnapshot: Record<string, unknown>;
  validationReportId: string;
  hasFailedMandatoryCheck: boolean;
}

interface RecordTransitionHistoryInput {
  tx: Prisma.TransactionClient;
  ctx: RequestContext;
  definition: TransitionRecordDefinition;
  transportId: string;
  fromLifecycleStateId: string;
  toLifecycleStateId: string;
  validationReportId: string;
  auditEventId: string;
}

export function recordTransportTransitionAudit({
  audit,
  tx,
  ctx,
  definition,
  transportId,
  beforeSnapshot,
  validationReportId,
  hasFailedMandatoryCheck,
}: RecordTransitionAuditInput) {
  return audit.create(
    {
      actionCode: definition.businessAction,
      entityType: 'TransportJob',
      entityId: transportId,
      transportJobId: transportId,
      reason:
        definition.reason ??
        (hasFailedMandatoryCheck
          ? `${definition.businessAction} validation failed.`
          : `${definition.businessAction} completed by authorized user.`),
      beforeSnapshot,
      validationReportId,
    },
    ctx,
    tx,
  );
}

export function recordTransportTransitionHistory({
  tx,
  ctx,
  definition,
  transportId,
  fromLifecycleStateId,
  toLifecycleStateId,
  validationReportId,
  auditEventId,
}: RecordTransitionHistoryInput) {
  return tx.transportJobStateHistory.create({
    data: {
      companyId: ctx.companyId,
      transportJobId: transportId,
      fromLifecycleStateId,
      toLifecycleStateId,
      businessAction: definition.businessAction,
      transitionReason: definition.reason,
      transitionedByUserId: ctx.userId,
      validationReportId,
      relatedAuditEventId: auditEventId,
    },
  });
}
