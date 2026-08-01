import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutedCheck, ValidationReportsService } from '../validation-reports/validation-reports.service';
import { ActionReasonDto } from './dto/action-reason.dto';
import { CreateTransportDto } from './dto/create-transport.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { buildCloseTransportChecks } from './transport-close-checks';
import { executeTransportCreate } from './transport-create.use-case';
import { nextLedgerNumber } from './transport-numbering';
import { recordTransportPayment } from './transport-payment-ledger';
import {
  getTransport,
  listTransports,
} from './transport-read.repository';
import {
  getTransportTransitionPolicy,
} from './transport-transition.policy';
import {
  executeTransportTransition,
  TransitionDefinition,
} from './transport-transition.use-case';

@Injectable()
export class TransportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
    private readonly validationReports: ValidationReportsService,
  ) {}

  async create(dto: CreateTransportDto, ctx: RequestContext) {
    return this.prisma.$transaction((tx: Prisma.TransactionClient) =>
      executeTransportCreate({
        prisma: this.prisma,
        lifecycle: this.lifecycle,
        audit: this.audit,
        tx,
        dto,
        ctx,
      }),
    );
  }

  list(ctx: RequestContext) {
    return listTransports(this.prisma, ctx);
  }

  get(id: string, ctx: RequestContext) {
    return getTransport(this.prisma, id, ctx);
  }

  accept(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('accept'),
      reason: dto.reason,
    });
  }

  arrivePickup(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('arrivePickup'),
      reason: dto.reason,
    });
  }

  completePickup(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('completePickup'),
      reason: dto.reason,
    });
  }

  startMission(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('startMission'),
      reason: dto.reason,
    });
  }

  arriveDelivery(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('arriveDelivery'),
      reason: dto.reason,
    });
  }

  completeDelivery(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('completeDelivery'),
      reason: dto.reason,
    });
  }

  submitDocuments(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('submitDocuments'),
      reason: dto.reason,
    });
  }

  registerPayment(id: string, dto: RegisterPaymentDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('registerPayment'),
      reason: dto.description,
      extraChecks: async () => [
        this.check(
          'PAYMENT_AMOUNT_POSITIVE',
          Number(dto.amount) > 0 ? 'passed' : 'failed',
          Number(dto.amount) > 0 ? 'Payment amount is positive.' : 'Payment amount must be greater than zero.',
        ),
      ],
      afterTransition: async ({ tx, transportId, ctx: innerCtx, validationReportId, auditEventId }) => {
        const ledgerNumber = await nextLedgerNumber(this.prisma, innerCtx.companyId);
        return recordTransportPayment({
          tx,
          ctx: innerCtx,
          dto,
          transportId,
          ledgerNumber,
          validationReportId,
          auditEventId,
        });
      },
    });
  }

  closeTransport(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('closeTransport'),
      reason: dto.reason,
      extraChecks: async ({ tx, transportId }) =>
        buildCloseTransportChecks(tx, transportId),
    });
  }

  archiveTransport(id: string, dto: ActionReasonDto, ctx: RequestContext) {
    return this.transition(id, ctx, {
      ...getTransportTransitionPolicy('archiveTransport'),
      reason: dto.reason,
      updateTransport: { isArchived: true },
    });
  }

  private async transition(id: string, ctx: RequestContext, definition: TransitionDefinition) {
    const result = await this.prisma.$transaction(
      (tx: Prisma.TransactionClient) =>
        executeTransportTransition({
          lifecycle: this.lifecycle,
        audit: this.audit,
          validationReports: this.validationReports,
        tx,
          id,
        ctx,
        definition,
        }),
    );

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

}
