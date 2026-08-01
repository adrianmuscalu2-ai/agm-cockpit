import { Prisma } from '@prisma/client';

import { RequestContext } from '../common/request-context';
import { CreateTransportDto } from './dto/create-transport.dto';

export function createTransportRecord(input: {
  tx: Prisma.TransactionClient;
  dto: CreateTransportDto;
  ctx: RequestContext;
  transportNumber: string;
  initialLifecycleStateId: string;
}) {
  const {
    tx,
    dto,
    ctx,
    transportNumber,
    initialLifecycleStateId,
  } = input;

  return tx.transportJob.create({
    data: {
      companyId: ctx.companyId,
      transportNumber,
      currentLifecycleStateId: initialLifecycleStateId,
      pickupAddressSnapshot: dto.pickupAddressSnapshot as never,
      deliveryAddressSnapshot: dto.deliveryAddressSnapshot as never,
      plannedPickupFrom: dto.plannedPickupFrom
        ? new Date(dto.plannedPickupFrom)
        : undefined,
      plannedPickupTo: dto.plannedPickupTo
        ? new Date(dto.plannedPickupTo)
        : undefined,
      plannedDeliveryAt: dto.plannedDeliveryAt
        ? new Date(dto.plannedDeliveryAt)
        : undefined,
      paymentAmount: dto.paymentAmount,
      currencyCode: dto.currencyCode ?? 'EUR',
      createdByUserId: ctx.userId,
    },
    include: { currentLifecycleState: true },
  });
}

export function linkTransportAuditEvent(input: {
  tx: Prisma.TransactionClient;
  transportId: string;
  auditEventId: string;
}) {
  const { tx, transportId, auditEventId } = input;

  return tx.transportJob.update({
    where: { id: transportId },
    data: { auditEventId },
  });
}

export function updateTransportAfterTransition(input: {
  tx: Prisma.TransactionClient;
  transportId: string;
  targetLifecycleStateId: string;
  validationReportId: string;
  auditEventId: string;
  updatedByUserId: string;
  updateTransport?: Pick<
    Prisma.TransportJobUncheckedUpdateInput,
    'isArchived'
  >;
}) {
  const {
    tx,
    transportId,
    targetLifecycleStateId,
    validationReportId,
    auditEventId,
    updatedByUserId,
    updateTransport,
  } = input;

  return tx.transportJob.update({
    where: { id: transportId },
    data: {
      currentLifecycleStateId: targetLifecycleStateId,
      validationReportId,
      auditEventId,
      updatedByUserId,
      ...(updateTransport ?? {}),
    },
    include: { currentLifecycleState: true },
  });
}
