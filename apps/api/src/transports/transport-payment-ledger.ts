import { Prisma } from '@prisma/client';

import { RequestContext } from '../common/request-context';
import { RegisterPaymentDto } from './dto/register-payment.dto';

interface RecordTransportPaymentInput {
  tx: Prisma.TransactionClient;
  ctx: RequestContext;
  dto: RegisterPaymentDto;
  transportId: string;
  ledgerNumber: string;
  validationReportId: string;
  auditEventId: string;
}

export async function recordTransportPayment({
  tx,
  ctx,
  dto,
  transportId,
  ledgerNumber,
  validationReportId,
  auditEventId,
}: RecordTransportPaymentInput) {
  const entry = await tx.financialLedger.create({
    data: {
      companyId: ctx.companyId,
      transportJobId: transportId,
      ledgerNumber,
      entryType: 'payment',
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      recordedByUserId: ctx.userId,
      description: dto.description ?? 'Payment registered.',
      validationReportId,
      auditEventId,
    },
  });

  return {
    financialLedgerEntryId: entry.id,
    ledgerNumber,
  };
}
