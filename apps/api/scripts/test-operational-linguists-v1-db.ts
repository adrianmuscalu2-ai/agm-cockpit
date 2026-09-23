import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
  type OperationalLinguistV1Evidence,
} from '@agm/shared';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';
import { OperationalLinguistsV1Service } from '../src/operational-linguists-v1/operational-linguists-v1.service';
import type { OperationalLinguistV1Actor } from '../src/operational-linguists-v1/operational-linguists-v1.contract';

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/^postgresql:\/\/[^@]+@(?:127\.0\.0\.1|localhost):\d+\//.test(databaseUrl)) throw new Error('This destructive fixture is restricted to an isolated loopback PostgreSQL database.');

const companyId = '00000000-0000-0000-0000-000000000001';
const approvedByUserId = '10000000-0000-4000-8000-000000000001';
const prisma = new PrismaClient();
const service = new OperationalLinguistsV1Service(prisma as never);

function actor(role: 'DEPLOYMENT_PROVISIONER' | 'AGENT_RUNTIME_CONTINUITY', runId: string): OperationalLinguistV1Actor {
  return {
    companyId, userId: 'github-actions-oidc', roles: [role], requestId: `request-${runId}`, correlationId: `correlation-${runId}`,
    actorType: 'GitHubActionsOIDC', actorSubject: `trusted-${role.toLowerCase()}`,
    actorMetadata: { sha: 'a'.repeat(40), workflowRef: role === 'DEPLOYMENT_PROVISIONER' ? 'production-release.yml@canonical' : 'continuity.yml@canonical', runId, runAttempt: '1' },
  };
}

function evidence(language: 'it' | 'es' | 'sv', publisher: { registrationId: string; authorityEpoch: number }, sequence = 1, observedAt = new Date().toISOString()): OperationalLinguistV1Evidence {
  const definition = createCanonicalOperationalLinguist(language);
  return {
    schemaVersion: definition.schemaVersion, baselineVersion: definition.baselineVersion, baselineDigest: definition.baselineDigest,
    componentId: definition.componentId, language, operationalState: 'ONLINE', observedAt,
    publisher: { registrationId: publisher.registrationId, authorityEpoch: publisher.authorityEpoch, sequence },
    resources: { contractVersion: definition.resourceContractVersion, contractDigest: definition.resourceContractDigest, catalogDigest: definition.resourceCatalogDigest, ...definition.resourceCounts },
    errors: { count: 0, codes: [] },
  };
}

async function main() {
  await prisma.company.create({ data: { id: companyId, companyName: 'AGM Plan C isolated test', countryCode: 'DE', defaultCurrencyCode: 'EUR' } });
  for (const language of OPERATIONAL_LINGUIST_V1_LANGUAGES) {
    const definition = createCanonicalOperationalLinguist(language);
    await prisma.authorityMandate.create({ data: {
      companyId, mandateKey: `plan-c-${language}`, scopeId: definition.authorityScope, agentId: definition.componentId,
      mode: 'READ_ONLY', status: 'APPROVED', contractHash: 'b'.repeat(64), readSet: ['i18n.catalog.read'], writeSet: [],
      resourceSelectors: [definition.componentId], prohibitedActions: ['dictionary.write'], approvedByUserId,
    } });
  }

  const deployment = actor('DEPLOYMENT_PROVISIONER', '100');
  const activationPublisher = await service.registerPublisher(deployment);
  const activation = await service.activate({ evidence: OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => evidence(language, activationPublisher)) }, deployment);
  assert.equal(activation.status, 'ACTIVE');
  assert.equal(activation.components.length, 3);
  assert.equal(await prisma.operationalLinguistEvidence.count({ where: { companyId } }), 3);
  assert.equal(await prisma.operationalLinguistState.count({ where: { companyId } }), 3);
  assert.equal(await prisma.operationalLinguistReceipt.count({ where: { companyId } }), 3);
  const immutableEvidence = await prisma.operationalLinguistEvidence.findFirstOrThrow({ where: { companyId } });
  await assert.rejects(prisma.operationalLinguistEvidence.update({ where: { id: immutableEvidence.id }, data: { observedAt: new Date() } }), /OPERATIONAL_LINGUIST_V1_APPEND_ONLY/);

  await assert.rejects(prisma.componentHeartbeat.create({ data: { companyId, componentId: 'premium-linguist-it', reportedStatus: 'ONLINE', lastSeenAt: new Date(), lastDetail: 'legacy' } }), /LEGACY_OPERATIONAL_LINGUIST_HEARTBEAT_FENCED/);
  assert.equal(await prisma.componentHeartbeat.count({ where: { companyId, componentId: { in: ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv'] } } }), 0);

  const continuity = actor('AGENT_RUNTIME_CONTINUITY', '200');
  const publisher = await service.registerPublisher(continuity);
  await Promise.all(OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => service.heartbeat(evidence(language, publisher), continuity)));
  const canonicalIt = evidence('it', publisher, 2);
  const invalidIt: any = structuredClone(canonicalIt);
  invalidIt.resources.contractDigest = 'sha256:wrong';
  const concurrent = await Promise.allSettled([service.heartbeat(canonicalIt, continuity), service.heartbeat(invalidIt, continuity)]);
  assert.equal(concurrent.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((result) => result.status === 'rejected').length, 1);
  const idempotent = await service.heartbeat(structuredClone(canonicalIt), continuity);
  assert.equal(idempotent.idempotent, true);
  const conflict = structuredClone(canonicalIt);
  conflict.observedAt = new Date(Date.now() + 1_000).toISOString();
  await assert.rejects(service.heartbeat(conflict, continuity), /OPERATIONAL_LINGUIST_V1_SEQUENCE_HASH_CONFLICT/);

  const esBefore = await prisma.operationalLinguistState.findUniqueOrThrow({ where: { companyId_componentId: { companyId, componentId: 'premium-linguist-es' } } });
  const invalidEs: any = evidence('es', publisher, 2);
  invalidEs.resources.total -= 1;
  await assert.rejects(service.heartbeat(invalidEs, continuity));
  const esAfter = await prisma.operationalLinguistState.findUniqueOrThrow({ where: { companyId_componentId: { companyId, componentId: 'premium-linguist-es' } } });
  assert.deepEqual(esAfter, esBefore);

  const lateOldEpoch = evidence('sv', publisher, 2);
  const nextActor = actor('AGENT_RUNTIME_CONTINUITY', '201');
  const nextPublisher = await service.registerPublisher(nextActor);
  await assert.rejects(service.heartbeat(lateOldEpoch, continuity));
  await Promise.all([service.heartbeat(evidence('it', nextPublisher), nextActor), service.heartbeat(evidence('sv', nextPublisher), nextActor)]);
  const faultIsolated = await service.state(companyId);
  assert.equal(faultIsolated.components.find((item) => item.language === 'it')?.authorityEpoch, nextPublisher.authorityEpoch);
  assert.equal(faultIsolated.components.find((item) => item.language === 'sv')?.authorityEpoch, nextPublisher.authorityEpoch);
  assert.equal(faultIsolated.components.find((item) => item.language === 'es')?.authorityEpoch, publisher.authorityEpoch);

  const restartedPrisma = new PrismaClient();
  const restartedService = new OperationalLinguistsV1Service(restartedPrisma as never);
  const afterRestart = await restartedService.state(companyId);
  assert.equal(afterRestart.status, 'ACTIVE');
  assert.equal(afterRestart.components.length, 3);
  assert.ok(afterRestart.components.every((item) => item.current));
  await restartedPrisma.$disconnect();

  const evidenceCount = await prisma.operationalLinguistEvidence.count({ where: { companyId } });
  assert.ok(evidenceCount > 3);
  console.log(JSON.stringify({
    status: 'PASS', activation: '3/3 ATOMIC', typedPersistence: 'PASS', appendOnlyEvidence: `${evidenceCount} immutable records`,
    legacyFence: 'PASS', invalidStateMutation: 'NONE', concurrentPublication: 'PASS', idempotency: 'PASS',
    sequenceHashConflict: 'REJECTED', staleEpoch: 'REJECTED', restartRecovery: 'PASS', faultIsolation: 'PASS',
  }, null, 2));
}

void main().finally(() => prisma.$disconnect());
