import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthorityControlPlaneService } from '../src/authority-control-plane/authority-control-plane.service';
import type { RequestContext } from '../src/common/request-context';

async function main() {
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!company) throw new Error('No Company exists.');
    const user = await prisma.user.findFirst({ where: { companyId: company.id }, orderBy: { createdAt: 'asc' } });
    if (!user) throw new Error('No User exists.');
    const ctx: RequestContext = { companyId: company.id, userId: user.id, roles: ['OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
    const service = new AuthorityControlPlaneService(prisma as never);
    const result = await service.assessGate(['api:authority-control-plane-contract', 'api:authority-control-plane-db', 'web:premium-foundation', 'web:production-build', 'api:car-mover-p0-01', 'web:car-mover-p0-02'], ctx);
    console.log(JSON.stringify(result, null, 2));
  } finally { await prisma.$disconnect(); }
}

void main();
