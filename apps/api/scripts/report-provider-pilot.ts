import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import type { RequestContext } from '../src/common/request-context';
import { PilotOperationsService } from '../src/pilot-operations/pilot-operations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const config = new ConfigService(process.env);
const prisma = new PrismaService(config);
const pilot = new PilotOperationsService(prisma);

async function main() {
  await prisma.$connect();

  const owner = await prisma.user.findFirst({
    where: {
      email: { equals: 'agm.transporte.logistik@gmail.com', mode: 'insensitive' },
      status: 'Active',
    },
    include: { roles: { include: { role: true } } },
  });

  if (!owner) {
    throw new Error('PILOT_OWNER_ACCOUNT_NOT_FOUND');
  }

  const context: RequestContext = {
    companyId: owner.companyId,
    userId: owner.id,
    roles: [...owner.roles.map((item) => item.role.code), 'OWNER', 'PREMIUM_ACCESS'],
    requestId: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
  };

  const report = await pilot.report(
    context,
    new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    new Date().toISOString(),
  );

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        secretValuesPrinted: false,
        ...report,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'PILOT_REPORT_FAILED');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
