import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { MachineAuthService } from '../src/machine-auth/machine-auth.service';
import { MACHINE_AUTH_CONTRACT } from '../src/machine-auth/machine-auth.contract';

const identityId = '10000000-0000-4000-8000-000000000001';
const credentialId = '20000000-0000-4000-8000-000000000001';
const companyId = '30000000-0000-4000-8000-000000000001';
const secret = `${credentialId}.${'a'.repeat(64)}`;
const secretHash = createHash('sha256').update(secret).digest('hex');
const identity = {
  id: identityId,
  companyId,
  subject: 'acp-reader-1',
  issuer: MACHINE_AUTH_CONTRACT.issuer,
  audience: MACHINE_AUTH_CONTRACT.audience,
  scopes: [MACHINE_AUTH_CONTRACT.scope],
  status: MACHINE_AUTH_CONTRACT.activeIdentityStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function credential(overrides: Record<string, unknown> = {}) {
  return {
    id: credentialId,
    identityId,
    secretHash,
    version: 1,
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    lastUsedAt: null,
    createdAt: new Date(),
    identity,
    ...overrides,
  };
}

function serviceFor(found: unknown) {
  const prisma = {
    machineCredential: { findUnique: jest.fn().mockResolvedValue(found) },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  return { service: new MachineAuthService(prisma as never, jwt as never), prisma, jwt };
}

describe('canonical machine credentials', () => {
  it('rejects an unknown credential', async () => {
    const { service } = serviceFor(null);
    await expect(service.issueToken(identityId, secret)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked credential', async () => {
    const { service } = serviceFor(credential({ revokedAt: new Date() }));
    await expect(service.issueToken(identityId, secret)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired credential', async () => {
    const { service } = serviceFor(credential({ expiresAt: new Date(Date.now() - 1) }));
    await expect(service.issueToken(identityId, secret)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('issues only canonical claims and records issuance without the secret', async () => {
    const { service, prisma, jwt } = serviceFor(credential());
    await expect(service.issueToken(identityId, secret)).resolves.toMatchObject({
      access_token: 'signed-token',
      token_type: 'Bearer',
      expires_in: MACHINE_AUTH_CONTRACT.accessTokenExpiresInSeconds,
      scope: MACHINE_AUTH_CONTRACT.scope,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sub: identity.subject,
      companyId,
      client_id: identityId,
      credential_id: credentialId,
      scope: MACHINE_AUTH_CONTRACT.scope,
      token_use: MACHINE_AUTH_CONTRACT.tokenUse,
    }), expect.objectContaining({ issuer: MACHINE_AUTH_CONTRACT.issuer, audience: MACHINE_AUTH_CONTRACT.audience }));
    expect(JSON.stringify(prisma.auditEvent.create.mock.calls)).not.toContain(secret);
  });

  it('requires tenant-owner authority for provisioning', async () => {
    const { service } = serviceFor(null);
    await expect(service.provision('reader', 30, {
      userId: '40000000-0000-4000-8000-000000000001',
      companyId,
      roles: ['PREMIUM_ACCESS'],
      requestId: '',
      correlationId: '',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
