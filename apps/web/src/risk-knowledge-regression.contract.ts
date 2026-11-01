export type RegressionCapabilityStatus = 'PRESERVED' | 'DEGRADED' | 'DISCONNECTED' | 'LOST' | 'INTENTIONALLY_SUPERSEDED' | 'UNKNOWN';
export type RegressionRiskVerdict = 'ALLOW' | 'ALLOW_WITH_CONDITIONS' | 'REVIEW_REQUIRED' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE';
export type RegressionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type RegressionProtectionItem = {
  capability: string;
  baseline: string;
  lastKnownGood: string;
  expectedBehavior: string;
  dependencies: readonly string[];
  testRequired: string;
  recoveryReference: string;
  riskLevel: RegressionPriority;
};

export type RegressionAssessment = {
  verdict: RegressionRiskVerdict;
  reasons: readonly string[];
  protectionSet: readonly RegressionProtectionItem[];
  recheckRequired: boolean;
};

export type RegressionChangeContext = {
  scopeChanged?: boolean;
  worktreeChanged?: boolean;
  candidateChanged?: boolean;
  canonicalSourceChanged?: boolean;
  writerAuthorityChanged?: boolean;
  dependencyAdded?: boolean;
  unexpectedRegression?: boolean;
  majorTestFailed?: boolean;
  recoveryDeviation?: boolean;
};

export type RegressionComparison = {
  capability: string;
  before: RegressionCapabilityStatus;
  after: RegressionCapabilityStatus;
  priority: RegressionPriority;
  evidenceRef: string;
  explanation?: string;
};

export function createRegressionProtectionSet(items: readonly RegressionProtectionItem[]): RegressionAssessment {
  const reasons: string[] = [];
  if (!items.length) reasons.push('REGRESSION_PROTECTION_SET_EMPTY');
  for (const item of items) {
    if (!item.capability || !item.baseline || !item.lastKnownGood || !item.expectedBehavior || !item.testRequired || !item.recoveryReference) {
      reasons.push(`REGRESSION_PROTECTION_ITEM_INCOMPLETE:${item.capability || 'UNKNOWN'}`);
    }
  }
  return { verdict: reasons.length ? 'INSUFFICIENT_EVIDENCE' : 'ALLOW', reasons, protectionSet: items, recheckRequired: false };
}

export function evaluateRegressionPrecheck(input: {
  protectionSet: RegressionAssessment;
  capabilityMatrixLoaded: boolean;
  lastKnownGoodLoaded: boolean;
  regressionWindowsLoaded: boolean;
  incidentRegistryLoaded: boolean;
  versionRegistryLoaded: boolean;
  snapshotVaultLoaded: boolean;
  worktreeRegistryLoaded: boolean;
  cscPcrLoaded: boolean;
  eventLedgerLoaded: boolean;
  priorMandatesLoaded: boolean;
  snapshotPresent: boolean;
  rollbackPresent: boolean;
  candidateIdentityPresent: boolean;
  validationPlanPresent: boolean;
  criticalUnknown: boolean;
}): RegressionAssessment {
  const reasons = [...input.protectionSet.reasons];
  const required = [
    ['CAPABILITY_MATRIX', input.capabilityMatrixLoaded], ['LAST_KNOWN_GOOD', input.lastKnownGoodLoaded],
    ['REGRESSION_WINDOWS', input.regressionWindowsLoaded], ['INCIDENT_REGISTRY', input.incidentRegistryLoaded],
    ['VERSION_REGISTRY', input.versionRegistryLoaded], ['SNAPSHOT_VAULT', input.snapshotVaultLoaded],
    ['WORKTREE_REGISTRY', input.worktreeRegistryLoaded], ['CSC_PCR', input.cscPcrLoaded],
    ['EVENT_LEDGER', input.eventLedgerLoaded], ['PRIOR_MANDATES', input.priorMandatesLoaded],
    ['SNAPSHOT', input.snapshotPresent], ['ROLLBACK', input.rollbackPresent],
    ['CANDIDATE_IDENTITY', input.candidateIdentityPresent], ['VALIDATION_PLAN', input.validationPlanPresent],
  ] as const;
  for (const [name, present] of required) if (!present) reasons.push(`PRECHECK_MISSING:${name}`);
  if (input.criticalUnknown) reasons.push('CRITICAL_CAPABILITY_UNKNOWN');
  const blocked = reasons.some((reason) => reason.includes('CRITICAL_CAPABILITY_UNKNOWN'));
  return { verdict: blocked ? 'BLOCK' : reasons.length ? 'REVIEW_REQUIRED' : 'ALLOW', reasons, protectionSet: input.protectionSet.protectionSet, recheckRequired: false };
}

export function requiresRegressionRecheck(change: RegressionChangeContext) {
  return Object.values(change).some(Boolean);
}

export function evaluateRegressionPostReview(comparisons: readonly RegressionComparison[], technicalResult: 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN'): RegressionAssessment & { summary: Record<RegressionCapabilityStatus | 'NEW_REGRESSION', number> } {
  const summary = { PRESERVED: 0, DEGRADED: 0, DISCONNECTED: 0, LOST: 0, INTENTIONALLY_SUPERSEDED: 0, UNKNOWN: 0, NEW_REGRESSION: 0 };
  const reasons: string[] = [];
  for (const item of comparisons) {
    summary[item.after] += 1;
    if (item.after === 'DEGRADED' || item.after === 'DISCONNECTED' || item.after === 'LOST') summary.NEW_REGRESSION += 1;
    if (item.after === 'UNKNOWN') reasons.push(`UNKNOWN_CAPABILITY:${item.capability}`);
    if (item.after === 'DEGRADED' || item.after === 'DISCONNECTED' || item.after === 'LOST') reasons.push(`UNEXPLAINED_OR_NEW_REGRESSION:${item.capability}`);
  }
  if (technicalResult !== 'PASS') reasons.push(`TECHNICAL_RESULT:${technicalResult}`);
  const criticalUnknown = comparisons.some((item) => item.priority === 'P0' || item.priority === 'P1' ? item.after === 'UNKNOWN' : false);
  const verdict: RegressionRiskVerdict = criticalUnknown || summary.NEW_REGRESSION > 0 ? 'BLOCK' : reasons.length ? 'REVIEW_REQUIRED' : 'ALLOW';
  return { verdict, reasons, protectionSet: [], recheckRequired: false, summary };
}

export function deriveRegressionSafeFinalVerdict(input: { technicalResult: 'PASS' | 'FAIL' | 'BLOCKED' | 'UNKNOWN'; riskVerdict: RegressionRiskVerdict; humanOverride?: { originalRiskVerdict: RegressionRiskVerdict; actor: string; reason: string; acceptedRisk: string; scope: string; time: string; evidence: string } }): 'PASS' | 'BLOCK' | 'REVIEW_REQUIRED' {
  if (input.riskVerdict === 'BLOCK') return 'BLOCK';
  if (input.technicalResult !== 'PASS') return input.technicalResult === 'FAIL' || input.technicalResult === 'BLOCKED' ? 'BLOCK' : 'REVIEW_REQUIRED';
  if (input.riskVerdict === 'REVIEW_REQUIRED' || input.riskVerdict === 'INSUFFICIENT_EVIDENCE') return 'REVIEW_REQUIRED';
  return 'PASS';
}

export function detectCanonicalSourceDrift(input: { sourceBefore: string; sourceAfter: string; writerBefore: string; writerAfter: string; precedenceBefore: string; precedenceAfter: string }) {
  return input.sourceBefore !== input.sourceAfter || input.writerBefore !== input.writerAfter || input.precedenceBefore !== input.precedenceAfter;
}

export function detectCandidateWorktreeDrift(input: { candidateBefore: string; candidateAfter: string; worktreeBefore: string; worktreeAfter: string }) {
  return input.candidateBefore !== input.candidateAfter || input.worktreeBefore !== input.worktreeAfter;
}

export function classifyRecurrentRegression(input: { currentClass: string; priorIncidents: readonly { incidentId: string; regressionClass: string; failedRemediationRef: string; missingProtection: string; missingTest: string }[] }) {
  const matches = input.priorIncidents.filter((item) => item.regressionClass === input.currentClass);
  return matches.length ? { classification: 'RECURRENT_REGRESSION' as const, precedentRefs: matches.map((item) => item.incidentId), failedRemediationRefs: matches.map((item) => item.failedRemediationRef), missingProtection: matches.map((item) => item.missingProtection), missingTests: matches.map((item) => item.missingTest) } : { classification: 'NEW_REGRESSION' as const, precedentRefs: [] as string[], failedRemediationRefs: [], missingProtection: [], missingTests: [] };
}

export function validateHumanOverride(input: { originalRiskVerdict?: RegressionRiskVerdict; actor?: string; reason?: string; acceptedRisk?: string; scope?: string; time?: string; evidence?: string }) {
  return Boolean(input.originalRiskVerdict && input.actor?.trim() && input.reason?.trim() && input.acceptedRisk?.trim() && input.scope?.trim() && input.time?.trim() && input.evidence?.trim());
}
