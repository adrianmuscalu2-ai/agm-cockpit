export type RiskKnowledgeVerdict = 'ALLOW' | 'ALLOW_WITH_CONDITIONS' | 'REVIEW_REQUIRED' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE';
export type LifecycleVerdict = 'PASS' | 'FAIL' | 'BLOCK' | 'REVIEW_REQUIRED' | 'INSUFFICIENT_EVIDENCE';
import { deriveRegressionSafeFinalVerdict, type RegressionRiskVerdict } from './risk-knowledge-regression.contract';

export type SessionStartRecord = {
  sessionId: string;
  protocolVersion: string;
  protocolRead: boolean;
  archiveInterrogated: boolean;
  librariansActivated: boolean;
  currentBaselineLoaded: boolean;
  canonicalSourcesLoaded: boolean;
  actorMatrixLoaded: boolean;
  worktreeRegistryLoaded: boolean;
  activeIncidentsLoaded: boolean;
  openMandatesLoaded: boolean;
  riskKnowledgeAvailable: boolean;
  sessionAuthorized: boolean;
};

export type MandateStartRecord = {
  mandateId: string;
  mandateRegistered: boolean;
  archiveSearchComplete: boolean;
  librarianHandoffComplete: boolean;
  precedentsLoaded: boolean;
  canonicalSourcesVerified: boolean;
  actorsVerified: boolean;
  worktreeVerified: boolean;
  dependencyReview: boolean;
  riskPrecheck: RiskKnowledgeVerdict;
  snapshot: boolean;
  executionAuthorized: boolean;
};

export type MandateEndRecord = {
  finalVerdictInput: FinalVerdictInput;
  technicalResult: LifecycleVerdict;
  validatorResult: LifecycleVerdict;
  riskPostReview: RiskKnowledgeVerdict;
  finalVerdict: LifecycleVerdict;
  registriesUpdated: boolean;
  archiveUpdated: boolean;
  candidateStatus: string;
  worktreeStatus: string;
  openBlockers: string[];
  nextAction: string;
  mandateClosed: boolean;
};

export type FinalVerdictInput = {
  technicalResult: LifecycleVerdict;
  validatorResult: LifecycleVerdict;
  riskPostReview: RiskKnowledgeVerdict;
  governanceStatus: 'PASS' | 'BLOCK' | 'REVIEW_REQUIRED' | 'UNKNOWN';
  recoveryEvidence: 'PASS' | 'BLOCK' | 'REVIEW_REQUIRED' | 'UNKNOWN';
  candidateIdentityVerified: boolean;
  requiredEvidencePersisted: boolean;
  regressionRiskVerdict?: RegressionRiskVerdict;
  criticalRegressionUnknown?: boolean;
  beforeAfterCompared?: boolean;
};

const riskAcceptable = (verdict: RiskKnowledgeVerdict) => verdict === 'ALLOW' || verdict === 'ALLOW_WITH_CONDITIONS';

export function validateSessionStart(record: SessionStartRecord): { allowed: boolean; missing: string[] } {
  const required: Array<[string, boolean]> = [
    ['SESSION_ID', Boolean(record.sessionId)],
    ['PROTOCOL_VERSION', Boolean(record.protocolVersion)],
    ['PROTOCOL_READ', record.protocolRead],
    ['ARCHIVE_INTERROGATED', record.archiveInterrogated],
    ['LIBRARIANS_ACTIVATED', record.librariansActivated],
    ['CURRENT_BASELINE', record.currentBaselineLoaded],
    ['CANONICAL_SOURCES_LOADED', record.canonicalSourcesLoaded],
    ['ACTOR_MATRIX_LOADED', record.actorMatrixLoaded],
    ['WORKTREE_REGISTRY_LOADED', record.worktreeRegistryLoaded],
    ['ACTIVE_INCIDENTS_LOADED', record.activeIncidentsLoaded],
    ['OPEN_MANDATES_LOADED', record.openMandatesLoaded],
    ['RISK_KNOWLEDGE_AVAILABLE', record.riskKnowledgeAvailable],
    ['SESSION_AUTHORIZED', record.sessionAuthorized],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  return { allowed: missing.length === 0, missing };
}

export function validateMandateStart(record: MandateStartRecord): { allowed: boolean; missing: string[] } {
  const required: Array<[string, boolean]> = [
    ['MANDATE_ID', Boolean(record.mandateId)],
    ['MANDATE_REGISTERED', record.mandateRegistered],
    ['ARCHIVE_SEARCH_COMPLETE', record.archiveSearchComplete],
    ['LIBRARIAN_HANDOFF_COMPLETE', record.librarianHandoffComplete],
    ['PRECEDENTS_LOADED', record.precedentsLoaded],
    ['CANONICAL_SOURCES_VERIFIED', record.canonicalSourcesVerified],
    ['ACTORS_VERIFIED', record.actorsVerified],
    ['WORKTREE_VERIFIED', record.worktreeVerified],
    ['DEPENDENCY_REVIEW', record.dependencyReview],
    ['RISK_PRECHECK', riskAcceptable(record.riskPrecheck)],
    ['SNAPSHOT', record.snapshot],
    ['EXECUTION_AUTHORIZED', record.executionAuthorized],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  return { allowed: missing.length === 0, missing };
}

export function calculateFinalVerdict(input: FinalVerdictInput): LifecycleVerdict {
  if (input.riskPostReview === 'BLOCK') return 'BLOCK';
  if (input.criticalRegressionUnknown) return 'REVIEW_REQUIRED';
  if (input.beforeAfterCompared === false) return 'REVIEW_REQUIRED';
  if (input.regressionRiskVerdict) {
    const technicalResult = input.technicalResult === 'PASS' ? 'PASS' : input.technicalResult === 'FAIL' || input.technicalResult === 'BLOCK' ? 'BLOCKED' : 'UNKNOWN';
    const regressionVerdict = deriveRegressionSafeFinalVerdict({ technicalResult, riskVerdict: input.regressionRiskVerdict });
    if (regressionVerdict !== 'PASS') return regressionVerdict;
  }
  if (input.riskPostReview === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  if (input.riskPostReview === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (input.technicalResult !== 'PASS') return input.technicalResult;
  if (input.validatorResult !== 'PASS') return input.validatorResult === 'BLOCK' ? 'BLOCK' : 'FAIL';
  if (input.governanceStatus === 'BLOCK') return 'BLOCK';
  if (input.governanceStatus !== 'PASS') return 'REVIEW_REQUIRED';
  if (input.recoveryEvidence !== 'PASS' || !input.candidateIdentityVerified || !input.requiredEvidencePersisted) return 'REVIEW_REQUIRED';
  return 'PASS';
}

export function validateMandateEnd(record: MandateEndRecord): { allowed: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!record.technicalResult) missing.push('TECHNICAL_RESULT');
  if (!record.validatorResult) missing.push('INDEPENDENT_VALIDATION');
  if (!record.riskPostReview) missing.push('RISK_POST_REVIEW');
  if (!record.finalVerdict) missing.push('FINAL_VERDICT');
  if (!record.registriesUpdated) missing.push('REGISTRIES_UPDATED');
  if (!record.archiveUpdated) missing.push('ARCHIVE_UPDATED');
  if (!record.candidateStatus) missing.push('CANDIDATE_STATUS');
  if (!record.worktreeStatus) missing.push('WORKTREE_STATUS');
  if (!record.nextAction) missing.push('NEXT_ACTION');
  if (record.finalVerdict === 'PASS' && record.riskPostReview !== 'ALLOW' && record.riskPostReview !== 'ALLOW_WITH_CONDITIONS') missing.push('RISK_POST_REVIEW_ACCEPTABLE');
  if (record.mandateClosed && record.finalVerdict !== 'PASS') missing.push('CLOSED_WITHOUT_FINAL_PASS');
  if (record.finalVerdictInput && calculateFinalVerdict(record.finalVerdictInput) !== record.finalVerdict) missing.push('FINAL_VERDICT_NOT_DERIVED');
  return { allowed: missing.length === 0, missing };
}

export function assertSessionStart(record: SessionStartRecord): void {
  const result = validateSessionStart(record);
  if (!result.allowed) throw new Error(`SESSION_EXECUTION_NOT_AUTHORIZED:${result.missing.join(',')}`);
}

export function assertMandateStart(record: MandateStartRecord): void {
  const result = validateMandateStart(record);
  if (!result.allowed) throw new Error(`MANDATE_EXECUTION_NOT_AUTHORIZED:${result.missing.join(',')}`);
}

export function assertMandateEnd(record: MandateEndRecord): void {
  const result = validateMandateEnd(record);
  if (!result.allowed) throw new Error(`MANDATE_NOT_CLOSED:${result.missing.join(',')}`);
}
