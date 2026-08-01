import assert from 'node:assert/strict';
import { premiumContextAnalysisModule } from '../src/premium-context-analysis/premium-context-analysis.module';
import { transitionPremiumContextAnalysis } from '../src/premium-context-analysis/premium-context-analysis.workflow';
import { validatePremiumContextAnalysisFindings } from '../src/premium-context-analysis/premium-context-analysis.validation';

const request = {
  id: 'context-operation-001', source: 'operational-question' as const,
  content: 'Care este următorul pas sigur?', language: 'ro' as const,
  contextRefs: ['transport:validated-001'], usesPersonalData: false as const,
  producesExternalEffect: false as const,
};
const permit = {
  id: 'permit-pre004-001', operationId: request.id,
  moduleId: 'advanced-context-analysis' as const, capability: 'analyze-context',
  policyId: 'context-analysis-policy', policyVersion: 'context-analysis-policy@1.0.0',
  risk: 'sensitive' as const, issuedAt: '2026-08-01T08:59:00.000Z',
  expiresAt: '2026-08-01T09:01:00.000Z', singleUse: true as const, status: 'issued' as const,
};
const now = new Date('2026-08-01T09:00:00.000Z');
const start = (candidatePermit = permit) => transitionPremiumContextAnalysis(
  { status: 'idle', findings: [] },
  { type: 'start-analysis', request, permit: candidatePermit, policyVersion: permit.policyVersion, now },
);

assert.equal(premiumContextAnalysisModule.enabled, false);
assert.deepEqual(premiumContextAnalysisModule.analyzers, []);
assert.equal(transitionPremiumContextAnalysis(premiumContextAnalysisModule.initialState, {
  type: 'start-analysis', request, permit, policyVersion: permit.policyVersion, now,
}).status, 'disabled');
assert.equal(start().status, 'analyzing');
assert.equal(start().consumedPermit?.status, 'consumed');
assert.equal(start({ ...permit, operationId: 'wrong-operation' }).status, 'idle');
assert.equal(start({ ...permit, capability: 'wrong-capability' }).status, 'idle');
assert.equal(start({ ...permit, expiresAt: '2026-08-01T08:59:59.000Z' }).status, 'idle');
assert.equal(transitionPremiumContextAnalysis({ status: 'idle', findings: [] }, {
  type: 'start-analysis', request: { ...request, content: '' }, permit,
  policyVersion: permit.policyVersion, now,
}).status, 'idle');

const findings = [{
  id: 'finding-001', summary: 'O etapă necesită confirmarea utilizatorului.',
  confidence: 0.91, sourceRefs: ['transport:validated-001'], requiresUserConfirmation: true as const,
}];
assert.deepEqual(validatePremiumContextAnalysisFindings(findings), { valid: true });
assert.equal(validatePremiumContextAnalysisFindings([{ ...findings[0], confidence: 1.1 }]).valid, false);
assert.equal(validatePremiumContextAnalysisFindings([{ ...findings[0], sourceRefs: [] }]).valid, false);
const proposed = transitionPremiumContextAnalysis(start(), { type: 'propose-findings', findings });
assert.equal(proposed.status, 'awaiting-confirmation');
assert.equal(transitionPremiumContextAnalysis(proposed, { type: 'confirm' }).status, 'confirmed');
assert.equal(transitionPremiumContextAnalysis(proposed, { type: 'reject' }).status, 'rejected');
assert.equal(transitionPremiumContextAnalysis(start(), { type: 'propose-findings', findings: [] }).status, 'idle');

console.log('PRE-004 advanced context analysis contract: PASS');
