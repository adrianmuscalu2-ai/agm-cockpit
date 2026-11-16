import 'reflect-metadata';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MachineAuthService } from '../src/machine-auth/machine-auth.service';
import { inspectCredentialReadiness, CREDENTIAL_SUBJECTS } from '../src/authority-control-plane/credential-readiness';
import { MACHINE_AUTH_CONTRACT, type MachineJwtPayload } from '../src/machine-auth/machine-auth.contract';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55432'); assert.equal(url.pathname, '/agm_cockpit_191_rehearsal');
  const db = new PrismaClient(), independent = new PrismaClient();
  try {
    const company = await db.company.create({ data: { companyName: 'ROTATION_V3_CONTROLLED_FIXTURE_RETAINED', countryCode: 'RO', defaultCurrencyCode: 'EUR' } });
    const ctx = { companyId: company.id, userId: randomUUID(), roles: ['OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
    const jwt = new JwtService({ secret: randomBytes(48).toString('hex') });
    const service = new MachineAuthService(db as never, jwt);
    const originals = [];
    for (const subject of CREDENTIAL_SUBJECTS) {
      const issued = await service.provision(subject, 1, ctx);
      const initial = await service.issueToken(issued.clientId, issued.clientSecret);
      const initialClaims = await jwt.verifyAsync<MachineJwtPayload>(initial.access_token, { issuer: MACHINE_AUTH_CONTRACT.issuer, audience: MACHINE_AUTH_CONTRACT.audience });
      await service.validateAccess(initialClaims);
      originals.push(issued);
    }
    const check = () => inspectCredentialReadiness(db as never, ctx);
    assert.equal((await check()).passed, true);
    const target = originals[0];
    // Only the newly labelled local fixture is manipulated to simulate ageing.
    await db.machineCredential.update({ where: { id: target.credentialId }, data: { expiresAt: new Date(Date.now() + 8 * 3600000) } });
    assert.equal((await check()).observations[0].state, 'EXPIRING');
    await db.machineCredential.update({ where: { id: target.credentialId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await check()).observations[0].state, 'EXPIRED');
    await assert.rejects(service.issueToken(target.clientId, target.clientSecret));
    const before = await independent.authorityAuditJournal.count({ where: { companyId: company.id } });
    await Promise.all([check(), check()]);
    assert.equal(await independent.authorityAuditJournal.count({ where: { companyId: company.id } }), before);
    const next = await service.rotate(target.clientId, 1, ctx);
    assert.equal((await check()).observations[0].state, 'UNVERIFIED');
    await assert.rejects(service.issueToken(target.clientId, target.clientSecret));
    const token = await service.issueToken(next.clientId, next.clientSecret);
    const claims = await jwt.verifyAsync<MachineJwtPayload>(token.access_token, { issuer: MACHINE_AUTH_CONTRACT.issuer, audience: MACHINE_AUTH_CONTRACT.audience });
    assert.equal((await service.validateAccess(claims)).subject, CREDENTIAL_SUBJECTS[0]);
    assert.equal((await check()).passed, true);
    const rows = await independent.authorityAuditJournal.findMany({ where: { companyId: company.id }, orderBy: { occurredAt: 'asc' } });
    assert(rows.some(x => x.eventType === 'M2M_CREDENTIAL_EXPIRY_WARNING'));
    assert(rows.some(x => x.eventType === 'M2M_CREDENTIAL_ESCALATED'));
    assert(rows.some(x => x.eventType === 'M2M_CREDENTIAL_RECOVERED'));
    const credentials = await independent.machineCredential.findMany({ where: { identityId: target.clientId }, orderBy: { version: 'asc' }, select: { version: true, revokedAt: true, lastUsedAt: true } });
    assert.equal(credentials.length, 2); assert(credentials[0].revokedAt); assert(credentials[1].lastUsedAt);
    const result = { at: new Date().toISOString(), verdict: 'PASS', scope: 'REAL_REHEARSAL_POSTGRES_CANONICAL_SERVICE_AND_JWT_NOT_PRODUCTION', fixtureCompany: company.id,
      warning: true, expiredCredentialDenied: true, canonicalRotation: true, oldCredentialDenied: true, newCredentialAuthenticated: true,
      concurrentObservationDeduplicated: true, recovery: true, credentialsRetained: credentials.length,
      journal: rows.map(r => ({ eventId: r.eventId, eventType: r.eventType, payloadHash: r.payloadHash })), secretsExported: false, fixtureRetained: true };
    writeFileSync(join(process.env.FUNCTIONAL_EVIDENCE_DIR!, 'real-rotation-postgres.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); await independent.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
