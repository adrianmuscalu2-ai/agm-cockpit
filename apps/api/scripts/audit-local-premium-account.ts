import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const candidates = ['agm.transporte.logistik@gmail.com', 'adrianmuscalu2@gmail.com'];
async function main() {
try {
  const users = await prisma.user.findMany({
    where: { email: { in: candidates, mode: 'insensitive' } },
    select: {
      email: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      authSessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, expiresAt: true, lastUsedAt: true } },
      roles: { select: { role: { select: { code: true, isActive: true } } } },
    },
  });
  for (const email of candidates) {
    const user = users.find((entry) => entry.email.toLowerCase() === email);
    console.log(JSON.stringify({
      email,
      exists: Boolean(user),
      status: user?.status ?? null,
      roles: user?.roles.filter((entry) => entry.role.isActive).map((entry) => entry.role.code).sort() ?? [],
      createdAt: user?.createdAt.toISOString() ?? null,
      lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
      activeSessions: user?.authSessions.length ?? 0,
      sessionExpiresAt: user?.authSessions[0]?.expiresAt.toISOString() ?? null,
      sessionLastUsedAt: user?.authSessions[0]?.lastUsedAt.toISOString() ?? null,
    }));
  }
  const privileged = await prisma.user.findMany({
    where: { roles: { some: { role: { code: { in: ['company_owner', 'PREMIUM_ACCESS'] }, isActive: true } } } },
    select: { email: true, status: true, roles: { select: { role: { select: { code: true, isActive: true } } } } },
  });
  console.log(JSON.stringify({ privilegedAccounts: privileged.map((user) => ({ email: user.email, status: user.status, roles: user.roles.filter((entry) => entry.role.isActive).map((entry) => entry.role.code).sort() })) }));
  const roles = await prisma.role.findMany({ select: { code: true, isActive: true }, orderBy: { code: 'asc' } });
  console.log(JSON.stringify({ roles }));
  console.log('PASSWORD MATERIAL — NOT READ / NOT PRINTED');
} finally {
  await prisma.$disconnect();
}
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'AUDIT_FAILED'); process.exitCode = 1; });
