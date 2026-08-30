import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const decisionsPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const freshnessReportPath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/VALIDATION_REPORT.json';
const freshnessPolicyPath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/STATE_MACHINE_AND_POLICY.md';
const freshnessTriggerMatrixPath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/TRIGGER_MATRIX.md';
const generatedAt = '2026-08-30T13:30:00.000Z';

const bytes = (relative) => readFileSync(path.join(root, relative));
const text = (relative) => bytes(relative).toString('utf8').replace(/^\uFEFF/, '');
const json = (relative) => JSON.parse(text(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(bytes(relative));
const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const registry = json(registryPath);
const view = json(viewPath);
const decisions = json(decisionsPath);
const packageData = json(`${outputRoot}/FINAL_PRE_APPLY_PACKAGE.json`);
const changeset = json(`${outputRoot}/FINAL_ATOMIC_CHANGESET.json`);
const impact = json(`${outputRoot}/EXACT_ATOMIC_APPLY_IMPACT.json`);
const recapture = json(`${outputRoot}/CH_VIGNETTE_RECAPTURE_MANIFEST.json`);
const browser = json(`${outputRoot}/EVIDENCE/CH_VIGNETTE_BROWSER_CAPTURE_REPORT.json`);
const freshnessReport = json(freshnessReportPath);
const freshnessPolicy = text(freshnessPolicyPath);
const freshnessTriggerMatrix = text(freshnessTriggerMatrixPath);

const registryIds = new Set(registry.sources.map((source) => source.sourceId));
const registryHashes = new Set(registry.sources.map((source) => source.sha256));
const registryUris = new Set(registry.sources.map((source) => source.canonicalUri));
const viewMembershipIds = new Set(view.memberships.map((membership) => membership.membershipId));
const additions = changeset.additions;
const memberships = changeset.routingTollMembershipAdditions;
const additionById = new Map(additions.map((source) => [source.sourceId, source]));
const decisionByCandidate = new Map(decisions.decisions.map((decision) => [decision.candidateId, decision]));
const blueprintByCandidate = new Map(packageData.blueprints.map((blueprint) => [blueprint.candidateId, blueprint]));
const requiredSourceKeys = ['sourceId', 'canonicalPath', 'canonicalUri', 'mediaType', 'sizeBytes', 'sha256', 'sourceDate', 'effectiveDate', 'version', 'status', 'owner', 'authority', 'provenance', 'retention', 'freshness', 'evidenceRefs', 'supersedes', 'supersededBy'];
const requiredFreshnessKeys = ['policyVersion', 'effectiveFrom', 'effectiveUntil', 'capturedAt', 'lastFreshnessCheck', 'nextFreshnessCheck', 'currentStatus', 'reviewRequired', 'usageFallback', 'limitations'];

const projectedRegistry = {
  ...registry,
  registryVersion: '1.3.0', generatedAt,
  sourceCount: registry.sourceCount + additions.length,
  sources: [...registry.sources, ...additions],
};
const currentViewSourceIds = new Set(view.memberships.map((membership) => membership.sourceId));
const projectedContentHashes = new Set([
  ...registry.sources.filter((source) => currentViewSourceIds.has(source.sourceId)).map((source) => source.sha256),
  ...additions.map((source) => source.sha256),
]);
const projectedView = {
  ...view,
  viewVersion: '1.3.0', generatedAt,
  sourceCount: view.sourceCount + memberships.length,
  uniqueContentHashes: projectedContentHashes.size,
  memberships: [...view.memberships, ...memberships],
};

const env = parseEnv(existsSync(path.join(root, '.env')) ? text('.env') : '');
const recipients = splitRecipients(env.AGM_PRODUCT_OWNER_ALERT_EMAIL);
const senderConfigured = Boolean(env.GMAIL_FROM_ADDRESS?.trim());
const destinationConfigured = recipients.length === 2 && new Set(recipients.map((value) => value.toLowerCase())).size === 2;
const senderMatchesPrimary = senderConfigured && recipients.length > 0 && env.GMAIL_FROM_ADDRESS.trim().toLowerCase() === recipients[0].toLowerCase();
const gmailAuthConfigured = Boolean(env.GMAIL_ACCESS_TOKEN?.trim()) || Boolean(env.GMAIL_OAUTH_CLIENT_ID?.trim() && env.GMAIL_OAUTH_CLIENT_SECRET?.trim() && env.GMAIL_OAUTH_REFRESH_TOKEN?.trim());

const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });
check('DECISIONS_10_OF_10_APPROVE', decisions.summary.total === 10 && decisions.summary.decided === 10 && decisions.summary.approved === 10 && decisions.summary.rejected === 0 && decisions.summary.deferred === 0 && decisions.summary.pending === 0 && decisions.decisions.length === 10, decisions.summary, { total: 10, decided: 10, approved: 10, rejected: 0, deferred: 0, pending: 0 });
check('DECISION_ORDINALS_EXACT', decisions.decisions.every((item, index) => item.ordinal === index + 1), decisions.decisions.map((item) => item.ordinal), [1,2,3,4,5,6,7,8,9,10]);
check('CLASSIFICATIONS_9_1', decisions.decisions.filter((item) => item.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 9 && decisions.decisions.filter((item) => item.classification === 'CONTEXTUAL').length === 1, packageData.authorityReview, { authoritativeWithScope: 9, contextual: 1 });
check('ALL_DECISIONS_PRESERVED_IN_BLUEPRINTS', packageData.blueprints.length === 10 && decisions.decisions.every((decision) => JSON.stringify(blueprintByCandidate.get(decision.candidateId)?.productOwnerDecisionSnapshot) === JSON.stringify(decision)), packageData.blueprints.length, 10);
check('DECISION_REGISTER_HASH', packageData.authorityReview.decisionRegisterSha256 === fileSha(decisionsPath), packageData.authorityReview.decisionRegisterSha256, fileSha(decisionsPath));
check('NO_APPLY_AUTHORIZATION', decisions.decisions.every((item) => item.atomicApplyAuthorized === false) && packageData.guardrails.atomicApplyAuthorized === false, packageData.guardrails.atomicApplyAuthorized, false);
check('BASELINE_REGISTRY_PROTECTED', registry.sourceCount === 831 && registry.sources.length === 831 && fileSha(registryPath) === 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d', { count: registry.sourceCount, sha256: fileSha(registryPath) }, { count: 831, sha256: 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d' });
check('BASELINE_VIEW_PROTECTED', view.sourceCount === 279 && view.memberships.length === 279 && fileSha(viewPath) === '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997', { count: view.sourceCount, sha256: fileSha(viewPath) }, { count: 279, sha256: '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997' });
check('IMPACT_BASELINES_MATCH_FILES', impact.baseline.registry.count === registry.sourceCount && impact.baseline.registry.sha256 === fileSha(registryPath) && impact.baseline.routingTollView.count === view.sourceCount && impact.baseline.routingTollView.sha256 === fileSha(viewPath), impact.baseline, 'live protected baselines');
check('OPERATIONS_10_0_0', changeset.operations.add === 10 && changeset.operations.modify === 0 && changeset.operations.delete === 0, changeset.operations, { add: 10, modify: 0, delete: 0 });
check('ADDITIONS_10_UNIQUE', additions.length === 10 && new Set(additions.map((source) => source.sourceId)).size === 10, additions.length, 10);
check('SOURCE_IDS_MATCH_DECISIONS', decisions.decisions.every((decision) => additionById.has(decision.proposedSourceId)), additions.map((source) => source.sourceId), decisions.decisions.map((decision) => decision.proposedSourceId));
check('SOURCE_IDS_ABSENT_FROM_REGISTRY', additions.every((source) => !registryIds.has(source.sourceId)), additions.filter((source) => registryIds.has(source.sourceId)).map((source) => source.sourceId), []);
check('SOURCE_SCHEMA_AND_PROVENANCE_SHAPE', additions.every((source) => requiredSourceKeys.every((key) => Object.hasOwn(source, key)) && source.provenance.importedFrom === decisionsPath && source.provenance.originalPreserved === true && source.evidenceRefs.includes(source.canonicalUri)), additions.filter((source) => !requiredSourceKeys.every((key) => Object.hasOwn(source, key)) || source.provenance.importedFrom !== decisionsPath || source.provenance.originalPreserved !== true || !source.evidenceRefs.includes(source.canonicalUri)).map((source) => source.sourceId), []);
check('FRESHNESS_METADATA_ALL_10', additions.every((source) => requiredFreshnessKeys.every((key) => Object.hasOwn(source.freshness, key))), additions.filter((source) => !requiredFreshnessKeys.every((key) => Object.hasOwn(source.freshness, key))).map((source) => source.sourceId), []);
check('ARTIFACT_INVENTORY_HASH_AND_SIZE_COMPLETE', changeset.artifactInventory.length === 14 && changeset.artifactInventory.every((artifact) => fileSha(artifact.path) === artifact.sha256 && bytes(artifact.path).length === artifact.sizeBytes), changeset.artifactInventory.filter((artifact) => fileSha(artifact.path) !== artifact.sha256 || bytes(artifact.path).length !== artifact.sizeBytes).map((artifact) => `${artifact.candidateId}:${artifact.role}`), []);
check('PRIMARY_HASHES_AND_CANONICAL_URIS_UNIQUE_AND_NEW', additions.every((source) => !registryHashes.has(source.sha256) && !registryUris.has(source.canonicalUri)) && new Set(additions.map((source) => source.sha256)).size === 10 && new Set(additions.map((source) => source.canonicalUri)).size === 10, additions.filter((source) => registryHashes.has(source.sha256) || registryUris.has(source.canonicalUri)).map((source) => source.sourceId), []);
check('CLASSIFICATIONS_CHANGESET_9_1', changeset.classifications.authoritativeWithScope === 9 && changeset.classifications.contextual === 1, changeset.classifications, { authoritativeWithScope: 9, contextual: 1 });
check('CONTEXTUAL_EXACTLY_CANDIDATE_8', additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').map((source) => source.sourceId).join() === 'CS-LU-CUSTOMS-EUROVIGNETTE-ENFORCEMENT-2026', additions.filter((source) => source.authority.authorityType === 'CONTEXTUAL').map((source) => source.sourceId), ['CS-LU-CUSTOMS-EUROVIGNETTE-ENFORCEMENT-2026']);
check('MEMBERSHIPS_10_UNIQUE_NEW', memberships.length === 10 && new Set(memberships.map((item) => item.membershipId)).size === 10 && memberships.every((item) => !viewMembershipIds.has(item.membershipId)), memberships.length, 10);
check('MEMBERSHIPS_SOURCE_IDS_EXACT', memberships.every((item) => additionById.has(item.sourceId)) && new Set(memberships.map((item) => item.sourceId)).size === 10, memberships.map((item) => item.sourceId), additions.map((source) => source.sourceId));
check('COLLISION_CHECKS_ALL_PASS', Object.values(changeset.collisionChecks).every(Boolean), changeset.collisionChecks, 'all true');
check('PROJECTED_COUNTS_841_289', changeset.projected.registryCount === 841 && changeset.projected.routingTollViewCount === 289, { registry: changeset.projected.registryCount, view: changeset.projected.routingTollViewCount }, { registry: 841, view: 289 });
check('PROJECTED_REGISTRY_HASH_RECOMPUTED', changeset.projected.registrySha256 === sha(stableJson(projectedRegistry)), changeset.projected.registrySha256, sha(stableJson(projectedRegistry)));
check('PROJECTED_VIEW_HASH_RECOMPUTED', changeset.projected.routingTollViewSha256 === sha(stableJson(projectedView)), changeset.projected.routingTollViewSha256, sha(stableJson(projectedView)));
check('PROJECTED_UNIQUE_HASH_DELTA_10', changeset.projected.routingTollViewUniqueContentHashes === projectedContentHashes.size && changeset.projected.uniqueContentHashDelta === 10, changeset.projected, { routingTollViewUniqueContentHashes: projectedContentHashes.size, uniqueContentHashDelta: 10 });
check('EXISTING_REGISTRY_RECORDS_PRESERVED_IN_PROJECTION', JSON.stringify(projectedRegistry.sources.slice(0, registry.sources.length)) === JSON.stringify(registry.sources), projectedRegistry.sources.slice(0, registry.sources.length).length, registry.sources.length);
check('EXISTING_VIEW_RECORDS_PRESERVED_IN_PROJECTION', JSON.stringify(projectedView.memberships.slice(0, view.memberships.length)) === JSON.stringify(view.memberships), projectedView.memberships.slice(0, view.memberships.length).length, view.memberships.length);
check('IMPACT_EXISTING_MODIFICATIONS_ZERO', impact.existingRegistrySourcesModified === 0 && impact.existingViewMembershipsModified === 0 && impact.protectedExistingRecords.registrySourcesPreserved === 831 && impact.protectedExistingRecords.viewMembershipsPreserved === 279, { existingRegistrySourcesModified: impact.existingRegistrySourcesModified, existingViewMembershipsModified: impact.existingViewMembershipsModified }, { existingRegistrySourcesModified: 0, existingViewMembershipsModified: 0 });

check('CH_RECAPTURE_RESOLVED_SATISFIED', recapture.blockerState === 'RESOLVED' && recapture.applyCondition === 'SATISFIED' && recapture.officialProvenanceOnly === true, { blockerState: recapture.blockerState, applyCondition: recapture.applyCondition, officialProvenanceOnly: recapture.officialProvenanceOnly }, { blockerState: 'RESOLVED', applyCondition: 'SATISFIED', officialProvenanceOnly: true });
check('CH_BROWSER_GATE_PASS', browser.verdict === 'PASS' && browser.browserPluginStatus === 'PASS' && browser.browserSessionStatus === 'PASS' && browser.targetPageStatus === 'PASS' && browser.checks.every((item) => item.pass), { verdict: browser.verdict, browserPluginStatus: browser.browserPluginStatus, browserSessionStatus: browser.browserSessionStatus, targetPageStatus: browser.targetPageStatus }, 'all mandatory browser gates PASS');
check('CH_BROWSER_REPORT_HASH', recapture.browserEvidence.reportSha256 === fileSha(recapture.browserEvidence.reportPath), recapture.browserEvidence.reportSha256, fileSha(recapture.browserEvidence.reportPath));
check('CH_ARTIFACTS_ALL_HASH_AND_SIZE', recapture.artifacts.length === 5 && recapture.artifacts.every((artifact) => fileSha(artifact.path) === artifact.sha256 && bytes(artifact.path).length === artifact.sizeBytes), recapture.artifacts.length, 5);
check('CH_OFFICIAL_PRIMARY_HASH_EXACT', recapture.artifacts.find((item) => item.role === 'primary')?.sha256 === 'fc6f19ae9ec162f08542bca6fbfc065ddb7d3939567bf04bd91682ffa7350ffc', recapture.artifacts.find((item) => item.role === 'primary')?.sha256, 'fc6f19ae9ec162f08542bca6fbfc065ddb7d3939567bf04bd91682ffa7350ffc');
check('CH_OFFICIAL_VIA_HASH_EXACT', recapture.artifacts.find((item) => item.role === 'viaProduct')?.sha256 === '9075cfb58828ffae99b55f65f2123b1b097d56127e9395b0f449bb1c7f75da07', recapture.artifacts.find((item) => item.role === 'viaProduct')?.sha256, '9075cfb58828ffae99b55f65f2123b1b097d56127e9395b0f449bb1c7f75da07');
check('CH_SCOPE_PRICE_PERIOD_RECONCILED', recapture.validatedClaims.price === 'CHF 40' && recapture.validatedClaims.effectiveFrom === '2025-12-01' && recapture.validatedClaims.effectiveUntil === '2027-01-31' && /3\.5 tonnes/.test(recapture.validatedClaims.scope), recapture.validatedClaims, 'CHF 40; <=3.5t; 2025-12-01 through 2027-01-31');
check('CH_PRIOR_INVALID_NOT_REUSED', recapture.priorInvalidArtifact.preservedInPriorHistoricalPackage === true && recapture.priorInvalidArtifact.reused === false, recapture.priorInvalidArtifact, 'preserved historical; not reused');
check('CH_BLUEPRINT_ELIGIBLE_AFTER_RECAPTURE', blueprintByCandidate.get('RT001-RES-CH-VIGNETTE-2026')?.applyCondition === 'SATISFIED' && blueprintByCandidate.get('RT001-RES-CH-VIGNETTE-2026')?.applyEligibility === 'ELIGIBLE_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED', blueprintByCandidate.get('RT001-RES-CH-VIGNETTE-2026')?.applyEligibility, 'ELIGIBLE_FOR_PRODUCT_OWNER_APPLY_REVIEW_NOT_AUTHORIZED');

const nl = additionById.get('CS-NL-GOV-TRUCK-TOLL-RATES-2026');
const dk = additionById.get('CS-DK-KMTOLL-TARIFF-TABLE-V1-2');
check('NL_WINDOW_EXACT', nl?.freshness.effectiveFrom === '2026-07-01' && nl?.freshness.effectiveUntil === '2026-08-31', nl?.freshness, { effectiveFrom: '2026-07-01', effectiveUntil: '2026-08-31' });
check('NL_EXPIRY_WARNING_REVIEW_REQUIRED', nl?.freshness.currentStatus === 'EXPIRY_WARNING' && nl?.freshness.reviewRequired === true && nl?.freshness.nextFreshnessCheck === '2026-08-31', nl?.freshness, 'EXPIRY_WARNING/review required/2026-08-31');
check('NL_AFTER_WINDOW_UNKNOWN_NOT_ZERO', decisionByCandidate.get('RT001-RES-NL-TRUCK-RATES-2026')?.generic2026UseAuthorized === false && /UNKNOWN/.test(nl?.freshness.usageFallback ?? '') && !/ZERO/.test(nl?.freshness.usageFallback ?? ''), nl?.freshness.usageFallback, 'UNKNOWN_HUMAN_VERIFICATION, never ZERO');
check('DK_Q3_FRESHNESS_TRIGGER', dk?.freshness.effectiveUntil === null && dk?.freshness.nextFreshnessCheck === '2026-09-30' && /Q3 2026/.test(dk?.version ?? ''), { freshness: dk?.freshness, version: dk?.version }, 'no invented expiry; Q3 check 2026-09-30');
check('DK_NO_AUTOMATIC_EXTENSION', /no automatic extension/i.test(packageData.sourceFreshnessPolicy.dkFreshnessTrigger), packageData.sourceFreshnessPolicy.dkFreshnessTrigger, 'Q3 2026; no automatic extension');

const requiredStates = ['CURRENT', 'EXPIRY_WARNING', 'NEW_VERSION_DETECTED', 'SUPERSEDED_PENDING_REVIEW', 'REVIEW_REQUIRED', 'EXPIRED_REVIEW_REQUIRED', 'FRESHNESS_UNKNOWN'];
check('FRESHNESS_STATE_MACHINE_COMPLETE', requiredStates.every((state) => freshnessPolicy.includes(state)), requiredStates.filter((state) => !freshnessPolicy.includes(state)), []);
check('FRESHNESS_THRESHOLDS_COMPLETE', ['EXPIRY_30_DAYS', 'EXPIRY_14_DAYS', 'EXPIRY_7_DAYS', 'EXPIRY_1_DAY', 'EXPIRY_DAY'].every((threshold) => freshnessTriggerMatrix.includes(threshold)), '30/14/7/1/0', 'all thresholds represented');
check('NEW_SOURCE_NEVER_AUTO_PROMOTED', freshnessPolicy.includes('NEW SOURCE DETECTED') && /AUTO PROMOTION/.test(freshnessPolicy), 'policy principle present', true);
check('UNKNOWN_NEVER_ZERO_OR_SAFE_PASS', freshnessPolicy.includes('UNKNOWN') && freshnessPolicy.includes('ZERO') && /SAFE/.test(freshnessPolicy), 'policy principle present', true);
check('FRESHNESS_TEST_SUITE_PASS', freshnessReport.results.contractTests.status === 'PASS' && freshnessReport.results.contractTests.passed === 16 && freshnessReport.results.contractTests.total === 16, freshnessReport.results.contractTests, { status: 'PASS', passed: 16, total: 16 });
check('FRESHNESS_VALIDATOR_PASS', freshnessReport.results.readOnlyValidator.status === 'PASS' && freshnessReport.results.readOnlyValidator.passed === 44 && freshnessReport.results.readOnlyValidator.total === 44, freshnessReport.results.readOnlyValidator, { status: 'PASS', passed: 44, total: 44 });
check('EMAIL_DEDUP_TEST_COVERED', freshnessReport.results.coveredTests.includes('email dedup and new-threshold behavior'), freshnessReport.results.coveredTests, 'email dedup and new-threshold behavior');
check('NO_PROMOTION_TEST_COVERED', freshnessReport.results.coveredTests.includes('no automatic authority promotion'), freshnessReport.results.coveredTests, 'no automatic authority promotion');
check('UNKNOWN_NOT_ZERO_TEST_COVERED', freshnessReport.results.coveredTests.includes('UNKNOWN != ZERO'), freshnessReport.results.coveredTests, 'UNKNOWN != ZERO');

check('EMAIL_DESTINATIONS_CONFIGURED_LOCALLY', destinationConfigured, { configured: destinationConfigured, recipientCount: recipients.length }, { configured: true, recipientCount: 2 });
check('EMAIL_SENDER_CONFIGURED_AND_MATCHES_PRIMARY', senderConfigured && senderMatchesPrimary, { configured: senderConfigured, matchesPrimary: senderMatchesPrimary }, { configured: true, matchesPrimary: true });
check('EMAIL_AUTH_NOT_CONFIGURED', gmailAuthConfigured === false, { configured: gmailAuthConfigured }, { configured: false });
check('EMAIL_GATE_EXACT_AND_SCOPED', packageData.emailRuntimeGate.status === 'BLOCKED_CONFIGURATION_REQUIRED' && packageData.emailRuntimeGate.scope === 'EMAIL_DELIVERY_ONLY' && packageData.emailRuntimeGate.deliveryTest === 'NOT_EXECUTED_AUTHENTICATION_NOT_CONFIGURED', packageData.emailRuntimeGate, 'email delivery only blocked; no send');
check('PROTECTED_MUTATIONS_NONE', packageData.guardrails.registryMutation === 'NONE' && packageData.guardrails.routingTollViewMutation === 'NONE' && packageData.guardrails.authorityPromotion === 'NONE' && packageData.guardrails.runtimeProduction === 'NO_CHANGE', packageData.guardrails, 'all protected states unchanged');
check('APPLY_NOT_EXECUTED', changeset.status === 'FINAL_PRE_APPLY_INFORMATIONAL_NOT_AUTHORIZED_NOT_EXECUTED' && changeset.atomicApplyAuthorized === false && changeset.executed === false && packageData.guardrails.atomicApply === 'NOT_EXECUTED', { status: changeset.status, authorized: changeset.atomicApplyAuthorized, executed: changeset.executed }, 'not authorized/not executed');
check('COMMIT_PUSH_NOT_EXECUTED', packageData.guardrails.commitPush === 'NOT_EXECUTED', packageData.guardrails.commitPush, 'NOT_EXECUTED');

const result = {
  validator: 'ROUTING-TOLL-001_FINAL_CONSOLIDATED_PRE_APPLY_READ_ONLY', validationBasis: generatedAt,
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length, passedCount: checks.filter((item) => item.pass).length, failedCount: checks.filter((item) => !item.pass).length,
  checks,
  exactImpact: {
    operations: changeset.operations,
    registry: { baselineCount: registry.sourceCount, projectedCount: changeset.projected.registryCount, projectedSha256: changeset.projected.registrySha256 },
    routingTollView: { baselineCount: view.sourceCount, projectedCount: changeset.projected.routingTollViewCount, projectedSha256: changeset.projected.routingTollViewSha256 },
  },
  emailDeliveryGate: {
    status: packageData.emailRuntimeGate.status,
    recipientConfiguration: destinationConfigured ? 'PASS' : 'FAIL', recipientCount: recipients.length,
    senderConfiguration: senderConfigured && senderMatchesPrimary ? 'PASS' : 'FAIL',
    authenticationConfigured: gmailAuthConfigured, emailSent: false,
  },
  protectedFiles: {
    registry: { count: registry.sourceCount, sha256: fileSha(registryPath), mutation: 'NONE' },
    routingTollView: { count: view.sourceCount, sha256: fileSha(viewPath), mutation: 'NONE' },
  },
};
console.log(JSON.stringify(result, null, 2));
if (result.verdict !== 'PASS') process.exitCode = 1;

function parseEnv(value) {
  const parsed = {};
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator < 1) continue;
    const key = normalized.slice(0, separator).trim();
    let envValue = normalized.slice(separator + 1).trim();
    if ((envValue.startsWith('"') && envValue.endsWith('"')) || (envValue.startsWith("'") && envValue.endsWith("'"))) envValue = envValue.slice(1, -1);
    parsed[key] = envValue;
  }
  return parsed;
}
function splitRecipients(value = '') { return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean); }
