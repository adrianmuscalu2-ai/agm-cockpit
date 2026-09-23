import {
  OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL,
  OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
} from '@agm/shared';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

console.log(JSON.stringify({
  status: 'PASS',
  determinism: 'PASS',
  agents: Object.fromEntries(first.map((entry) => [entry.language.toUpperCase(), 'PASS'])),
  immutableQualityFixtures: `${operationalLinguistV1QualityFixtures.length} categories/cases PASS`,
  unapprovedQualityOutput: 'REVIEW_REQUIRED',
  originalNineReferenceBaseline: 'UNCHANGED',
  browserAuthority: 'NONE',
}, null, 2));
