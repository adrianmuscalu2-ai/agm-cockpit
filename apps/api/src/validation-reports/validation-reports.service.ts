import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

type Transaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ExecutedCheck {
  code: string;
  severity: 'mandatory' | 'advisory' | 'informational';
  status: 'passed' | 'failed' | 'skipped' | 'not_applicable';
  executedAt: string;
  durationMs: number;
  message: string;
  evidenceIds?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  details?: Record<string, unknown>;
}

interface CreateValidationReportInput {
  validationType: string;
  relatedBusinessAction: string;
  relatedEntityType: string;
  relatedEntityId: string;
  transportJobId?: string;
  overallResult: 'passed' | 'failed';
  executedChecks: ExecutedCheck[];
  executionDurationMs: number;
  parentValidationReportId?: string;
}

@Injectable()
export class ValidationReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateValidationReportInput, ctx: RequestContext, tx: Transaction = this.prisma) {
    return tx.businessValidationReport.create({
      data: {
        validationReportId: randomUUID(),
        companyId: ctx.companyId,
        validationType: input.validationType,
        validationVersion: '2026.1',
        parentValidationReportId: input.parentValidationReportId,
        correlationId: ctx.correlationId || randomUUID(),
        requestId: ctx.requestId || randomUUID(),
        overallResult: input.overallResult,
        executedChecks: input.executedChecks as never,
        relatedBusinessAction: input.relatedBusinessAction,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        transportJobId: input.transportJobId,
        executionDurationMs: input.executionDurationMs,
        createdByUserId: ctx.userId,
      },
    });
  }
}
