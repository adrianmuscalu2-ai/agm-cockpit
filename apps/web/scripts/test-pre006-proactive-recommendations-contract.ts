import assert from 'node:assert/strict';
import { createGovernedProactiveRecommendation } from '../src/premium-proactive-recommendations/proactive-recommendations.authorization';
import { inspectProactiveRecommendation } from '../src/premium-proactive-recommendations/proactive-recommendations.inspector-policy';
import { proactiveRecommendationsModule } from '../src/premium-proactive-recommendations/proactive-recommendations.module';
import { transitionProactiveRecommendation } from '../src/premium-proactive-recommendations/proactive-recommendations.workflow';

const recommendation = {
  id: 'recommendation-001', category: 'verification-needed' as const,
  observedContext: 'Constatarea PRE-004 indică o verificare necesară.',
  proposedRecommendation: 'Verifică documentul înainte de continuare.',
  reason: 'Sursa confirmată conține o incertitudine relevantă.',
  source: { type: 'context-analysis' as const, id: 'finding-001', version: '1.0.0', confirmedByUser: true as const },
  confidence: 0.9, sensitivity: 'sensitive' as const,
  ruleVersion: 'verification-needed@1.0.0',
  createdAt: '2026-08-01T09:00:00.000Z', expiresAt: '2026-08-01T10:00:00.000Z',
  contextRefs: ['finding:finding-001'], usesPersonalData: false as const,
  producesExternalEffect: false as const,
};
const permit = {
  id: 'permit-pre006-001', operationId: recommendation.id,
  moduleId: 'proactive-recommendations' as const, capability: 'generate-recommendation',
  policyId: 'proactive-recommendations-policy', policyVersion: 'proactive-recommendations-policy@1.0.0',
  risk: 'sensitive' as const, issuedAt: '2026-08-01T08:59:00.000Z',
  expiresAt: '2026-08-01T09:01:00.000Z', singleUse: true as const, status: 'issued' as const,
};
const now = new Date('2026-08-01T09:00:00.000Z');
const create = (candidate = recommendation, candidatePermit = permit) => createGovernedProactiveRecommendation({
  recommendation: candidate, permit: candidatePermit, policyVersion: permit.policyVersion, now,
});

assert.equal(proactiveRecommendationsModule.enabled, false);
assert.deepEqual(proactiveRecommendationsModule.generators, []);
assert.equal(proactiveRecommendationsModule.inspector, undefined);
assert.equal(create()?.status, 'created');
assert.equal(create()?.consumedPermit?.status, 'consumed');
assert.equal(create(recommendation, { ...permit, operationId: 'wrong' }), undefined);
assert.equal(create(recommendation, { ...permit, expiresAt: '2026-08-01T08:59:59.000Z' }), undefined);
assert.equal(create({ ...recommendation, source: { ...recommendation.source, confirmedByUser: false as never } }), undefined);
assert.equal(create({ ...recommendation, contextRefs: [] }), undefined);

const created = create();
assert.ok(created);
const decision = inspectProactiveRecommendation(recommendation, now);
assert.deepEqual(decision, { outcome: 'approved' });
const waiting = transitionProactiveRecommendation(created, { type: 'submit-to-inspector' });
const approved = transitionProactiveRecommendation(waiting, { type: 'record-inspector-decision', decision });
assert.equal(transitionProactiveRecommendation(created, { type: 'accept', now }).status, 'created');
assert.equal(transitionProactiveRecommendation(approved, { type: 'accept', now }).status, 'accepted');
assert.equal(transitionProactiveRecommendation(approved, { type: 'defer', now }).status, 'deferred');
assert.equal(transitionProactiveRecommendation(approved, {
  type: 'accept', now: new Date('2026-08-01T10:00:00.000Z'),
}).status, 'expired');
assert.deepEqual(inspectProactiveRecommendation({ ...recommendation, source: { ...recommendation.source, id: '' } }, now), {
  outcome: 'blocked', reason: 'missing-source',
});

console.log('PRE-006 proactive recommendations contract: PASS');
