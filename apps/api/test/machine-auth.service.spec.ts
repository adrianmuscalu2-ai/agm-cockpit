import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
  const tx = {
    machineCredential: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
  };
  const prisma = {
    machineCredential: {
      findUnique: jest.fn().mockResolvedValue(found),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
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

  it('rejects unsupported scopes stored on an identity', async () => {
    const invalidIdentity = { ...identity, scopes: [MACHINE_AUTH_CONTRACT.scope, 'governance:execute'] };
    const { service } = serviceFor(credential({ identity: invalidIdentity }));
    await expect(service.issueToken(identityId, secret)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects proposal scope stored on a non-Atlas identity', async () => {
    const invalidIdentity = {
      ...identity,
      scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
    };
    const { service } = serviceFor(credential({ identity: invalidIdentity }));
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

  it('grants proposal scope only to the canonical Atlas machine identity', async () => {
    const atlasIdentity = {
      ...identity,
      subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject,
      scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
    };
    const atlasCredential = credential({ identity: atlasIdentity });
    const tx = {
      machineIdentity: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(atlasIdentity) },
      machineCredential: { create: jest.fn().mockResolvedValue(atlasCredential) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = new MachineAuthService(prisma as never, { signAsync: jest.fn().mockResolvedValue('signed-token') } as never);

    const result = await service.provision(atlasIdentity.subject, 1, {
      userId: '40000000-0000-4000-8000-000000000001',
      companyId,
      roles: ['PRODUCT_OWNER'],
      requestId: '50000000-0000-4000-8000-000000000001',
      correlationId: '60000000-0000-4000-8000-000000000001',
    });

    expect(result.scopes).toEqual([MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope]);
    expect(tx.machineIdentity.findFirst).toHaveBeenCalledWith({ where: { companyId, subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject } });
    expect(tx.machineIdentity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject,
      scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
    }) });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      metadata: expect.objectContaining({
        governanceAuthorization: MACHINE_AUTH_CONTRACT.governanceProposeApprovalRef,
        scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
      }),
    }) });
  });

  it('does not grant proposal scope to other machine identities', async () => {
    const tx = {
      machineIdentity: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(identity) },
      machineCredential: { create: jest.fn().mockResolvedValue(credential()) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = new MachineAuthService(prisma as never, { signAsync: jest.fn() } as never);

    await service.provision('other-machine', 1, {
      userId: '40000000-0000-4000-8000-000000000001',
      companyId,
      roles: ['PRODUCT_OWNER'],
      requestId: '50000000-0000-4000-8000-000000000001',
      correlationId: '60000000-0000-4000-8000-000000000001',
    });

    expect(tx.machineIdentity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      subject: 'other-machine',
      scopes: [MACHINE_AUTH_CONTRACT.scope],
    }) });
  });

  it('rejects duplicate provisioning instead of creating a second canonical machine identity', async () => {
    const tx = {
      machineIdentity: { findFirst: jest.fn().mockResolvedValue(identity), create: jest.fn() },
      machineCredential: { create: jest.fn() },
      auditEvent: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = new MachineAuthService(prisma as never, { signAsync: jest.fn() } as never);

    await expect(service.provision('acp-reader-1', 1, {
      userId: '40000000-0000-4000-8000-000000000001',
      companyId,
      roles: ['PRODUCT_OWNER'],
      requestId: '50000000-0000-4000-8000-000000000001',
      correlationId: '60000000-0000-4000-8000-000000000001',
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.machineIdentity.create).not.toHaveBeenCalled();
    expect(tx.machineCredential.create).not.toHaveBeenCalled();
  });

  it('grants the approved Atlas proposal scope during authorized credential rotation', async () => {
    const atlasIdentity = { ...identity, subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject };
    const grantedIdentity = { ...atlasIdentity, scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope] };
    const rotatedCredential = credential({ identity: grantedIdentity, version: 2 });
    const tx = {
      machineIdentity: {
        findFirst: jest.fn().mockResolvedValue(atlasIdentity),
        update: jest.fn().mockResolvedValue(grantedIdentity),
      },
      machineCredential: {
        findFirst: jest.fn().mockResolvedValue({ version: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(rotatedCredential),
      },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = new MachineAuthService(prisma as never, { signAsync: jest.fn() } as never);

    const result = await service.rotate(identityId, 1, {
      userId: '40000000-0000-4000-8000-000000000001',
      companyId,
      roles: ['PRODUCT_OWNER'],
      requestId: '50000000-0000-4000-8000-000000000001',
      correlationId: '60000000-0000-4000-8000-000000000001',
    });

    expect(result.scopes).toEqual([MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope]);
    expect(tx.machineIdentity.update).toHaveBeenCalledWith({
      where: { id: identityId },
      data: { scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope] },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      metadata: expect.objectContaining({
        governanceAuthorization: MACHINE_AUTH_CONTRACT.governanceProposeApprovalRef,
        scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
      }),
    }) });
  });

  it('accepts proposal scope only for an Atlas identity holding that grant', async () => {
    const atlasIdentity = {
      ...identity,
      subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject,
      scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
    };
    const { service } = serviceFor(credential({ identity: atlasIdentity }));
    await expect(service.validateAccess({
      sub: atlasIdentity.subject,
      companyId,
      client_id: identityId,
      credential_id: credentialId,
      scope: `${MACHINE_AUTH_CONTRACT.scope} ${MACHINE_AUTH_CONTRACT.governanceProposeScope}`,
      token_use: MACHINE_AUTH_CONTRACT.tokenUse,
      iss: MACHINE_AUTH_CONTRACT.issuer,
      aud: MACHINE_AUTH_CONTRACT.audience,
    })).resolves.toMatchObject({ scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope] });
  });

  it('issues only the scopes attached to the authenticated Atlas identity', async () => {
    const atlasIdentity = {
      ...identity,
      subject: MACHINE_AUTH_CONTRACT.governanceProposerSubject,
      scopes: [MACHINE_AUTH_CONTRACT.scope, MACHINE_AUTH_CONTRACT.governanceProposeScope],
    };
    const { service, jwt } = serviceFor(credential({ identity: atlasIdentity }));
    await expect(service.issueToken(identityId, secret)).resolves.toMatchObject({
      scope: `${MACHINE_AUTH_CONTRACT.scope} ${MACHINE_AUTH_CONTRACT.governanceProposeScope}`,
    });
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({
      sub: atlasIdentity.subject,
      scope: `${MACHINE_AUTH_CONTRACT.scope} ${MACHINE_AUTH_CONTRACT.governanceProposeScope}`,
    }), expect.anything());
  });

  it('rejects proposal scope on an unprivileged machine identity', async () => {
    const { service } = serviceFor(credential());
    await expect(service.validateAccess({
      sub: identity.subject,
      companyId,
      client_id: identityId,
      credential_id: credentialId,
      scope: `${MACHINE_AUTH_CONTRACT.scope} ${MACHINE_AUTH_CONTRACT.governanceProposeScope}`,
      token_use: MACHINE_AUTH_CONTRACT.tokenUse,
      iss: MACHINE_AUTH_CONTRACT.issuer,
      aud: MACHINE_AUTH_CONTRACT.audience,
    })).rejects.toBeInstanceOf(UnauthorizedException);
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

  it('accepts only the dedicated deployment role for OIDC provisioning and records the federated authority', async () => {
    const createdCredential = credential();
    const tx = {
      machineIdentity: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(identity) },
      machineCredential: { create: jest.fn().mockResolvedValue(createdCredential) },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const prisma = { $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)) };
    const service = new MachineAuthService(prisma as never, { signAsync: jest.fn() } as never);
    const result = await service.provision(identity.subject, 1, {
      userId: 'github-actions-oidc',
      companyId,
      roles: ['DEPLOYMENT_PROVISIONER'],
      requestId: '50000000-0000-4000-8000-000000000001',
      correlationId: '60000000-0000-4000-8000-000000000001',
      actorType: 'GitHubActionsOIDC',
      actorSubject: 'repo:adrianmuscalu2-ai/agm-cockpit:environment:Production',
      actorMetadata: { sha: 'a'.repeat(40), runId: '33773656386' },
    });

    expect(result).toMatchObject({ clientId: identityId, companyId, subject: identity.subject });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorType: 'GitHubActionsOIDC',
      actorUserId: undefined,
      metadata: expect.objectContaining({
        provisioningAuthority: expect.objectContaining({
          type: 'GitHubActionsOIDC',
          sha: 'a'.repeat(40),
          runId: '33773656386',
        }),
      }),
    }) });
    expect(JSON.stringify(tx.auditEvent.create.mock.calls)).not.toContain(result.clientSecret);
  });

  it('rejects a deployment role presented outside the OIDC boundary', async () => {
    const { service } = serviceFor(null);
    await expect(service.provision('reader', 1, {
      userId: 'attacker',
      companyId,
      roles: ['DEPLOYMENT_PROVISIONER'],
      requestId: '',
      correlationId: '',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
