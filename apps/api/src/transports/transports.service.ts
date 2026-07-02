import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutedCheck, ValidationReportsService } from '../validation-reports/validation-reports.service';
import { ActionReasonDto } from './dto/action-reason.dto';
import { CreateTransportDto } from './dto/create-transport.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';

interface TransitionDefinition {
  businessAction: string;
  validationType: string;
  fromStateCodes: string[];
  toStateCode: string;
  successCheckCode: string;
  successMessage: string;
  failureErrorCode: string;
  failureMessage: string;
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
  updateTransport?: Pick<Prisma.TransportJobUncheckedUpdateInput, 'isArchived'>;
}

@Injectable()
export class TransportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
    private readonly validationReports: ValidationReportsService,
  ) {}

  async create(dto: CreateTransportDto, ctx: RequestContext) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const importedState = await this.lifecycle.getStateByCode(ctx.companyId, 'imported', tx);
      const transportNumber = await this.nextTransportNumber(ctx.companyId);

      const transport = await tx.transportJob.create({
        data: {
          companyId: ctx.companyId,
          transportNumber,
          currentLifecycleStateId: importedState.id,
          pickupAddressSnapshot: dto.pickupAddressSnapshot as never,
          deliveryAddressSnapshot: dto.deliveryAddressSnapshot as never,
          plannedPickupFrom: dto.plannedPickupFrom ? new Date(dto.plannedPickupFrom) : undefined,
          plannedPickupTo: dto.plannedPickupTo ? new Date(dto.plannedPickupTo) : undefined,
          plannedDeliveryAt: dto.plannedDeliveryAt ? new Date(dto.plannedDeliveryAt) : undefined,
          paymentAmount: dto.paymentAmount,
          currencyCode: dto.currencyCode ?? 'EUR',
          createdByUserId: ctx.userId,
        },
        include: { currentLifecycleState: true },
      });

      const auditEvent = await this.audit.create(
        {
          actionCode: 'create-transport',
          entityType: 'TransportJob',
          entityId: transport.id,
          transportJobId: transport.id,
          reason: 'Transport created through business action API.',
          afterSnapshot: this.transportSnapshot(transport),
        },
        ctx,
        tx,
      );

      await tx.transportJob.update({
        where: { id: transport.id },
        data: { auditEventId: auditEvent.id },
      });

      return {
        transportId: transport.id,
        transportNumber: transport.transportNumber,
        currentState: transport.currentLifecycleState.displayName,
        auditEventId: auditEvent.id,
      };
    });
  }

  list(ctx: RequestContext) {
    return this.prisma.transportJob.findMany({
      where: { companyId: ctx.companyId },
      orderBy: { createdAt: 'desc' },
      include: { currentLifecycleState: true },
    });
  }

  async get(id: string, ctx: RequestContext) {
    const transport = await this.prisma.transportJob.findFirst({
      where: { id, companyId: ctx.companyId },
      include: {
        currentLifecycleState: true,
        stateHistory: { orderBy: { transitionedAt: 'asc' } },
        validationReports: { orderBy: { createdAt: 'asc' } },
        auditEvents: { orderBy: { occurredAt: 'asc' } },
        financialLedger: { orderBy: { occurredAt: 'asc' } },
      },
    });

    if (!transport) {
      throw new NotFoundException('Transport not found.');
    }

    return transport;
  }

  accept(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'accept',
      validationType: 'AcceptTransport',
      fromStateCodes: ['imported'],
      toStateCode: 'accepted',
      successCheckCode: 'TRANSPORT_CAN_BE_ACCEPTED',
      successMessage: 'Transport can be accepted by the authorized user.',
      failureErrorCode: 'ACCEPT_TRANSPORT_VALIDATION_FAILED',
      failureMessage: 'Transport cannot be accepted because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  arrivePickup(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'arrive-pickup',
      validationType: 'ArrivePickup',
      fromStateCodes: ['accepted'],
      toStateCode: 'at_pickup',
      successCheckCode: 'TRANSPORT_CAN_ARRIVE_PICKUP',
      successMessage: 'Transport can be marked as arrived at pickup.',
      failureErrorCode: 'ARRIVE_PICKUP_VALIDATION_FAILED',
      failureMessage: 'Transport cannot arrive at pickup because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  completePickup(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'complete-pickup',
      validationType: 'CompletePickup',
      fromStateCodes: ['at_pickup'],
      toStateCode: 'pickup_completed',
      successCheckCode: 'PICKUP_CAN_BE_COMPLETED',
      successMessage: 'Pickup can be completed.',
      failureErrorCode: 'COMPLETE_PICKUP_VALIDATION_FAILED',
      failureMessage: 'Pickup cannot be completed because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  startMission(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'start-mission',
      validationType: 'StartMission',
      fromStateCodes: ['pickup_completed'],
      toStateCode: 'in_transport',
      successCheckCode: 'MISSION_CAN_START',
      successMessage: 'Mission can start because pickup is completed.',
      failureErrorCode: 'START_MISSION_VALIDATION_FAILED',
      failureMessage: 'Mission cannot start because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  arriveDelivery(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'arrive-delivery',
      validationType: 'ArriveDelivery',
      fromStateCodes: ['in_transport'],
      toStateCode: 'at_delivery',
      successCheckCode: 'TRANSPORT_CAN_ARRIVE_DELIVERY',
      successMessage: 'Transport can be marked as arrived at delivery.',
      failureErrorCode: 'ARRIVE_DELIVERY_VALIDATION_FAILED',
      failureMessage: 'Transport cannot arrive at delivery because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  completeDelivery(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'complete-delivery',
      validationType: 'CompleteDelivery',
      fromStateCodes: ['at_delivery'],
      toStateCode: 'delivery_completed',
      successCheckCode: 'DELIVERY_CAN_BE_COMPLETED',
      successMessage: 'Delivery can be completed.',
      failureErrorCode: 'COMPLETE_DELIVERY_VALIDATION_FAILED',
      failureMessage: 'Delivery cannot be completed because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  submitDocuments(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'submit-documents',
      validationType: 'SubmitDocuments',
      fromStateCodes: ['delivery_completed'],
      toStateCode: 'documents_submitted',
      successCheckCode: 'DOCUMENTS_CAN_BE_SUBMITTED',
      successMessage: 'Required transport documents can be submitted.',
      failureErrorCode: 'SUBMIT_DOCUMENTS_VALIDATION_FAILED',
      failureMessage: 'Documents cannot be submitted because mandatory validations failed.',
      reason: dto.reason,
    });
  }

  registerPayment(id: string, dto: RegisterPaymentDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'register-payment',
      validationType: 'RegisterPayment',
      fromStateCodes: ['documents_submitted'],
      toStateCode: 'paid',
      successCheckCode: 'PAYMENT_CAN_BE_REGISTERED',
      successMessage: 'Payment can be registered.',
      failureErrorCode: 'REGISTER_PAYMENT_VALIDATION_FAILED',
      failureMessage: 'Payment cannot be registered because mandatory validations failed.',
      reason: dto.description,
      extraChecks: async () => [
        this.check(
          'PAYMENT_AMOUNT_POSITIVE',
          Number(dto.amount) > 0 ? 'passed' : 'failed',
          Number(dto.amount) > 0 ? 'Payment amount is positive.' : 'Payment amount must be greater than zero.',
        ),
      ],
      afterTransition: async ({ tx, transportId, ctx: innerCtx, validationReportId, auditEventId }) => {
        const ledgerNumber = await this.nextLedgerNumber(innerCtx.companyId);
        const entry = await tx.financialLedger.create({
          data: {
            companyId: innerCtx.companyId,
            transportJobId: transportId,
            ledgerNumber,
            entryType: 'payment',
            amount: dto.amount,
            currencyCode: dto.currencyCode,
            occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
            recordedByUserId: innerCtx.userId,
            description: dto.description ?? 'Payment registered.',
            validationReportId,
            auditEventId,
          },
        });

        return { financialLedgerEntryId: entry.id, ledgerNumber };
      },
    });
  }

  closeTransport(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'close-transport',
      validationType: 'CloseTransport',
      fromStateCodes: ['paid'],
      toStateCode: 'closed',
      successCheckCode: 'TRANSPORT_CAN_BE_CLOSED',
      successMessage: 'Transport can be closed.',
      failureErrorCode: 'TRANSPORT_CLOSURE_VALIDATION_FAILED',
      failureMessage: 'Transport cannot be closed because mandatory validations failed.',
      reason: dto.reason,
      extraChecks: async ({ tx, transportId }) => this.closeTransportChecks(tx, transportId),
    });
  }

  archiveTransport(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      businessAction: 'archive-transport',
      validationType: 'ArchiveTransport',
      fromStateCodes: ['closed'],
      toStateCode: 'archived',
      successCheckCode: 'TRANSPORT_CAN_BE_ARCHIVED',
      successMessage: 'Transport can be archived.',
      failureErrorCode: 'ARCHIVE_TRANSPORT_VALIDATION_FAILED',
      failureMessage: 'Transport cannot be archived because mandatory validations failed.',
      reason: dto.reason,
      updateTransport: { isArchived: true },
    });
  }

  private async transition(id: string, ctx: RequestContext, definition: TransitionDefinition) {
    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transport = await tx.transportJob.findFirst({
        where: { id, companyId: ctx.companyId },
        include: { currentLifecycleState: true },
      });

      if (!transport) {
        throw new NotFoundException('Transport not found.');
      }

      const startedAt = Date.now();
      const checks: ExecutedCheck[] = [
        this.check(
          'TRANSPORT_NOT_ARCHIVED',
          transport.isArchived ? 'failed' : 'passed',
          transport.isArchived ? 'Archived transports cannot be changed.' : 'Transport is not archived.',
        ),
        this.check(
          'CURRENT_STATE_ALLOWED',
          definition.fromStateCodes.includes(transport.currentLifecycleState.code) ? 'passed' : 'failed',
          definition.fromStateCodes.includes(transport.currentLifecycleState.code)
            ? `Current state ${transport.currentLifecycleState.displayName} is valid for ${definition.businessAction}.`
            : `Current state ${transport.currentLifecycleState.displayName} is not valid for ${definition.businessAction}.`,
          {
            details: {
              expectedStates: definition.fromStateCodes,
              actualState: transport.currentLifecycleState.code,
            },
          },
        ),
      ];

      if (!transport.isArchived && definition.fromStateCodes.includes(transport.currentLifecycleState.code)) {
        checks.push(
          this.check(definition.successCheckCode, 'passed', definition.successMessage, {
            relatedEntityType: 'TransportJob',
            relatedEntityId: transport.id,
          }),
        );
      }

      if (definition.extraChecks) {
        checks.push(...(await definition.extraChecks({ tx, transportId: transport.id, ctx })));
      }

      const hasFailedMandatoryCheck = checks.some(
        (check) => check.severity === 'mandatory' && !['passed', 'not_applicable'].includes(check.status),
      );

      const validationReport = await this.validationReports.create(
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

      const auditEvent = await this.audit.create(
        {
          actionCode: definition.businessAction,
          entityType: 'TransportJob',
          entityId: transport.id,
          transportJobId: transport.id,
          reason:
            definition.reason ??
            (hasFailedMandatoryCheck
              ? `${definition.businessAction} validation failed.`
              : `${definition.businessAction} completed by authorized user.`),
          beforeSnapshot: this.transportSnapshot(transport),
          validationReportId: validationReport.validationReportId,
        },
        ctx,
        tx,
      );

      if (hasFailedMandatoryCheck) {
        return {
          ok: false,
          validationReport,
          auditEventId: auditEvent.id,
        };
      }

      const targetState = await this.lifecycle.getStateByCode(ctx.companyId, definition.toStateCode, tx);
      const stateHistory = await tx.transportJobStateHistory.create({
        data: {
          companyId: ctx.companyId,
          transportJobId: transport.id,
          fromLifecycleStateId: transport.currentLifecycleStateId,
          toLifecycleStateId: targetState.id,
          businessAction: definition.businessAction,
          transitionReason: definition.reason,
          transitionedByUserId: ctx.userId,
          validationReportId: validationReport.validationReportId,
          relatedAuditEventId: auditEvent.id,
        },
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

      const updatedTransport = await tx.transportJob.update({
        where: { id: transport.id },
        data: {
          currentLifecycleStateId: targetState.id,
          validationReportId: validationReport.validationReportId,
          auditEventId: auditEvent.id,
          updatedByUserId: ctx.userId,
          ...(definition.updateTransport ?? {}),
        },
        include: { currentLifecycleState: true },
      });

      return {
        ok: true,
        transportId: updatedTransport.id,
        previousState: transport.currentLifecycleState.displayName,
        currentState: updatedTransport.currentLifecycleState.displayName,
        validationReport,
        stateHistoryId: stateHistory.id,
        auditEventId: auditEvent.id,
        ...(afterTransitionData ?? {}),
      };
    });

    if (!result.ok) {
      throw new BadRequestException({
        code: definition.failureErrorCode,
        message: definition.failureMessage,
        validationReport: result.validationReport,
        auditEventId: result.auditEventId,
      });
    }

    return result;
  }

  private async closeTransportChecks(tx: Prisma.TransactionClient, transportId: string): Promise<ExecutedCheck[]> {
    const history = await tx.transportJobStateHistory.findMany({
      where: { transportJobId: transportId },
      select: { businessAction: true },
    });
    const actions = new Set(history.map((item) => item.businessAction));
    const ledgerCount = await tx.financialLedger.count({
      where: { transportJobId: transportId, entryType: 'payment' },
    });
    const auditCount = await tx.auditEvent.count({ where: { transportJobId: transportId } });

    return [
      this.check(
        'DELIVERY_INSPECTION_COMPLETED',
        actions.has('complete-delivery') ? 'passed' : 'failed',
        actions.has('complete-delivery') ? 'Delivery inspection is completed.' : 'Delivery inspection is missing.',
      ),
      this.check(
        'REQUIRED_DOCUMENTS_SUBMITTED',
        actions.has('submit-documents') ? 'passed' : 'failed',
        actions.has('submit-documents') ? 'Required documents are submitted.' : 'Required documents are not submitted.',
      ),
      this.check(
        'MANDATORY_EVIDENCE_PRESENT',
        'not_applicable',
        'Evidence upload architecture is not part of Milestone 2 runtime flow.',
      ),
      this.check('NO_UNRESOLVED_INCIDENTS', 'not_applicable', 'Incident records are not part of Milestone 2 runtime flow.'),
      this.check(
        'FINANCIAL_LEDGER_RECONCILED',
        ledgerCount > 0 ? 'passed' : 'failed',
        ledgerCount > 0 ? 'Payment ledger entry exists.' : 'Payment ledger entry is missing.',
      ),
      this.check(
        'REQUIRED_AUDIT_RECORDS_CREATED',
        auditCount > 0 ? 'passed' : 'failed',
        auditCount > 0 ? 'Audit records exist for this transport.' : 'Audit records are missing.',
      ),
      this.check('AI_RECOMMENDATIONS_REVIEWED', 'not_applicable', 'No AI recommendations are part of Milestone 2.'),
      this.check('HUMAN_APPROVALS_COMPLETED', 'not_applicable', 'No additional human approvals are configured for Milestone 2.'),
    ];
  }

  private check(
    code: string,
    status: ExecutedCheck['status'],
    message: string,
    options: Partial<Pick<ExecutedCheck, 'severity' | 'evidenceIds' | 'relatedEntityType' | 'relatedEntityId' | 'details'>> = {},
  ): ExecutedCheck {
    return {
      code,
      severity: options.severity ?? 'mandatory',
      status,
      executedAt: new Date().toISOString(),
      durationMs: 1,
      message,
      evidenceIds: options.evidenceIds,
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: options.relatedEntityId,
      details: options.details,
    };
  }

  private async nextTransportNumber(companyId: string) {
    const count = await this.prisma.transportJob.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `AGM-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async nextLedgerNumber(companyId: string) {
    const count = await this.prisma.financialLedger.count({ where: { companyId } });
    const year = new Date().getFullYear();
    return `AGM-FIN-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private transportSnapshot(transport: {
    id: string;
    transportNumber: string;
    currentLifecycleStateId: string;
    currentLifecycleState?: { code: string; displayName: string };
  }) {
    return {
      id: transport.id,
      transportNumber: transport.transportNumber,
      currentLifecycleStateId: transport.currentLifecycleStateId,
      currentLifecycleState: transport.currentLifecycleState,
    };
  }
}
