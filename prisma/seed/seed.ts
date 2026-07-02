import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const lifecycleStates = [
  ['imported', 'Imported', 10],
  ['accepted', 'Accepted', 20],
  ['at_pickup', 'AtPickup', 30],
  ['pickup_completed', 'PickupCompleted', 40],
  ['in_transport', 'InTransport', 50],
  ['mission_paused', 'MissionPaused', 60],
  ['incident_reported', 'IncidentReported', 70],
  ['at_delivery', 'AtDelivery', 80],
  ['delivery_completed', 'DeliveryCompleted', 90],
  ['documents_submitted', 'DocumentsSubmitted', 100],
  ['paid', 'Paid', 110],
  ['closed', 'Closed', 120],
  ['archived', 'Archived', 130],
  ['cancelled', 'Cancelled', 140],
] as const;

async function main() {
  const company = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      companyName: process.env.DEFAULT_COMPANY_NAME ?? 'AGM',
      countryCode: process.env.DEFAULT_COMPANY_COUNTRY ?? 'DE',
      defaultCurrencyCode: process.env.DEFAULT_CURRENCY ?? 'EUR',
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: { companyId_code: { companyId: company.id, code: 'company_owner' } },
    update: {},
    create: {
      companyId: company.id,
      code: 'company_owner',
      displayName: 'Company Owner',
      description: 'Full business access and final approval authority.',
    },
  });

  const passwordHash = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe123!', 12);
  const owner = await prisma.user.upsert({
    where: { companyId_email: { companyId: company.id, email: process.env.SEED_OWNER_EMAIL ?? 'owner@agm.local' } },
    update: {},
    create: {
      companyId: company.id,
      displayName: process.env.SEED_OWNER_NAME ?? 'AGM Owner',
      email: process.env.SEED_OWNER_EMAIL ?? 'owner@agm.local',
      passwordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: {
      companyId: company.id,
      userId: owner.id,
      roleId: ownerRole.id,
      assignedByUserId: owner.id,
    },
  });

  for (const [code, displayName, sortOrder] of lifecycleStates) {
    await prisma.lifecycleState.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: {},
      create: {
        companyId: company.id,
        code,
        displayName,
        sortOrder,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
