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

console.log(JSON.stringify({
  status: 'PASS',
  determinism: 'PASS',
  agents: Object.fromEntries(first.map((entry) => [entry.language.toUpperCase(), 'PASS'])),
  immutableQualityFixtures: `${operationalLinguistV1QualityFixtures.length} categories/cases PASS`,
  unapprovedQualityOutput: 'REVIEW_REQUIRED',
  originalNineReferenceBaseline: 'UNCHANGED',
  browserAuthority: 'NONE',
}, null, 2));
