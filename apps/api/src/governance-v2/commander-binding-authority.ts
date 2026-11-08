import type { PrismaClient } from '@prisma/client';

// Operational principal selection only. Never grants a role or changes a
// Governance contract. The operator supplies a specific official recovery audit
// request reference, not an arbitrary user id or a most-recent-login heuristic.
export async function verifyCommanderRecoveryAuthority(
  prisma: Pick<PrismaClient, 'auditEvent' | 'user' | 'authSession'>,
  companyId: string,
  activeOwnerIds: readonly string[],
  requestId: string,
  now = new Date(),
): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new Error('GOVERNANCE_COMMANDER_RECOVERY_REFERENCE_INVALID');
  }
  const audits = await prisma.auditEvent.findMany({
    where: { companyId, requestId, actionCode: 'AUTH_PASSWORD_RECOVERED', actorType: 'User',
      occurredAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now } },
    select: { actorUserId: true, entityId: true, metadata: true, occurredAt: true },
  });
  if (audits.length !== 1) throw new Error('GOVERNANCE_COMMANDER_RECOVERY_AUDIT_NOT_UNIQUE');
  const audit = audits[0];
  const metadata = audit.metadata as Record<string, unknown> | null;
  if (!audit.actorUserId || audit.entityId !== audit.actorUserId || !activeOwnerIds.includes(audit.actorUserId)
    || metadata?.ownershipProof !== 'SINGLE_USE_EMAIL_LINK' || metadata?.sessionsRevoked !== true
    || !Number.isInteger(metadata?.credentialVersion)) {
    throw new Error('GOVERNANCE_COMMANDER_RECOVERY_AUTHORITY_INVALID');
  }
  const user = await prisma.user.findFirst({
    where: { id: audit.actorUserId, companyId, status: 'Active', company: { isActive: true },
      roles: { some: { companyId, role: { companyId, code: 'company_owner', isActive: true } } } },
    select: { id: true, credentialVersion: true },
  });
  if (!user || user.credentialVersion !== metadata.credentialVersion) {
    throw new Error('GOVERNANCE_COMMANDER_RECOVERY_ACCOUNT_NOT_CURRENT');
  }
  const session = await prisma.authSession.findFirst({
    where: { userId: user.id, companyId, revokedAt: null, expiresAt: { gt: now }, createdAt: { gte: audit.occurredAt } },
    select: { id: true },
  });
  if (!session) throw new Error('GOVERNANCE_COMMANDER_POST_RECOVERY_SESSION_NOT_PROVEN');
  return user.id;
}
