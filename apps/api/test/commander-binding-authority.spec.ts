import type { PrismaClient } from '@prisma/client';
import { verifyCommanderRecoveryAuthority } from '../src/governance-v2/commander-binding-authority';

const COMPANY = '00000000-0000-0000-0000-000000000001';
const OWNER = '00000000-0000-4000-8000-000000000011';
const OTHER = '00000000-0000-4000-8000-000000000012';
const REQUEST = '00000000-0000-4000-8000-000000000013';
const NOW = new Date('2026-11-08T22:00:00Z');
function fixture() {
  const audit = { actorUserId: OWNER, entityId: OWNER, occurredAt: new Date(NOW.getTime() - 60_000),
    metadata: { ownershipProof: 'SINGLE_USE_EMAIL_LINK', sessionsRevoked: true, credentialVersion: 3 } };
  const db = {
    auditEvent: { findMany: jest.fn().mockResolvedValue([audit]) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: OWNER, credentialVersion: 3 }) },
    authSession: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-session' }) },
  };
  const resolve = () => verifyCommanderRecoveryAuthority(db as unknown as PrismaClient, COMPANY, [OWNER, OTHER], REQUEST, NOW);
  return { audit, db, resolve };
}
describe('specific official recovery authority for Commander binding', () => {
  it('resolves the specifically referenced owner among multiple owners, not the first owner', async () => {
    const { db, resolve } = fixture();
    await expect(resolve()).resolves.toBe(OWNER);
    expect(db.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: COMPANY, requestId: REQUEST, actionCode: 'AUTH_PASSWORD_RECOVERED' }),
    }));
    expect(db.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: OWNER, companyId: COMPANY, status: 'Active',
        roles: { some: { companyId: COMPANY, role: { companyId: COMPANY, code: 'company_owner', isActive: true } } } }),
    }));
    expect(db.authSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: OWNER, companyId: COMPANY, revokedAt: null, expiresAt: { gt: NOW } }),
    }));
  });
  it('rejects malformed references without querying', async () => {
    const { db } = fixture();
    await expect(verifyCommanderRecoveryAuthority(db as unknown as PrismaClient, COMPANY, [OWNER], 'injected;value', NOW)).rejects.toThrow('REFERENCE_INVALID');
    expect(db.auditEvent.findMany).not.toHaveBeenCalled();
  });
  it('rejects absent or duplicate official audit records', async () => {
    const { db, audit, resolve } = fixture();
    for (const entries of [[], [audit, audit]]) {
      db.auditEvent.findMany.mockResolvedValueOnce(entries);
      await expect(resolve()).rejects.toThrow('AUDIT_NOT_UNIQUE');
    }
  });
  it('never selects a non-owner because they recovered a password', async () => {
    const { db } = fixture();
    await expect(verifyCommanderRecoveryAuthority(db as unknown as PrismaClient, COMPANY, [OTHER], REQUEST, NOW)).rejects.toThrow('AUTHORITY_INVALID');
  });
  it('requires actual single-use mail proof and session invalidation', async () => {
    const { db, audit, resolve } = fixture();
    db.auditEvent.findMany.mockResolvedValueOnce([{ ...audit, metadata: { ...audit.metadata, ownershipProof: 'UNPROVEN' } }]);
    await expect(resolve()).rejects.toThrow('AUTHORITY_INVALID');
  });
  it('rejects inactive, foreign-company or role-ineligible accounts returned as absent', async () => {
    const { db, resolve } = fixture();
    db.user.findFirst.mockResolvedValueOnce(null);
    await expect(resolve()).rejects.toThrow('ACCOUNT_NOT_CURRENT');
  });
  it('rejects a superseded credential version', async () => {
    const { db, resolve } = fixture();
    db.user.findFirst.mockResolvedValueOnce({ id: OWNER, credentialVersion: 4 });
    await expect(resolve()).rejects.toThrow('ACCOUNT_NOT_CURRENT');
  });
  it('requires a real unrevoked post-recovery login session', async () => {
    const { db, resolve } = fixture();
    db.authSession.findFirst.mockResolvedValueOnce(null);
    await expect(resolve()).rejects.toThrow('SESSION_NOT_PROVEN');
  });
});
