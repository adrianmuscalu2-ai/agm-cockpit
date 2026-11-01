import assert from 'node:assert/strict';
import { classifyRecurrentRegression, createRegressionProtectionSet, deriveRegressionSafeFinalVerdict, detectCandidateWorktreeDrift, detectCanonicalSourceDrift, evaluateRegressionPostReview, evaluateRegressionPrecheck, requiresRegressionRecheck, validateHumanOverride } from '../src/risk-knowledge-regression.contract';

const item = { capability: 'TURN incident journal', baseline: 'CAPABILITY_MATRIX', lastKnownGood: '2026-08-07 report', expectedBehavior: 'persist and reopen history', dependencies: ['writer', 'reader'], testRequired: 'journal lifecycle regression', recoveryReference: 'TURN_SOURCE_RECONCILIATION_INPUT', riskLevel: 'P0' as const };
const protection = createRegressionProtectionSet([item]);
assert.equal(protection.verdict, 'ALLOW');
assert.equal(requiresRegressionRecheck({ candidateChanged: true }), true);
const precheck = evaluateRegressionPrecheck({ protectionSet: protection, capabilityMatrixLoaded: true, lastKnownGoodLoaded: true, regressionWindowsLoaded: true, incidentRegistryLoaded: true, versionRegistryLoaded: true, snapshotVaultLoaded: true, worktreeRegistryLoaded: true, cscPcrLoaded: true, eventLedgerLoaded: true, priorMandatesLoaded: true, snapshotPresent: true, rollbackPresent: true, candidateIdentityPresent: true, validationPlanPresent: true, criticalUnknown: false });
assert.equal(precheck.verdict, 'ALLOW');
const post = evaluateRegressionPostReview([{ capability: item.capability, before: 'PRESERVED', after: 'DEGRADED', priority: 'P0', evidenceRef: 'evidence:regression' }], 'PASS');
assert.equal(post.verdict, 'BLOCK');
assert.equal(deriveRegressionSafeFinalVerdict({ technicalResult: 'PASS', riskVerdict: 'BLOCK' }), 'BLOCK');
assert.equal(deriveRegressionSafeFinalVerdict({ technicalResult: 'PASS', riskVerdict: 'ALLOW', beforeAfterCompared: true }), 'PASS');
assert.equal(detectCanonicalSourceDrift({ sourceBefore: 'a', sourceAfter: 'b', writerBefore: 'w', writerAfter: 'w', precedenceBefore: 'p', precedenceAfter: 'p' }), true);
assert.equal(detectCandidateWorktreeDrift({ candidateBefore: 'a', candidateAfter: 'a', worktreeBefore: 'w1', worktreeAfter: 'w2' }), true);
assert.equal(classifyRecurrentRegression({ currentClass: 'CONTINUITY', priorIncidents: [{ incidentId: 'INC-1', regressionClass: 'CONTINUITY', failedRemediationRef: 'FIX-1', missingProtection: 'CONTINUITY_SET', missingTest: 'TEST-1' }] }).classification, 'RECURRENT_REGRESSION');
assert.equal(validateHumanOverride({ originalRiskVerdict: 'BLOCK', actor: 'owner', reason: 'bounded exception', acceptedRisk: 'known', scope: 'local', time: new Date().toISOString(), evidence: 'evidence:1' }), true);
console.log('Risk & Knowledge regression prevention contract: PASS');
