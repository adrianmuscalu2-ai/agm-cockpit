import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

export function listTransports(
  prisma: PrismaService,
  ctx: RequestContext,
) {
  return prisma.transportJob.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
    include: { currentLifecycleState: true },
  });
}

export async function getTransport(
  prisma: PrismaService,
  id: string,
  ctx: RequestContext,
) {
  const transport = await prisma.transportJob.findFirst({
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

export function getTransportForTransition(
  tx: Prisma.TransactionClient,
  id: string,
  ctx: RequestContext,
) {
  return tx.transportJob.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { currentLifecycleState: true },
  });
}
