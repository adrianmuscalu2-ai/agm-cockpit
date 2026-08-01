import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { RequestContext } from '../common/request-context';

interface CreatedTransport {
  id: string;
  transportNumber: string;
  currentLifecycleStateId: string;
  currentLifecycleState?: {
    code: string;
    displayName: string;
  };
}

export function recordTransportCreationAudit(input: {
  audit: AuditService;
  tx: Prisma.TransactionClient;
  ctx: RequestContext;
  transport: CreatedTransport;
}) {
  const { audit, tx, ctx, transport } = input;

  return audit.create(
    {
      actionCode: 'create-transport',
      entityType: 'TransportJob',
      entityId: transport.id,
      transportJobId: transport.id,
      reason: 'Transport created through business action API.',
      afterSnapshot: {
        id: transport.id,
        transportNumber: transport.transportNumber,
        currentLifecycleStateId: transport.currentLifecycleStateId,
        currentLifecycleState: transport.currentLifecycleState,
      },
    },
    ctx,
    tx,
  );
}
