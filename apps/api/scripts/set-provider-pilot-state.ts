import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import type { RequestContext } from '../src/common/request-context';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService(new ConfigService(process.env));

async function main() {
  await prisma.$connect();
  const providerId = process.env.PILOT_PROVIDER ?? '';
  const state = process.env.PILOT_STATE ?? '';
  if (!['tomtom','here','tollguru','gmail'].includes(providerId)) throw new Error('PILOT_PROVIDER_INVALID');
  if (!['ACTIVE','SUSPENDED','READY'].includes(state)) throw new Error('PILOT_STATE_INVALID');

  const owner = await prisma.user.findFirst({
    where: { email: { equals: 'agm.transporte.logistik@gmail.com', mode: 'insensitive' }, status: 'Active' },
    include: { roles: { include: { role: true } } },
  });
  if (!owner) throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');

  const context: RequestContext = {
    companyId: owner.companyId,
    userId: owner.id,
    roles: [...owner.roles.map((item) => item.role.code), 'OWNER', 'PREMIUM_ACCESS'],
    requestId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
  };
  const result = await new PilotOperationsService(prisma).setState(
    providerId,
    state as 'ACTIVE'|'SUSPENDED'|'READY',
    process.env.PILOT_STATE_REASON,
    context,
  );
  console.log(JSON.stringify({ providerId: result.providerId, state: result.state, auditRecorded: true, secretValuesPrinted: false }));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'PILOT_STATE_CHANGE_FAILED');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
