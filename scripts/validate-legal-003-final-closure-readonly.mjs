import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path);
const text = (path) => read(path).toString('utf8');
const json = (path) => JSON.parse(text(path));
const sha = (path) => createHash('sha256').update(read(path)).digest('hex');
const checks = [];
const check = (name, condition, actual = undefined) => {
  if (!condition) throw new Error(`FAIL:${name}${actual === undefined ? '' : `:${actual}`}`);
  checks.push({ name, status: 'PASS', ...(actual === undefined ? {} : { actual }) });
};

const decisionPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/PRODUCT_OWNER_CLOSURE_DECISION.json';
const reconciliationPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/CANDIDATE_RECONCILIATION.json';
const reportPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_FINAL_CLOSURE/FINAL_CLOSURE_REPORT.md';
const policyPath = 'AGM_LIBRARY/GOVERNANCE/ADVISORY_NON_CERTIFYING_AUTHORITY_POLICY.json';
const impactPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_VDI_IMPACT_STUDY/IMPACT_STUDY.json';
const evidencePath = 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW/EVIDENCE_MANIFEST.json';
const checklistPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW/OWNER_LICENSED_ACQUISITION_CHECKLIST.md';
const inventoryPath = 'AGM_LIBRARY/PHASE3/LEGAL_003_OWNER_REVIEW/LICENSED_CONTENT_INVENTORY.json';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const legalViewPath = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const routingViewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';

const decision = json(decisionPath);
const reconciliation = json(reconciliationPath);
const policy = json(policyPath);
const impact = json(impactPath);
const evidence = json(evidencePath);
const registry = json(registryPath);
const legalView = json(legalViewPath);
const routingView = json(routingViewPath);

check('DECISION_CLOSED', decision.decision === 'PASS_WITH_EXTERNAL_LICENSED_DEPENDENCY_CLOSED');
check('CURRENT_SCOPE_COMPLETE', decision.approvedCurrentScope.status === 'COMPLETE');
check('PUBLIC_EVIDENCE_3_OF_4', decision.metrics.publicAuthoritativeEvidence === '3/4');
check('LICENSED_DEPENDENCY_1_OF_4', decision.metrics.licensedExternalDependency === '1/4');
check('NO_ARTIFICIAL_4_OF_4', decision.metrics.artificialFourOfFourForbidden === true);
check('CURRENT_SCOPE_BLOCKERS_ZERO', decision.metrics.currentScopeBlockers === 0);
check('BLOCKER_RECLASSIFIED', decision.vdi.legacyBlockerAfter === 'NOT_REQUIRED_FOR_APPROVED_SCOPE');
check('VDI_EXTERNAL_ONLY', decision.vdi.role === 'LICENSED_EXTERNAL_STANDARD');
check('VDI_NO_PURCHASE', decision.vdi.purchase === 'NOT_AUTHORIZED_NOT_EXECUTED');
check('VDI_NO_INGEST', decision.vdi.ingest === 'NOT_AUTHORIZED_NOT_EXECUTED');
check('NO_EVIDENCE_PROMOTION', decision.vdi.evidencePromotion === false);
check('REOPEN_STATE', decision.reopenCondition.state === 'VDI_LICENSE_REVIEW_REQUIRED');
check('THREE_CANDIDATES', reconciliation.candidateCount === 3 && reconciliation.records.length === 3);
check('ZERO_PENDING', reconciliation.pendingCount === 0);
check('CLASSIFICATION_TOTALS', reconciliation.classificationTotals.AUTHORITATIVE_WITH_SCOPE === 2 && reconciliation.classificationTotals.CONTEXTUAL === 1);
check('STVO_REUSE', reconciliation.records[0].sourceId === 'CS-DE-STVO' && reconciliation.records[0].registryImpact === 0);
check('HGB_NOT_APPLIED', reconciliation.records[1].sourceId === 'CS-DE-HGB-412' && reconciliation.records[1].applyStatus === 'APPROVED_NOT_APPLIED');
check('VDI_CONTEXTUAL_NOT_APPLIED', reconciliation.records[2].sourceId === 'CS-VDI-2700-HANDBOOK' && reconciliation.records[2].classification === 'CONTEXTUAL');
check('NO_CURRENT_MUTATION', Object.values(reconciliation.currentMutationImpact).every((value) => value === '0/0/0'));
check('POLICY_APPROVED_AGM_WIDE', policy.status === 'APPROVED' && policy.scope === 'AGM_WIDE');
check('MANDATORY_HUMAN_FLOW', policy.mandatoryFlow.join('>') === 'AGM_PROPOSAL>HUMAN_PHYSICAL_VERIFICATION>USER_DECISION');
check('NO_UNVERIFIED_ROLES', policy.prohibitedRoleAssumptions.length === 5);
check('ALLOWED_STATES_COMPLETE', ['PUBLIC_LEGAL_GUIDANCE','LICENSED_STANDARD_REFERENCE_REQUIRED','HUMAN_VERIFICATION_REQUIRED','INSUFFICIENT_AUTHORITY','UNKNOWN'].every((state) => policy.allowedFinalStates.includes(state)));
check('FORBIDDEN_AUTOMATIC_STATES', ['COMPLIANT','SAFE','CERTIFIED','PASS'].every((state) => policy.forbiddenAutomaticStates.includes(state)));
check('IMPACT_STUDY_NO_PURCHASE', impact.recommendation.purchaseJustifiedNow === false);
check('EVIDENCE_MANIFEST_PRESERVED', evidence.artifacts.length === 5);
check('EVIDENCE_FILES_HASH_MATCH', evidence.artifacts.every((item) => existsSync(item.path) && sha(item.path) === item.sha256));
check('ACQUISITION_CHECKLIST_PRESERVED', existsSync(checklistPath));
check('LICENSED_INVENTORY_PRESERVED', existsSync(inventoryPath));
check('REGISTRY_COUNT', registry.sources.length === 862, registry.sources.length);
check('REGISTRY_HASH', sha(registryPath) === '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245', sha(registryPath));
check('LEGAL_VIEW_COUNT', legalView.sourceCount === 66, legalView.sourceCount);
check('LEGAL_VIEW_HASH', sha(legalViewPath) === 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab', sha(legalViewPath));
check('ROUTING_VIEW_COUNT', routingView.sourceCount === 289, routingView.sourceCount);
check('ROUTING_VIEW_HASH', sha(routingViewPath) === '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0', sha(routingViewPath));
check('GUARDRAILS_NO_MUTATION', decision.guardrails.registryMutation === 'NONE' && decision.guardrails.legislationSafetyViewMutation === 'NONE' && decision.guardrails.routingTollViewMutation === 'NONE');
check('GUARDRAILS_NO_APPLY', decision.guardrails.apply === 'NOT_EXECUTED');
check('GUARDRAILS_NO_COMMIT', decision.guardrails.commitPush === 'NOT_EXECUTED');
check('REPORT_STATUS', text(reportPath).includes('PASS_WITH_EXTERNAL_LICENSED_DEPENDENCY / CLOSED'));

console.log(JSON.stringify({
  validator: 'LEGAL003_FINAL_CLOSURE_READ_ONLY',
  result: 'PASS',
  checksPassed: checks.length,
  totalChecks: checks.length,
  checks,
  artifacts: {
    productOwnerDecisionSha256: sha(decisionPath),
    candidateReconciliationSha256: sha(reconciliationPath),
    governancePolicySha256: sha(policyPath),
    finalClosureReportSha256: sha(reportPath)
  },
  finalState: {
    legal003: 'PASS_WITH_EXTERNAL_LICENSED_DEPENDENCY_CLOSED',
    approvedCurrentScope: 'COMPLETE',
    publicAuthoritativeEvidence: '3/4',
    licensedExternalDependency: '1/4',
    currentScopeBlockers: 0
  },
  mutations: {
    registry: 'NONE',
    legislationSafetyView: 'NONE',
    routingTollView: 'NONE',
    authorityPromotion: 'NONE',
    runtimeProduction: 'NO_CHANGE',
    apply: 'NOT_EXECUTED',
    commitPush: 'NOT_EXECUTED'
  }
}, null, 2));
