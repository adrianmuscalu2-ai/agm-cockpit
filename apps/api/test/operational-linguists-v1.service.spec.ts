import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL,
  OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
  validateOperationalLinguistV1Evidence,
  type OperationalLinguistV1Evidence,
} from '@agm/shared';
import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { OperationalLinguistsV1Service } from '../src/operational-linguists-v1/operational-linguists-v1.service';
import type { OperationalLinguistV1Actor } from '../src/operational-linguists-v1/operational-linguists-v1.contract';
import { createHash } from 'node:crypto';

const companyId = '00000000-0000-0000-0000-000000000001';
const registrationId = '11111111-1111-4111-8111-111111111111';
const now = new Date('2026-09-23T12:00:00.000Z');

function actor(role = 'DEPLOYMENT_PROVISIONER'): OperationalLinguistV1Actor {
  return {
    companyId,
    userId: 'github-actions-oidc',
    roles: [role],
    requestId: 'request',
    correlationId: 'correlation',
    actorType: 'GitHubActionsOIDC',
    actorSubject: 'trusted-workflow',
    actorMetadata: {
      sha: 'a'.repeat(40),
      workflowRef: role === 'DEPLOYMENT_PROVISIONER' ? 'production-release.yml@canonical' : 'continuity.yml@canonical',
      runId: role === 'DEPLOYMENT_PROVISIONER' ? '100' : '200',
      runAttempt: '1',
    },
  };
}

function evidence(language: 'it' | 'es' | 'sv', registration = registrationId, epoch = 1, sequence = 1): OperationalLinguistV1Evidence {
  const definition = createCanonicalOperationalLinguist(language);
  return {
    schemaVersion: definition.schemaVersion,
    baselineVersion: definition.baselineVersion,
    baselineDigest: definition.baselineDigest,
    componentId: definition.componentId,
    language,
    operationalState: 'ONLINE',
    observedAt: now.toISOString(),
    publisher: { registrationId: registration, authorityEpoch: epoch, sequence },
    resources: { contractVersion: definition.resourceContractVersion, contractDigest: definition.resourceContractDigest, catalogDigest: definition.resourceCatalogDigest, ...definition.resourceCounts },
    errors: { count: 0, codes: [] },
  };
}

describe('Operational Linguistic Baseline V1 validator', () => {
  it('binds the exported baseline digest to the exact canonical baseline representation', () => {
    expect(OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST).toBe(`sha256:${createHash('sha256').update(OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL).digest('hex')}`);
  });
  it('accepts only the canonical typed factory output', () => {
    for (const language of OPERATIONAL_LINGUIST_V1_LANGUAGES) expect(validateOperationalLinguistV1Evidence(evidence(language)).valid).toBe(true);
  });

  it.each([
    ['missing contract', (value: any) => { delete value.resources.contractVersion; }],
    ['missing contract digest', (value: any) => { delete value.resources.contractDigest; }],
    ['wrong contract', (value: any) => { value.resources.contractVersion = 'legacy'; }],
    ['wrong digest', (value: any) => { value.resources.contractDigest = 'sha256:wrong'; }],
    ['wrong catalog digest', (value: any) => { value.resources.catalogDigest = 'sha256:wrong'; }],
    ['missing baseline digest', (value: any) => { delete value.baselineDigest; }],
    ['wrong baseline digest', (value: any) => { value.baselineDigest = 'sha256:wrong'; }],
    ['incompatible schema', (value: any) => { value.schemaVersion = 'legacy.v0'; }],
    ['legacy payload', (value: any) => { Object.keys(value).forEach((key) => delete value[key]); Object.assign(value, { status: 'ONLINE', detail: 'legacy' }); }],
    ['unknown component', (value: any) => { value.componentId = 'premium-linguist-fr'; }],
    ['identity language mismatch', (value: any) => { value.componentId = 'premium-linguist-es'; }],
    ['wrong count', (value: any) => { value.resources.app -= 1; value.resources.total -= 1; }],
    ['inconsistent total', (value: any) => { value.resources.total -= 1; }],
    ['errors', (value: any) => { value.errors = { count: 1, codes: ['CATALOG_FAILURE'] }; }],
    ['unknown property', (value: any) => { value.journalStatus = 'PERSISTED'; }],
    ['publisher impersonation field', (value: any) => { value.publisher.writerVersion = 'current'; }],
  ])('rejects %s', (_name, mutate) => {
    const value: any = structuredClone(evidence('it'));
    mutate(value);
    expect(validateOperationalLinguistV1Evidence(value).valid).toBe(false);
  });
});

describe('OperationalLinguistsV1Service state integrity', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(now));
  afterEach(() => jest.useRealTimers());

  it('activates IT ES SV atomically and survives a service restart from typed persistence', async () => {
    const harness = memoryHarness();
    const service = new OperationalLinguistsV1Service(harness.prisma as never);
    const registered = await service.registerPublisher(actor());
    const batch = OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => evidence(language, registered.registrationId, registered.authorityEpoch));
    const result = await service.activate({ evidence: batch }, actor());

    expect(result).toMatchObject({ status: 'ACTIVE' });
    expect(result.components).toHaveLength(3);
    expect(harness.db.states.size).toBe(3);
    expect(harness.db.evidence.size).toBe(3);
    expect(harness.db.receipts.size).toBe(3);

    const restarted = new OperationalLinguistsV1Service(harness.prisma as never);
    const state = await restarted.state(companyId, now);
    expect(state.status).toBe('ACTIVE');
    expect(state.components).toHaveLength(3);
    expect(state.components.every((component: any) => component.current)).toBe(true);
  });

  it('rejects an incomplete or duplicate activation batch before any persistence', async () => {
    const harness = memoryHarness();
    const service = new OperationalLinguistsV1Service(harness.prisma as never);
    const registered = await service.registerPublisher(actor());
    const one = evidence('it', registered.registrationId, registered.authorityEpoch);
    const before = snapshot(harness.db);
    await expect(service.activate({ evidence: [one] }, actor())).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.activate({ evidence: [one, one, evidence('sv', registered.registrationId, registered.authorityEpoch)] }, actor())).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(snapshot(harness.db)).toEqual(before);
  });

  it.each([
    ['missing contract', (value: any) => { delete value.resources.contractVersion; }],
    ['missing contract digest', (value: any) => { delete value.resources.contractDigest; }],
    ['missing catalog digest', (value: any) => { delete value.resources.catalogDigest; }],
    ['wrong contract', (value: any) => { value.resources.contractVersion = 'legacy'; }],
    ['wrong catalog digest', (value: any) => { value.resources.catalogDigest = 'sha256:wrong'; }],
    ['missing baseline digest', (value: any) => { delete value.baselineDigest; }],
    ['wrong baseline digest', (value: any) => { value.baselineDigest = 'sha256:wrong'; }],
    ['incompatible schema', (value: any) => { value.schemaVersion = 'legacy.v0'; }],
    ['legacy payload', (value: any) => { Object.keys(value).forEach((key) => delete value[key]); Object.assign(value, { status: 'ONLINE', detail: 'legacy' }); }],
    ['unknown component', (value: any) => { value.componentId = 'premium-linguist-fr'; }],
    ['identity language mismatch', (value: any) => { value.componentId = 'premium-linguist-es'; }],
    ['wrong count', (value: any) => { value.resources.app -= 1; value.resources.total -= 1; }],
    ['inconsistent total', (value: any) => { value.resources.total -= 1; }],
    ['non-zero errors', (value: any) => { value.errors = { count: 1, codes: ['CATALOG_FAILURE'] }; }],
    ['stale observedAt', (value: any) => { value.observedAt = new Date(now.getTime() - 16 * 60_000).toISOString(); }],
    ['future observedAt', (value: any) => { value.observedAt = new Date(now.getTime() + 61_000).toISOString(); }],
    ['unknown property', (value: any) => { value.legacy = true; }],
    ['publisher impersonation field', (value: any) => { value.publisher.writerVersion = 'current'; }],
    ['wrong digest', (value: any) => { value.resources.contractDigest = 'sha256:wrong'; }],
  ])('rejects %s before state mutation', async (_name, mutate) => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const publisher = await harness.service.registerPublisher(continuity);
    const value: any = evidence('it', publisher.registrationId, publisher.authorityEpoch);
    mutate(value);
    const before = snapshot(harness.db);
    await expect(harness.service.heartbeat(value, continuity)).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(snapshot(harness.db)).toEqual(before);
  });

  it('keeps one invalid agent isolated while the other two refresh on the current epoch', async () => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const publisher = await harness.service.registerPublisher(continuity);
    const beforeEs = structuredClone(harness.db.states.get('premium-linguist-es'));
    await harness.service.heartbeat(evidence('it', publisher.registrationId, publisher.authorityEpoch), continuity);
    const invalidEs: any = evidence('es', publisher.registrationId, publisher.authorityEpoch);
    invalidEs.resources.contractDigest = 'sha256:wrong';
    await expect(harness.service.heartbeat(invalidEs, continuity)).rejects.toBeInstanceOf(UnprocessableEntityException);
    await harness.service.heartbeat(evidence('sv', publisher.registrationId, publisher.authorityEpoch), continuity);
    expect(harness.db.states.get('premium-linguist-it').authorityEpoch).toBe(publisher.authorityEpoch);
    expect(harness.db.states.get('premium-linguist-sv').authorityEpoch).toBe(publisher.authorityEpoch);
    expect(harness.db.states.get('premium-linguist-es')).toEqual(beforeEs);
  });

  it('makes same-hash duplicates idempotent and rejects same-sequence different-hash races', async () => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const publisher = await harness.service.registerPublisher(continuity);
    const item = evidence('it', publisher.registrationId, publisher.authorityEpoch);
    const first = await harness.service.heartbeat(item, continuity);
    const duplicate = await harness.service.heartbeat(structuredClone(item), continuity);
    expect(first.idempotent).toBe(false);
    expect(duplicate).toMatchObject({ idempotent: true, revision: first.revision });
    const conflict = structuredClone(item);
    conflict.observedAt = new Date(now.getTime() + 1_000).toISOString();
    const before = snapshot(harness.db);
    await expect(harness.service.heartbeat(conflict, continuity)).rejects.toBeInstanceOf(ConflictException);
    expect(snapshot(harness.db)).toEqual(before);
  });

  it('rejects a missing, wrong-scope, revoked, or expired operational mandate before persistence', async () => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const publisher = await harness.service.registerPublisher(continuity);
    harness.db.mandates.set('premium-linguist-it', null);
    const before = snapshot(harness.db);
    await expect(harness.service.heartbeat(evidence('it', publisher.registrationId, publisher.authorityEpoch), continuity)).rejects.toBeInstanceOf(ForbiddenException);
    expect(snapshot(harness.db)).toEqual(before);
  });

  it('rejects old epochs, revoked or expired publishers, and unauthorized roles without state mutation', async () => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const oldPublisher = await harness.service.registerPublisher(continuity);
    const oldRequest = evidence('it', oldPublisher.registrationId, oldPublisher.authorityEpoch);
    const currentPublisher = await harness.service.registerPublisher(continuity);
    const before = snapshot(harness.db);
    await expect(harness.service.heartbeat(oldRequest, continuity)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(harness.service.registerPublisher(actor('UNTRUSTED'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(snapshot(harness.db)).toEqual(before);

    harness.db.publishers.get(currentPublisher.registrationId).expiresAt = new Date(now.getTime() - 1);
    const beforeExpired = snapshot(harness.db);
    await expect(harness.service.heartbeat(evidence('it', currentPublisher.registrationId, currentPublisher.authorityEpoch), continuity)).rejects.toBeInstanceOf(ForbiddenException);
    expect(snapshot(harness.db)).toEqual(beforeExpired);
  });

  it('rejects unregistered publishers and verified-actor provenance mismatches without state mutation', async () => {
    const harness = await activeHarness();
    const continuity = actor('AGENT_RUNTIME_CONTINUITY');
    const publisher = await harness.service.registerPublisher(continuity);
    const before = snapshot(harness.db);
    await expect(harness.service.heartbeat(evidence('it', '99999999-9999-4999-8999-999999999999', publisher.authorityEpoch), continuity)).rejects.toBeInstanceOf(ForbiddenException);
    const mismatchedActor = actor('AGENT_RUNTIME_CONTINUITY');
    mismatchedActor.actorMetadata.runId = 'different-verified-run';
    await expect(harness.service.heartbeat(evidence('it', publisher.registrationId, publisher.authorityEpoch), mismatchedActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(snapshot(harness.db)).toEqual(before);
  });
});

async function activeHarness() {
  const harness = memoryHarness();
  const service = new OperationalLinguistsV1Service(harness.prisma as never);
  const deployment = actor();
  const registered = await service.registerPublisher(deployment);
  await service.activate({ evidence: OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => evidence(language, registered.registrationId, registered.authorityEpoch)) }, deployment);
  return { ...harness, service };
}

function memoryHarness() {
  const db: any = {
    baseline: null, publishers: new Map(), states: new Map(), evidence: new Map(), receipts: new Map(), next: 1,
    mandates: new Map(OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => {
      const definition = createCanonicalOperationalLinguist(language);
      return [definition.componentId, { id: `${language.repeat(8)}-${language.repeat(4)}-4${language.repeat(3).slice(0, 3)}-8${language.repeat(3).slice(0, 3)}-${language.repeat(12).slice(0, 12)}`, version: 1, scopeId: definition.authorityScope }];
    })),
  };
  const id = (prefix: string) => `${prefix}-${db.next++}`;
  const tx: any = {
    $queryRaw: jest.fn(async () => [{ pg_advisory_xact_lock: null }]),
    operationalLinguistBaseline: {
      findUnique: jest.fn(async ({ where }: any) => where.id ? db.baseline?.id === where.id ? db.baseline : null : db.baseline),
      create: jest.fn(async ({ data }: any) => (db.baseline = { id: id('baseline'), authorityEpoch: 0, activatedAt: null, createdAt: now, updatedAt: now, ...data })),
      update: jest.fn(async ({ data }: any) => (db.baseline = { ...db.baseline, ...data, updatedAt: now })),
    },
    operationalLinguistPublisher: {
      updateMany: jest.fn(async ({ where, data }: any) => { let count = 0; for (const [key, value] of db.publishers) if (value.baselineId === where.baselineId && value.revokedAt === null) { db.publishers.set(key, { ...value, ...data }); count += 1; } return { count }; }),
      create: jest.fn(async ({ data }: any) => { const value = { id: db.publishers.size === 0 ? registrationId : `22222222-2222-4222-8222-${String(db.publishers.size).padStart(12, '2')}`, revokedAt: null, ...data }; db.publishers.set(value.id, value); return value; }),
      findUnique: jest.fn(async ({ where }: any) => db.publishers.get(where.id) ?? null),
    },
    operationalLinguistState: {
      findUnique: jest.fn(async ({ where }: any) => db.states.get(where.companyId_componentId.componentId) ?? null),
      findMany: jest.fn(async () => [...db.states.values()].sort((left, right) => left.componentId.localeCompare(right.componentId)).map((state: any) => {
        const currentEvidence = db.evidence.get(state.currentEvidenceId);
        return { ...state, currentEvidence: { ...currentEvidence, publisher: db.publishers.get(currentEvidence.publisherId) } };
      })),
      upsert: jest.fn(async ({ where, create, update }: any) => { const key = where.companyId_componentId.componentId; const previous = db.states.get(key); const value = previous ? { ...previous, ...update, revision: previous.revision + 1, updatedAt: now } : { id: id('state'), revision: 1, updatedAt: now, ...create }; db.states.set(key, value); return value; }),
    },
    operationalLinguistEvidence: {
      create: jest.fn(async ({ data }: any) => { const value = { id: id('evidence'), ...data }; db.evidence.set(value.id, value); return value; }),
      findUnique: jest.fn(async ({ where }: any) => [...db.evidence.values()].find((value: any) => value.publisherId === where.publisherId_componentId_sequence.publisherId && value.componentId === where.publisherId_componentId_sequence.componentId && value.sequence === where.publisherId_componentId_sequence.sequence) ?? null),
    },
    operationalLinguistReceipt: {
      create: jest.fn(async ({ data }: any) => { const value = { id: id('receipt'), ...data }; db.receipts.set(value.evidenceId, value); return value; }),
      findUnique: jest.fn(async ({ where }: any) => db.receipts.get(where.evidenceId) ?? null),
    },
    authorityMandate: {
      findFirst: jest.fn(async ({ where }: any) => {
        const mandate = db.mandates.get(where.agentId);
        return mandate?.scopeId === where.scopeId ? mandate : null;
      }),
    },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)) };
  return { db, prisma };
}

function snapshot(db: any) {
  return {
    baseline: structuredClone(db.baseline),
    publishers: structuredClone([...db.publishers]),
    states: structuredClone([...db.states]),
    evidence: structuredClone([...db.evidence]),
    receipts: structuredClone([...db.receipts]),
    mandates: structuredClone([...db.mandates]),
  };
}
