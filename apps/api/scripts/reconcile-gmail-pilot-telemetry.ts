import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaService(new ConfigService(process.env));

async function main() {
  await prisma.$connect();

  const activation = await prisma.providerPilotActivation.findFirst({
    where: { providerId: 'gmail' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!activation) throw new Error('GMAIL_PILOT_NOT_PROVISIONED');

  const latest = await prisma.providerUsageEvent.findFirst({
    where: {
      companyId: activation.companyId,
      providerId: 'gmail',
      eventType: 'PROVIDER_REQUEST',
      occurredAt: { gte: activation.pilotStartAt },
    },
    orderBy: { occurredAt: 'desc' },
  });
  const metrics = (latest?.metrics ?? {}) as Record<string, unknown>;
  const syncMessages = metrics.syncMessages;

  if (!Number.isInteger(syncMessages) || Number(syncMessages) < 0) {
    throw new Error('GMAIL_SYNC_MESSAGE_COUNT_UNAVAILABLE');
  }

  await prisma.gmailPilotTelemetry.update({
    where: { companyId: activation.companyId },
    data: { messagesProcessed: Number(syncMessages) },
  });

  console.log(JSON.stringify({
    state: 'RECONCILED',
    messagesProcessed: Number(syncMessages),
    secretValuesPrinted: false,
  }));
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'GMAIL_PILOT_RECONCILIATION_FAILED');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
