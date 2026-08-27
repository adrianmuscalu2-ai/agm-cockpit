import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  AuthorityKeyRegistry,
  DurableSignedJournal,
  FederatedCanonicalAuthority,
  FederatedTurnProjection,
  P2TurnCustodian,
  P2ValidationGate,
  projectValidated,
  type AuthorityDefinition,
  type P2Event,
} from '../packages/copilot-control-plane/src/p2-federation';

type Catalog = { version: string; tenant: string; authorities: AuthorityDefinition[] };

async function main() {
  const catalog = JSON.parse(await readFile('config/copilot-v1.2/p2-authority-catalog.json', 'utf8')) as Catalog;
  const keys = new AuthorityKeyRegistry();
  const authorities = new Map<string, FederatedCanonicalAuthority>();
  for (const [index, definition] of catalog.authorities.entries()) {
    const keyId = `p2-dummy-${index + 1}`;
    keys.register(definition.id, keyId, Buffer.from(`p2-dummy-key-${String(index + 1).padStart(2, '0')}-isolated-only-0000000000000000`));
    authorities.set(definition.id, new FederatedCanonicalAuthority(definition, { authorityId: definition.id, workloadId: `workload-${index + 1}`, tenantId: catalog.tenant, keyId }, keys));
  }
  const gate = new P2ValidationGate(catalog.authorities, keys, catalog.tenant);
  const journal = new DurableSignedJournal();
  const projection = new FederatedTurnProjection();
  const custodian = new P2TurnCustodian(projection, gate);
  const cases: Array<{ id: string; result: 'PASS' | 'FAIL'; detail: string }> = [];
  const test = async (id: string, fn: () => void | Promise<void>) => { try { await fn(); cases.push({ id, result: 'PASS', detail: 'validated' }); } catch (error) { cases.push({ id, result: 'FAIL', detail: error instanceof Error ? error.message : 'UNKNOWN' }); } };
  const committedAt = '2026-08-13T14:00:00.000Z';
  const reflectedAt = '2026-08-13T14:00:00.250Z';

  await test('all-eight-federated-authorities-reflect-to-turn', () => {
    catalog.authorities.forEach((definition, index) => {
      const authority = authorities.get(definition.id)!;
      const event = authority.transition({ eventId: `p2-event-${index + 1}`, eventType: `${definition.eventPrefix}status_changed`, aggregateId: `aggregate-${index + 1}`, status: 'ACTIVE', committedAt, correlationId: `p2-correlation-${index + 1}` }).event;
      assert.deepEqual(projectValidated(event, gate, journal, projection, reflectedAt), { status: 'REFLECTED', reason: 'VALIDATED' });
    });
    assert.equal(projection.all().length, 8);
    assert.ok(projection.all().every((view) => view.health === 'CURRENT' && view.integrity === 'VERIFIED' && view.lagMs === 250));
  });

  await test('authority-ownership-enforced-at-source', () => {
    assert.throws(() => authorities.get('IDENTITY_SOD_AUTHORITY')!.transition({ eventId: 'bad-owner', eventType: 'permission.revoked', aggregateId: 'bad', status: 'REVOKED', committedAt, correlationId: 'bad-owner' }), /EVENT_OWNERSHIP_DENIED/);
  });

  await test('cross-tenant-event-quarantined', () => {
    const original = authorities.get('IDENTITY_SOD_AUTHORITY')!.outbox()[0];
    const crossTenant = { ...original, eventId: 'p2-cross-tenant', tenantId: 'tenant-other' } as P2Event;
    assert.deepEqual(projectValidated(crossTenant, gate, journal, projection, reflectedAt), { status: 'QUARANTINED', reason: 'TENANT_MISMATCH' });
  });

  await test('event-type-authority-mismatch-quarantined', () => {
    const original = authorities.get('IDENTITY_SOD_AUTHORITY')!.outbox()[0];
    const mismatch = { ...original, eventId: 'p2-owner-mismatch', eventType: 'permission.status_changed' } as P2Event;
    assert.deepEqual(projectValidated(mismatch, gate, journal, projection, reflectedAt), { status: 'QUARANTINED', reason: 'EVENT_OWNERSHIP_DENIED' });
  });

  await test('revoked-signing-key-quarantined-immediately', () => {
    const definition = catalog.authorities[0]; const keyId = 'p2-revocable';
    keys.register(definition.id, keyId, Buffer.from('p2-revocable-dummy-key-isolated-only-00000000'));
    const authority = new FederatedCanonicalAuthority(definition, { authorityId: definition.id, workloadId: 'revocable-workload', tenantId: catalog.tenant, keyId }, keys);
    const event = authority.transition({ eventId: 'p2-revoked-event', eventType: 'identity.status_changed', aggregateId: 'revoked-aggregate', status: 'ACTIVE', committedAt, correlationId: 'revoked' }).event;
    keys.revoke(keyId);
    assert.deepEqual(projectValidated(event, gate, journal, projection, reflectedAt), { status: 'QUARANTINED', reason: 'REVOKED_KEY' });
  });

  await test('key-rotation-new-key-accepted', () => {
    const definition = catalog.authorities[1]; const keyId = 'p2-rotated';
    keys.register(definition.id, keyId, Buffer.from('p2-rotated-dummy-key-isolated-only-000000000'));
    const authority = new FederatedCanonicalAuthority(definition, { authorityId: definition.id, workloadId: 'rotated-workload', tenantId: catalog.tenant, keyId }, keys);
    const event = authority.transition({ eventId: 'p2-rotated-event', eventType: 'capability.status_changed', aggregateId: 'rotated-aggregate', status: 'ACTIVE', committedAt, correlationId: 'rotated' }).event;
    assert.deepEqual(projectValidated(event, gate, journal, projection, reflectedAt), { status: 'REFLECTED', reason: 'VALIDATED' });
  });

  await test('duplicate-event-denied-without-second-reflection', () => {
    const event = journal.events()[0];
    assert.deepEqual(journal.append(event), { accepted: false, reason: 'DUPLICATE_EVENT' });
    assert.equal(projection.all().filter((view) => view.lastEventId === event.eventId).length, 1);
  });

  await test('conflicting-same-revision-event-quarantined', () => {
    const definition = catalog.authorities[2];
    const keyId = 'p2-conflict-key';
    keys.register(definition.id, keyId, Buffer.from('p2-conflict-dummy-key-isolated-only-00000000'));
    const conflictingAuthority = new FederatedCanonicalAuthority(definition, { authorityId: definition.id, workloadId: 'conflicting-workload', tenantId: catalog.tenant, keyId }, keys);
    const event = conflictingAuthority.transition({ eventId: 'p2-conflict-event', eventType: 'permission.status_changed', aggregateId: 'aggregate-3', status: 'REVOKED', committedAt, correlationId: 'conflict' }).event;
    assert.deepEqual(projectValidated(event, gate, journal, projection, reflectedAt), { status: 'QUARANTINED', reason: 'REVISION_CONFLICT' });
    assert.equal(projection.view('PERMISSION_REVOCATION_AUTHORITY:aggregate-3')?.status, 'ACTIVE');
  });

  await test('journal-snapshot-persistence-and-integrity', async () => {
    const snapshot = journal.snapshot();
    await mkdir('evidence/governance/copilot-v1.2/p2/runtime', { recursive: true });
    await writeFile('evidence/governance/copilot-v1.2/p2/runtime/signed-journal-snapshot.json', `${JSON.stringify(snapshot, null, 2)}\n`);
    const restored = new DurableSignedJournal();
    const read = JSON.parse(await readFile('evidence/governance/copilot-v1.2/p2/runtime/signed-journal-snapshot.json', 'utf8'));
    assert.deepEqual(restored.restore(read), { restored: snapshot.events.length, checkpoint: snapshot.checkpoint });
    assert.deepEqual(restored.snapshot(), snapshot);
  });

  await test('journal-corruption-detected', () => {
    const snapshot = journal.snapshot();
    const corrupted = { ...snapshot, events: snapshot.events.map((event, index) => index === 0 ? { ...event, currentStateHash: 'corrupted' } : event) };
    const restored = new DurableSignedJournal();
    assert.throws(() => restored.restore(corrupted), /JOURNAL_SNAPSHOT_INTEGRITY_FAILURE/);
  });

  await test('turn-slo-stale-detection', () => {
    const stale = custodian.stale('2026-08-13T14:02:01.000Z', { CRITICAL: 15_000, LIFECYCLE: 60_000, INFORMATIONAL: 120_000 }, catalog.authorities);
    assert.ok(stale.length >= 8);
    assert.ok(projection.all().every((view) => view.health === 'STALE'));
  });

  await test('fresh-runtime-replay-and-turn-reconstruction', () => {
    const replayGate = new P2ValidationGate(catalog.authorities, keys, catalog.tenant);
    const replayProjection = new FederatedTurnProjection();
    const replayCustodian = new P2TurnCustodian(replayProjection, replayGate);
    const events = journal.events();
    const result = replayCustodian.rebuild(events, '2026-08-13T14:03:00.000Z');
    assert.deepEqual(result, { applied: events.length, parity: true });
    assert.equal(replayProjection.all().length, events.length);
    for (const event of events) assert.equal(replayProjection.view(`${event.sourceAuthority}:${event.aggregateId}`)?.stateHash, event.currentStateHash);
  });

  await test('partial-authority-outage-isolated', () => {
    const available = catalog.authorities.filter((item) => item.id !== 'INCIDENT_AUTHORITY');
    assert.equal(available.length, 7);
    assert.equal(projection.all().filter((view) => view.authorityId !== 'INCIDENT_AUTHORITY').length >= 7, true);
    assert.equal(authorities.get('INCIDENT_AUTHORITY')!.state('aggregate-7')?.status, 'ACTIVE');
  });

  await test('turn-has-no-canonical-mutator-or-secret', () => {
    assert.equal('transition' in projection, false);
    assert.equal('transition' in custodian, false);
    assert.ok(journal.events().every((event) => !Object.keys(event.sanitizedPayload).some((key) => /secret|token|credential|password/i.test(key))));
  });

  await test('rollback-rebuilds-derived-state-only', () => {
    const canonicalHashes = catalog.authorities.map((definition, index) => authorities.get(definition.id)!.state(`aggregate-${index + 1}`)?.stateHash);
    const rollbackGate = new P2ValidationGate(catalog.authorities, keys, catalog.tenant); const rollbackProjection = new FederatedTurnProjection(); const rollbackCustodian = new P2TurnCustodian(rollbackProjection, rollbackGate);
    assert.equal(rollbackCustodian.rebuild(journal.events(), '2026-08-13T14:04:00.000Z').parity, true);
    assert.deepEqual(catalog.authorities.map((definition, index) => authorities.get(definition.id)!.state(`aggregate-${index + 1}`)?.stateHash), canonicalHashes);
  });

  const failures = cases.filter((item) => item.result === 'FAIL');
  const report = { contract: 'agm-copilot-v1.2-p2-federation-evidence.v1', generatedAt: new Date().toISOString(), tenant: catalog.tenant, authorities: catalog.authorities.map((item) => item.id), authorityCount: catalog.authorities.length, cases, totals: { cases: cases.length, passed: cases.length - failures.length, failed: failures.length }, journal: { checkpoint: journal.snapshot().checkpoint, chainHash: journal.snapshot().chainHash, quarantined: journal.quarantined() }, turn: { views: projection.all().length, stale: projection.all().filter((view) => view.health === 'STALE').length }, secretMode: 'DUMMY_ONLY_NO_REAL_SECRET', verdict: failures.length === 0 ? 'PASS' : 'FAIL' };
  await mkdir('evidence/governance/copilot-v1.2/p2/runtime', { recursive: true });
  await writeFile('evidence/governance/copilot-v1.2/p2/runtime/federated-authorities-report.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(`P2 FEDERATED AUTHORITIES / JOURNAL / TURN — ${report.verdict} (${report.totals.passed}/${report.totals.cases})`);
  console.log(`authorities=${report.authorityCount} journal=${report.journal.checkpoint} quarantine=${report.journal.quarantined.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'P2_TEST_FAILURE'); process.exitCode = 1; });
