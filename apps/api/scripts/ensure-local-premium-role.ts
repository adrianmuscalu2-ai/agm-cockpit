import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('LOCAL_DATABASE_REQUIRED');
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findFirst({ where: { email: 'owner@agm.local', status: 'Active' }, select: { companyId: true } });
    if (!owner) throw new Error('LOCAL_PLACEHOLDER_OWNER_NOT_FOUND');
    const role = await prisma.role.upsert({
      where: { companyId_code: { companyId: owner.companyId, code: 'PREMIUM_ACCESS' } },
      update: { isActive: true, displayName: 'Premium Access' },
      create: { companyId: owner.companyId, code: 'PREMIUM_ACCESS', displayName: 'Premium Access', description: 'Local validation entitlement' },
    });
    console.log(JSON.stringify({ environment: 'LOCAL', role: role.code, active: role.isActive }));
  } finally { await prisma.$disconnect(); }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'ROLE_PROVISION_FAILED'); process.exitCode = 1; });
