import { credentialReadiness, inspectCredentialReadiness, CREDENTIAL_SUBJECTS } from '../src/authority-control-plane/credential-readiness';

const now = new Date('2026-11-16T12:00:00Z');
const credential = { id: 'v3', version: 3, createdAt: new Date('2026-11-16T10:00:00Z'), lastUsedAt: new Date('2026-11-16T10:01:00Z'), expiresAt: new Date('2026-11-17T10:00:00Z'), revokedAt: null };
const identity = { id: 'machine', subject: CREDENTIAL_SUBJECTS[0], status: 'ACTIVE', credentials: [credential] };
describe('ACP machine credential lifecycle observation', () => {
  it('warns before expiry, fails at expiry and never accepts an older authenticated version', () => {
    expect(credentialReadiness(identity, now).state).toBe('READY');
    expect(credentialReadiness(identity, new Date('2026-11-16T23:00:00Z')).state).toBe('EXPIRING');
    expect(credentialReadiness(identity, credential.expiresAt).state).toBe('EXPIRED');
    expect(credentialReadiness({ ...identity, credentials: [credential, { ...credential, id: 'v4', version: 4, lastUsedAt: null }] }, now).state).toBe('UNVERIFIED');
    expect(credentialReadiness(undefined, now).state).toBe('MISSING');
    expect(credentialReadiness({ ...identity, credentials: [{ ...credential, revokedAt: now }] }, now).state).toBe('UNAVAILABLE');
  });
  it('records one escalation per state/version and an authenticated recovery without rewriting history', async () => {
    const rows: Array<Record<string, any>> = [];
    const machine = { ...identity, credentials: [{ ...credential, expiresAt: now }] };
    const tx = { $executeRaw: jest.fn(), machineIdentity: { findMany: jest.fn(async () => [machine, { ...identity, subject: CREDENTIAL_SUBJECTS[1] }]) },
      authorityAuditJournal: { findFirst: jest.fn(async ({ where }) => [...rows].reverse().find(r => r.actorId === where.actorId)), create: jest.fn(async ({ data }) => { rows.push(data); return data; }) } };
    const db = { $transaction: jest.fn(async f => f(tx)) };
    const ctx = { companyId: 'tenant', userId: 'observer', roles: [], correlationId: 'correlation', requestId: 'request' };
    expect((await inspectCredentialReadiness(db as never, ctx, now)).passed).toBe(false);
    await inspectCredentialReadiness(db as never, ctx, now);
    expect(rows).toHaveLength(2);
    machine.credentials = [{ ...credential, id: 'v4', version: 4 }];
    expect((await inspectCredentialReadiness(db as never, ctx, now)).passed).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows[0].eventType).toBe('M2M_CREDENTIAL_ESCALATED');
    expect(rows[2].eventType).toBe('M2M_CREDENTIAL_RECOVERED');
    expect(rows[2].safeMetadata.priorEventId).toBe(rows[0].eventId);
    expect(JSON.stringify(rows)).not.toMatch(/secretHash|clientSecret/);
  });
});
