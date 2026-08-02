import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const companyId = '00000000-0000-0000-0000-000000000001';

async function main() {
  const email = required('PREMIUM_TEST_EMAIL').trim().toLowerCase();
  const password = required('PREMIUM_TEST_PASSWORD');
  if (password.length < 14) throw new Error('PREMIUM_TEST_PASSWORD must contain at least 14 characters.');

  const company = await prisma.company.upsert({
    where: { id: companyId },
    update: {},
    create: {
      id: companyId, companyName: 'AGM Local Test', countryCode: 'DE',
      defaultCurrencyCode: 'EUR',
    },
  });
  const role = await prisma.role.upsert({
    where: { companyId_code: { companyId, code: 'PREMIUM_ACCESS' } },
    update: { displayName: 'Premium Access', isActive: true },
    create: {
      companyId, code: 'PREMIUM_ACCESS', displayName: 'Premium Access',
      description: 'Non-Production entitlement used for controlled Access/Premium validation.',
    },
  });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { companyId_email: { companyId, email } },
    update: { displayName: 'AGM Premium Tester', passwordHash, status: 'Active' },
    create: { companyId: company.id, displayName: 'AGM Premium Tester', email, passwordHash },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { companyId, userId: user.id, roleId: role.id, assignedByUserId: user.id },
  });
  console.log(JSON.stringify({ environment: 'local-non-production', email, role: role.code, status: user.status }));
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

main().finally(() => prisma.$disconnect());
