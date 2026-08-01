import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import {
  ExecutedCheck,
  ValidationReportsService,
} from '../validation-reports/validation-reports.service';
import { getTransportForTransition } from './transport-read.repository';
import { buildTransportTransitionChecks } from './transport-transition-checks';
import { TransportTransitionPolicy } from './transport-transition.policy';
import {
  recordTransportTransitionAudit,
  recordTransportTransitionHistory,
} from './transport-transition-records';
import { updateTransportAfterTransition } from './transport-write.repository';

export interface TransitionDefinition extends TransportTransitionPolicy {
  reason?: string;
  afterTransition?: (input: {
    tx: Prisma.TransactionClient;
    transportId: string;
    ctx: RequestContext;
    validationReportId: string;
    auditEventId: string;
  }) => Promise<Record<string, unknown> | void>;
  extraChecks?: (input: {
    tx: Prisma.TransactionClient;
    transportId: string;
    ctx: RequestContext;
  }) => Promise<ExecutedCheck[]>;
  updateTransport?: Pick<
    Prisma.TransportJobUncheckedUpdateInput,
    'isArchived'
  >;
}

export async function executeTransportTransition(input: {
  lifecycle: LifecycleService;
  audit: AuditService;
  validationReports: ValidationReportsService;
  tx: Prisma.TransactionClient;
  id: string;
  ctx: RequestContext;
  definition: TransitionDefinition;
}) {
  const {
    lifecycle,
    audit,
    validationReports,
    tx,
    id,
    ctx,
    definition,
  } = input;
  const transport = await getTransportForTransition(tx, id, ctx);

  if (!transport) {
    throw new NotFoundException('Transport not found.');
  }

  const startedAt = Date.now();
  const checks = buildTransportTransitionChecks(transport, definition);

  if (definition.extraChecks) {
    checks.push(
      ...(await definition.extraChecks({
        tx,
        transportId: transport.id,
        ctx,
      })),
    );
  }

  const hasFailedMandatoryCheck = checks.some(
    (check) =>
      check.severity === 'mandatory' &&
      !['passed', 'not_applicable'].includes(check.status),
  );

  const validationReport = await validationReports.create(
    {
      validationType: definition.validationType,
      relatedBusinessAction: definition.businessAction,
      relatedEntityType: 'TransportJob',
      relatedEntityId: transport.id,
      transportJobId: transport.id,
      overallResult: hasFailedMandatoryCheck ? 'failed' : 'passed',
      executedChecks: checks,
      executionDurationMs: Date.now() - startedAt,
    },
    ctx,
    tx,
  );

  const auditEvent = await recordTransportTransitionAudit({
    audit,
    tx,
    ctx,
    definition,
    transportId: transport.id,
    beforeSnapshot: {
      id: transport.id,
      transportNumber: transport.transportNumber,
      currentLifecycleStateId: transport.currentLifecycleStateId,
      currentLifecycleState: transport.currentLifecycleState,
    },
    validationReportId: validationReport.validationReportId,
    hasFailedMandatoryCheck,
  });

  if (hasFailedMandatoryCheck) {
    return {
      ok: false as const,
      validationReport,
      auditEventId: auditEvent.id,
    };
  }

  const targetState = await lifecycle.getStateByCode(
    ctx.companyId,
    definition.toStateCode,
    tx,
  );
  const stateHistory = await recordTransportTransitionHistory({
    tx,
    ctx,
    definition,
    transportId: transport.id,
    fromLifecycleStateId: transport.currentLifecycleStateId,
    toLifecycleStateId: targetState.id,
    validationReportId: validationReport.validationReportId,
    auditEventId: auditEvent.id,
  });

  const afterTransitionData = definition.afterTransition
    ? await definition.afterTransition({
        tx,
        transportId: transport.id,
        ctx,
        validationReportId: validationReport.validationReportId,
        auditEventId: auditEvent.id,
      })
    : undefined;

  const updatedTransport = await updateTransportAfterTransition({
    tx,
    transportId: transport.id,
    targetLifecycleStateId: targetState.id,
    validationReportId: validationReport.validationReportId,
    auditEventId: auditEvent.id,
    updatedByUserId: ctx.userId,
    updateTransport: definition.updateTransport,
  });

  return {
    ok: true as const,
    transportId: updatedTransport.id,
    previousState: transport.currentLifecycleState.displayName,
    currentState: updatedTransport.currentLifecycleState.displayName,
    validationReport,
    stateHistoryId: stateHistory.id,
    auditEventId: auditEvent.id,
    ...(afterTransitionData ?? {}),
  };
}
