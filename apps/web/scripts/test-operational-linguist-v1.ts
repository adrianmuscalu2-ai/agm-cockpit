import {
  OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL,
  OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
} from '@agm/shared';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { deterministicOperationalLinguistAudit, createPublicationEvidence } from '../../../scripts/operational-linguists-v1-publisher';
import { assessOperationalLinguistV1QualityCandidate, operationalLinguistV1QualityCategories, operationalLinguistV1QualityFixtures } from '../src/premium-linguistic-agents/operational-linguist-v1.quality-fixtures';
import { premiumLinguisticAgents } from '../src/premium-linguistic-agents/premium-linguistic-agents.registry';
import { TurnAdminSessionError, turnAdminAuthenticatedFetch } from '../src/admin-auth';
import { observeOperationalLinguistV1 } from '../src/premium-linguistic-agents/operational-linguist-v1.observer';
import { recordRuntimeOperationSnapshot } from '../src/operations-health';

const first = deterministicOperationalLinguistAudit();
const second = deterministicOperationalLinguistAudit();
assert.deepEqual(first, second, 'same source tree must produce identical resource evidence');
assert.equal(first.length, 3);
assert.ok(first.every((entry) => entry.operationalState === 'ONLINE' && entry.errors.count === 0));
assert.ok(first.every((entry) => /^sha256:[0-9a-f]{64}$/.test(entry.resourceEvidenceDigest)));
assert.ok(first.every((entry) => entry.resourceEvidenceDigest === entry.resources.catalogDigest));

const recomputedBaselineDigest = `sha256:${createHash('sha256').update(OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL).digest('hex')}`;
assert.equal(OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST, recomputedBaselineDigest);
const publication = createPublicationEvidence({ registrationId: '11111111-1111-4111-8111-111111111111', authorityEpoch: 7 }, '2026-09-23T12:00:00.000Z');
assert.deepEqual(publication, createPublicationEvidence({ registrationId: '11111111-1111-4111-8111-111111111111', authorityEpoch: 7 }, '2026-09-23T12:00:00.000Z'));
assert.ok(publication.every((entry) => !('journalStatus' in entry) && !('writerVersion' in entry.publisher)));

assert.deepEqual(new Set(operationalLinguistV1QualityFixtures.map((item) => item.category)), new Set(operationalLinguistV1QualityCategories));
for (const fixture of operationalLinguistV1QualityFixtures) {
  assert.ok(fixture.source.trim() && fixture.context.trim());
  for (const language of OPERATIONAL_LINGUIST_V1_LANGUAGES) {
    assert.ok(fixture.expected[language].length > 0);
    for (const candidate of fixture.expected[language]) {
      assert.ok(candidate.trim() && candidate !== fixture.source);
      assert.equal(assessOperationalLinguistV1QualityCandidate(fixture.id, language, candidate), 'PASS');
      assert.equal(assessOperationalLinguistV1QualityCandidate(fixture.id, language, `${candidate} altered`), 'REVIEW_REQUIRED');
      for (const term of fixture.protectedTerms ?? []) assert.ok(candidate.includes(term), `${fixture.id}/${language}: protected term ${term}`);
    }
  }
}

const protectedOriginalNine = ['ro', 'de', 'en', 'fr', 'nl', 'ru', 'pl', 'tr', 'sq'];
for (const language of protectedOriginalNine) {
  const registration = premiumLinguisticAgents.find((agent) => agent.language === language);
  assert.deepEqual(registration && { id: registration.id, enabled: registration.enabled, status: registration.status, capabilities: registration.capabilities }, {
    id: `premium-linguist-${language}`, enabled: false, status: 'preparing', capabilities: [],
  });
}

const observedSnapshots: Parameters<typeof recordRuntimeOperationSnapshot>[] = [];
const successfulFetcher = (async () => new Response(JSON.stringify({
  data: { components: [{ componentId: 'premium-linguist-it', operationalState: 'ONLINE', current: true, observedAt: '2026-09-23T12:00:00.000Z' }] },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof turnAdminAuthenticatedFetch;
await observeOperationalLinguistV1(successfulFetcher, (...args) => { observedSnapshots.push(args); });
assert.deepEqual(observedSnapshots, [[
  'premium-linguist-it',
  'ONLINE',
  'V1_CANONICAL_STATE_OBSERVED',
  'API persisted V1 state observed at 2026-09-23T12:00:00.000Z',
]]);

const expiredSessionFetcher = (async () => {
  throw new TurnAdminSessionError('expired-or-revoked', 401);
}) as typeof turnAdminAuthenticatedFetch;
await assert.doesNotReject(() => observeOperationalLinguistV1(expiredSessionFetcher, () => undefined));

const unexpectedFailureFetcher = (async () => {
  throw new Error('UNEXPECTED_OBSERVER_FAILURE');
}) as typeof turnAdminAuthenticatedFetch;
await assert.rejects(
  () => observeOperationalLinguistV1(unexpectedFailureFetcher, () => undefined),
  /UNEXPECTED_OBSERVER_FAILURE/,
);

const governanceRuntimeSource = readFileSync(new URL('../src/premium-governance/premium-governance.runtime.ts', import.meta.url), 'utf8');
assert.match(governanceRuntimeSource, /\^premium-linguist-\(it\|es\|sv\)\$/);
assert.match(governanceRuntimeSource, /return `Linguist \$\{linguisticLanguage\.toUpperCase\(\)\}`/);

const panelRuntimeSource = readFileSync(new URL('../src/turn-agent-panel.integration.ts', import.meta.url), 'utf8');
assert.equal((panelRuntimeSource.match(/Operational Linguistic Baseline V1 · typed API state · 1\.726 resurse/g) ?? []).length, 3);
assert.doesNotMatch(panelRuntimeSource, /Component heartbeat v1 · audit runtime/);
assert.equal(existsSync(new URL('../src/premium-linguistic-agents/premium-linguistic-agents.runtime.ts', import.meta.url)), false, 'legacy Browser publisher runtime must remain deleted');
assert.equal(existsSync(new URL('../src/premium-linguistic-agents/premium-linguistic-heartbeat.evidence.ts', import.meta.url)), false, 'legacy heartbeat evidence module must remain deleted');
assert.equal(existsSync(new URL('../../../scripts/publish-production-linguistic-heartbeats-browser.mjs', import.meta.url)), false, 'legacy Browser publication script must remain deleted');
assert.equal(existsSync(new URL('../../../scripts/test-production-linguistic-heartbeats-browser.mjs', import.meta.url)), false, 'legacy Browser publication test must remain deleted');
assert.equal(existsSync(new URL('../../../scripts/simulate-production-linguistic-release-sequencing.ts', import.meta.url)), false, 'legacy release simulation must remain deleted');
assert.equal(existsSync(new URL('../../../.github/workflows/production-linguistic-heartbeat-diagnostic.yml', import.meta.url)), false, 'legacy diagnostic publication workflow must remain deleted');

const operationalProfileSource = readFileSync(new URL('../../api/src/authority-control-plane/operational-profile.ts', import.meta.url), 'utf8');
const controlPlaneSource = readFileSync(new URL('../../api/src/authority-control-plane/authority-control-plane.service.ts', import.meta.url), 'utf8');
const telemetryServiceSource = readFileSync(new URL('../../api/src/component-telemetry/component-telemetry.service.ts', import.meta.url), 'utf8');
assert.match(operationalProfileSource, /startsWith\('premium-linguist-'\).*'OPERATIONAL_LINGUIST_V1'/);
assert.match(controlPlaneSource, /operationalLinguistStateById/);
assert.match(controlPlaneSource, /OperationalLinguistState:/);
assert.match(telemetryServiceSource, /LEGACY_OPERATIONAL_LINGUIST_HEARTBEAT_FENCED/);

const operationsHealth = JSON.parse(readFileSync(new URL('../../../config/operations-health.json', import.meta.url), 'utf8')) as { operationsServices: Array<{ id: string; kind: string; url?: string; evaluator?: string }> };
for (const id of ['premium-linguist-it', 'premium-linguist-es', 'premium-linguist-sv']) {
  const source = operationsHealth.operationsServices.find((item) => item.id === id);
  assert.deepEqual(source && { kind: source.kind, url: source.url, evaluator: source.evaluator }, { kind: 'runtime', url: undefined, evaluator: undefined }, `${id}: Browser must not retain a legacy component-health probe`);
}

console.log(JSON.stringify({
  status: 'PASS',
  determinism: 'PASS',
  agents: Object.fromEntries(first.map((entry) => [entry.language.toUpperCase(), 'PASS'])),
  immutableQualityFixtures: `${operationalLinguistV1QualityFixtures.length} categories/cases PASS`,
  unapprovedQualityOutput: 'REVIEW_REQUIRED',
  originalNineReferenceBaseline: 'UNCHANGED',
  generation: 'OPERATIONAL_LINGUIST_V1_ONLY',
  legacyBrowserPublisher: 'ABSENT',
  legacyComponentHeartbeat: 'FENCED',
  browserAuthority: 'NONE',
}, null, 2));
