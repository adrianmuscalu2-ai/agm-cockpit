import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransportDto } from './dto/create-transport.dto';
import { TRANSPORT_LIFECYCLE_CONTRACT } from './transport-lifecycle.contract';
import { recordTransportCreationAudit } from './transport-creation-records';
import { nextTransportNumber } from './transport-numbering';
import {
  createTransportRecord,
  linkTransportAuditEvent,
} from './transport-write.repository';

export async function executeTransportCreate(input: {
  prisma: PrismaService;
  lifecycle: LifecycleService;
  audit: AuditService;
  tx: Prisma.TransactionClient;
  dto: CreateTransportDto;
  ctx: RequestContext;
}) {
  const { prisma, lifecycle, audit, tx, dto, ctx } = input;

  const importedState = await lifecycle.getStateByCode(
    ctx.companyId,
    TRANSPORT_LIFECYCLE_CONTRACT.initialStateCode,
    tx,
  );
  const transportNumber = await nextTransportNumber(prisma, ctx.companyId);

  const transport = await createTransportRecord({
    tx,
    dto,
    ctx,
    transportNumber,
    initialLifecycleStateId: importedState.id,
  });

  const auditEvent = await recordTransportCreationAudit({
    audit,
    tx,
    ctx,
    transport,
  });

  await linkTransportAuditEvent({
    tx,
    transportId: transport.id,
    auditEventId: auditEvent.id,
  });

  return {
    transportId: transport.id,
    transportNumber: transport.transportNumber,
    currentState: transport.currentLifecycleState.displayName,
    auditEventId: auditEvent.id,
  };
}
