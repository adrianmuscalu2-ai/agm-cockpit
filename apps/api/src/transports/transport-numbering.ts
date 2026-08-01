import { PrismaService } from '../prisma/prisma.service';

export async function nextTransportNumber(
  prisma: PrismaService,
  companyId: string,
) {
  const count = await prisma.transportJob.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `AGM-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function nextLedgerNumber(
  prisma: PrismaService,
  companyId: string,
) {
  const count = await prisma.financialLedger.count({ where: { companyId } });
  const year = new Date().getFullYear();
  return `AGM-FIN-${year}-${String(count + 1).padStart(4, '0')}`;
}
