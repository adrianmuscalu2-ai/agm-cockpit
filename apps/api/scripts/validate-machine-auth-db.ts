import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MACHINE_AUTH_CONTRACT, type MachineJwtPayload } from '../src/machine-auth/machine-auth.contract';
import { MachineAuthService } from '../src/machine-auth/machine-auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  ConfigModule.forRoot({ envFilePath: ['.env', '../../.env'] });
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('Canonical DB/JWT environment is unavailable.');
  const companyId = randomUUID();
  const ownerId = randomUUID();
  const prisma = new PrismaService(new ConfigService({ PRISMA_CONNECT_ON_BOOT: 'false' }));
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const service = new MachineAuthService(prisma, jwt);
  const mark = (stage: string) => process.stdout.write(`M2M_DB_STAGE=${stage}\n`);
  mark('connect');
  await prisma.$connect();

  try {
    mark('fixture-create');
    await prisma.company.create({ data: {
      id: companyId,
      companyName: 'M2M validation fixture',
      countryCode: 'DE',
      defaultCurrencyCode: 'EUR',
    } });
    const ctx = { userId: ownerId, companyId, roles: ['OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
    mark('provision');
    const provisioned = await service.provision(`validation-${randomUUID()}`, 1, ctx);
    mark('hash-verify');
    const stored = await prisma.machineCredential.findUniqueOrThrow({ where: { id: provisioned.credentialId } });
    assert.notEqual(stored.secretHash, provisioned.clientSecret);
    assert.equal(stored.secretHash, createHash('sha256').update(provisioned.clientSecret).digest('hex'));

    mark('issue');
    const issued = await service.issueToken(provisioned.clientId, provisioned.clientSecret);
    const payload = await jwt.verifyAsync<MachineJwtPayload>(issued.access_token, {
      issuer: MACHINE_AUTH_CONTRACT.issuer,
      audience: MACHINE_AUTH_CONTRACT.audience,
    });
    assert.equal(payload.sub, provisioned.subject);
    assert.equal(payload.companyId, companyId);
    assert.equal(payload.scope, MACHINE_AUTH_CONTRACT.scope);
    mark('use');
    await service.validateAccess(payload);
    assert.ok((await prisma.machineCredential.findUniqueOrThrow({ where: { id: provisioned.credentialId } })).lastUsedAt);

    mark('rotate');
    const rotated = await service.rotate(provisioned.clientId, 1, { ...ctx, requestId: randomUUID(), correlationId: randomUUID() });
    assert.equal((await prisma.machineCredential.findUniqueOrThrow({ where: { id: provisioned.credentialId } })).revokedAt instanceof Date, true);
    await assert.rejects(service.issueToken(provisioned.clientId, provisioned.clientSecret));
    await service.issueToken(rotated.clientId, rotated.clientSecret);

    mark('revoke');
    await service.revoke(rotated.clientId, rotated.credentialId, 'DB validation completed.', { ...ctx, requestId: randomUUID(), correlationId: randomUUID() });
    await assert.rejects(service.issueToken(rotated.clientId, rotated.clientSecret));
    await service.revokeIdentity(rotated.clientId, 'DB validation identity cleanup.', { ...ctx, requestId: randomUUID(), correlationId: randomUUID() });

    mark('audit-verify');
    const auditActions = await prisma.auditEvent.findMany({ where: { companyId }, select: { actionCode: true, metadata: true } });
    for (const action of ['M2M_IDENTITY_PROVISIONED', 'M2M_TOKEN_ISSUED', 'M2M_CREDENTIAL_USED', 'M2M_CREDENTIAL_ROTATED', 'M2M_CREDENTIAL_REVOKED', 'M2M_IDENTITY_REVOKED']) {
      assert.ok(auditActions.some((event) => event.actionCode === action), `Missing audit action ${action}`);
    }
    assert.ok(!JSON.stringify(auditActions).includes(provisioned.clientSecret));
    assert.ok(!JSON.stringify(auditActions).includes(rotated.clientSecret));

    process.stdout.write(`${JSON.stringify({
      contract: MACHINE_AUTH_CONTRACT.version,
      status: 'PASS',
      lifecycle: ['provisioning', 'issuance', 'usage', 'rotation', 'revocation'],
      auditActions: [...new Set(auditActions.map((event) => event.actionCode))].sort(),
      secretPersisted: false,
    })}\n`);
  } finally {
    mark('cleanup');
    await prisma.auditEvent.deleteMany({ where: { companyId } });
    await prisma.machineIdentity.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
    mark('done');
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
