import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

type Transaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

interface CreateAuditEventInput {
  actionCode: string;
  entityType: string;
  entityId: string;
  transportJobId?: string;
  reason?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  validationReportId?: string;
  metadata?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateAuditEventInput, ctx: RequestContext, tx: Transaction = this.prisma) {
    return tx.auditEvent.create({
      data: {
        companyId: ctx.companyId,
        actorUserId: ctx.userId,
        actorType: 'User',
        actionCode: input.actionCode,
        entityType: input.entityType,
        entityId: input.entityId,
        transportJobId: input.transportJobId,
        reason: input.reason,
        beforeSnapshot: input.beforeSnapshot as never,
        afterSnapshot: input.afterSnapshot as never,
        validationReportId: input.validationReportId,
        requestId: ctx.requestId || randomUUID(),
        correlationId: ctx.correlationId || randomUUID(),
        metadata: input.metadata as never,
      },
    });
  }
}
