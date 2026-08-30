import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packageRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CONSOLIDATED_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const packagePath = `${packageRoot}/FINAL_PRE_APPLY_PACKAGE.json`;
const changesetPath = `${packageRoot}/FINAL_ATOMIC_CHANGESET.json`;
const decisionsPath = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_CLOSURE_ACQUISITION/PRODUCT_OWNER_AUTHORITY_DECISIONS.json';
const recapturePath = `${packageRoot}/CH_VIGNETTE_RECAPTURE_MANIFEST.json`;
const expected = {
  packageSha256: '9047cb3e0c11ec9bd7f7133df397ad0bed2bc3b6e6f4bcca591d186bf219eac7',
  changesetSha256: '1b3654578a99cca7fbae5761fed27c4ff4c8a9b57a4db53bc80f2163ea12c04a',
  registrySha256: '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076',
  viewSha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
};

const bytes = (relative) => readFileSync(path.join(root, relative));
const text = (relative) => bytes(relative).toString('utf8').replace(/^\uFEFF/, '');
const json = (relative) => JSON.parse(text(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const fileSha = (relative) => sha(bytes(relative));

const registry = json(registryPath);
const view = json(viewPath);
const packageData = json(packagePath);
const changeset = json(changesetPath);
const decisions = json(decisionsPath);
const recapture = json(recapturePath);
const additions = changeset.additions;
const memberships = changeset.routingTollMembershipAdditions;
const additionIds = new Set(additions.map((source) => source.sourceId));
const liveAdditionSources = registry.sources.filter((source) => additionIds.has(source.sourceId));
const membershipIds = new Set(memberships.map((membership) => membership.membershipId));
const liveAddedMemberships = view.memberships.filter((membership) => membershipIds.has(membership.membershipId));
const liveById = new Map(liveAdditionSources.map((source) => [source.sourceId, source]));
const env = parseEnv(existsSync(path.join(root, '.env')) ? text('.env') : '');
const recipients = (env.AGM_PRODUCT_OWNER_ALERT_EMAIL ?? '').split(/[;,]/).map((value) => value.trim()).filter(Boolean);
const authConfigured = Boolean(env.GMAIL_ACCESS_TOKEN?.trim()) || Boolean(env.GMAIL_OAUTH_CLIENT_ID?.trim() && env.GMAIL_OAUTH_CLIENT_SECRET?.trim() && env.GMAIL_OAUTH_REFRESH_TOKEN?.trim());

const checks = [];
const check = (name, pass, actual, expectedValue) => checks.push({ name, pass, actual, expected: expectedValue });
check('FINAL_PACKAGE_HASH_BOUND', fileSha(packagePath) === expected.packageSha256, fileSha(packagePath), expected.packageSha256);
check('FINAL_CHANGESET_HASH_BOUND', fileSha(changesetPath) === expected.changesetSha256, fileSha(changesetPath), expected.changesetSha256);
check('DECISIONS_10_OF_10_APPROVE', decisions.summary.total === 10 && decisions.summary.approved === 10 && decisions.summary.rejected === 0 && decisions.summary.deferred === 0 && decisions.summary.pending === 0, decisions.summary, { total: 10, approved: 10, rejected: 0, deferred: 0, pending: 0 });
check('CLASSIFICATIONS_9_1_DECISIONS', decisions.decisions.filter((decision) => decision.classification === 'AUTHORITATIVE_WITH_SCOPE').length === 9 && decisions.decisions.filter((decision) => decision.classification === 'CONTEXTUAL').length === 1, '9/1', '9/1');
check('CHANGESET_OPERATIONS_10_0_0', changeset.operations.add === 10 && changeset.operations.modify === 0 && changeset.operations.delete === 0, changeset.operations, { add: 10, modify: 0, delete: 0 });
check('CHANGESET_COLLISIONS_PREVALIDATED', Object.values(changeset.collisionChecks).every(Boolean), changeset.collisionChecks, 'all true');
check('REGISTRY_COUNT_841', registry.sourceCount === 841 && registry.sources.length === 841, `${registry.sourceCount}/${registry.sources.length}`, '841/841');
check('VIEW_COUNT_289', view.sourceCount === 289 && view.memberships.length === 289, `${view.sourceCount}/${view.memberships.length}`, '289/289');
check('REGISTRY_HASH_EXACT', fileSha(registryPath) === expected.registrySha256, fileSha(registryPath), expected.registrySha256);
check('VIEW_HASH_EXACT', fileSha(viewPath) === expected.viewSha256, fileSha(viewPath), expected.viewSha256);
check('REGISTRY_VERSION_APPLIED', registry.registryVersion === '1.3.0' && registry.generatedAt === changeset.generatedAt, { version: registry.registryVersion, generatedAt: registry.generatedAt }, { version: '1.3.0', generatedAt: changeset.generatedAt });
check('VIEW_VERSION_APPLIED', view.viewVersion === '1.3.0' && view.generatedAt === changeset.generatedAt, { version: view.viewVersion, generatedAt: view.generatedAt }, { version: '1.3.0', generatedAt: changeset.generatedAt });
check('TEN_SOURCE_ADDITIONS_PRESENT_ONCE', liveAdditionSources.length === 10 && additions.every((source) => registry.sources.filter((live) => live.sourceId === source.sourceId).length === 1), liveAdditionSources.length, 10);
check('TEN_MEMBERSHIPS_PRESENT_ONCE', liveAddedMemberships.length === 10 && memberships.every((membership) => view.memberships.filter((live) => live.membershipId === membership.membershipId).length === 1), liveAddedMemberships.length, 10);
check('SOURCE_OBJECTS_EXACTLY_MATCH_CHANGESET', additions.every((source) => JSON.stringify(liveById.get(source.sourceId)) === JSON.stringify(source)), additions.filter((source) => JSON.stringify(liveById.get(source.sourceId)) !== JSON.stringify(source)).map((source) => source.sourceId), []);
check('SOURCE_TAIL_EXACTLY_CHANGESET', JSON.stringify(registry.sources.slice(-10)) === JSON.stringify(additions), registry.sources.slice(-10).map((source) => source.sourceId), additions.map((source) => source.sourceId));
check('MEMBERSHIP_TAIL_EXACTLY_CHANGESET', JSON.stringify(view.memberships.slice(-10)) === JSON.stringify(memberships), view.memberships.slice(-10).map((membership) => membership.membershipId), memberships.map((membership) => membership.membershipId));
check('LIVE_CLASSIFICATIONS_9_1', liveAdditionSources.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 9 && liveAdditionSources.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length === 1, '9/1', '9/1');
check('CONTEXTUAL_SOURCE_EXACT', liveAdditionSources.filter((source) => source.authority.authorityType === 'CONTEXTUAL').map((source) => source.sourceId).join() === 'CS-LU-CUSTOMS-EUROVIGNETTE-ENFORCEMENT-2026', liveAdditionSources.filter((source) => source.authority.authorityType === 'CONTEXTUAL').map((source) => source.sourceId), ['CS-LU-CUSTOMS-EUROVIGNETTE-ENFORCEMENT-2026']);
check('NEW_HASHES_GLOBALLY_UNIQUE', additions.every((source) => registry.sources.filter((live) => live.sha256 === source.sha256).length === 1), additions.filter((source) => registry.sources.filter((live) => live.sha256 === source.sha256).length !== 1).map((source) => source.sourceId), []);
check('NEW_CANONICAL_URIS_GLOBALLY_UNIQUE', additions.every((source) => registry.sources.filter((live) => live.canonicalUri === source.canonicalUri).length === 1), additions.filter((source) => registry.sources.filter((live) => live.canonicalUri === source.canonicalUri).length !== 1).map((source) => source.sourceId), []);
check('ALL_PRIMARY_ARTIFACTS_STILL_INTEGRAL', additions.every((source) => fileSha(source.canonicalPath) === source.sha256 && bytes(source.canonicalPath).length === source.sizeBytes), additions.filter((source) => fileSha(source.canonicalPath) !== source.sha256 || bytes(source.canonicalPath).length !== source.sizeBytes).map((source) => source.sourceId), []);
check('ALL_14_INVENTORY_ARTIFACTS_INTEGRAL', changeset.artifactInventory.length === 14 && changeset.artifactInventory.every((artifact) => fileSha(artifact.path) === artifact.sha256 && bytes(artifact.path).length === artifact.sizeBytes), changeset.artifactInventory.length, 14);
check('TRACEABILITY_TO_DECISION_REGISTER', additions.every((source) => source.provenance.importedFrom === decisionsPath && source.evidenceRefs.includes(decisionsPath) && source.evidenceRefs.includes(source.canonicalUri)), additions.filter((source) => source.provenance.importedFrom !== decisionsPath || !source.evidenceRefs.includes(decisionsPath) || !source.evidenceRefs.includes(source.canonicalUri)).map((source) => source.sourceId), []);
check('FRESHNESS_METADATA_ALL_10', additions.every((source) => source.freshness?.policyVersion === 'agm-source-freshness.v1' && source.freshness.lastFreshnessCheck && Object.hasOwn(source.freshness, 'effectiveUntil') && Object.hasOwn(source.freshness, 'reviewRequired')), additions.filter((source) => source.freshness?.policyVersion !== 'agm-source-freshness.v1').map((source) => source.sourceId), []);
const nl = liveById.get('CS-NL-GOV-TRUCK-TOLL-RATES-2026');
const dk = liveById.get('CS-DK-KMTOLL-TARIFF-TABLE-V1-2');
const ch = liveById.get('CS-CH-BAZG-MOTORWAY-VIGNETTE-2026');
check('NL_WINDOW_EXACT', nl?.freshness.effectiveFrom === '2026-07-01' && nl?.freshness.effectiveUntil === '2026-08-31', nl?.freshness, '2026-07-01 through 2026-08-31');
check('NL_EXPIRY_REVIEW_GUARD', nl?.freshness.currentStatus === 'EXPIRY_WARNING' && nl?.freshness.reviewRequired === true && /UNKNOWN/.test(nl?.freshness.usageFallback ?? '') && !/ZERO/.test(nl?.freshness.usageFallback ?? ''), nl?.freshness, 'EXPIRY_WARNING/review required/UNKNOWN never ZERO');
check('DK_Q3_TRIGGER_NO_INVENTED_EXPIRY', dk?.freshness.effectiveUntil === null && dk?.freshness.nextFreshnessCheck === '2026-09-30' && /Q3 2026/.test(dk?.version ?? ''), { freshness: dk?.freshness, version: dk?.version }, 'Q3 trigger; no automatic expiry/extension');
check('CH_APPLY_CONDITION_SATISFIED', recapture.blockerState === 'RESOLVED' && recapture.applyCondition === 'SATISFIED' && recapture.officialProvenanceOnly === true, { blockerState: recapture.blockerState, applyCondition: recapture.applyCondition }, { blockerState: 'RESOLVED', applyCondition: 'SATISFIED' });
check('CH_SCOPE_PRICE_PERIOD_EXACT', recapture.validatedClaims.price === 'CHF 40' && recapture.validatedClaims.effectiveFrom === '2025-12-01' && recapture.validatedClaims.effectiveUntil === '2027-01-31' && /3\.5 tonnes/.test(recapture.validatedClaims.scope), recapture.validatedClaims, 'CHF 40; <=3.5t; 2025-12-01 through 2027-01-31');
check('CH_LIVE_SOURCE_HASH_EXACT', ch?.sha256 === 'fc6f19ae9ec162f08542bca6fbfc065ddb7d3939567bf04bd91682ffa7350ffc', ch?.sha256, 'fc6f19ae9ec162f08542bca6fbfc065ddb7d3939567bf04bd91682ffa7350ffc');
check('VIEW_UNIQUE_CONTENT_HASHES_274', view.uniqueContentHashes === 274, view.uniqueContentHashes, 274);
const sourceHashById = new Map(registry.sources.map((source) => [source.sourceId, source.sha256]));
const recomputedViewHashes = new Set(view.memberships.map((membership) => sourceHashById.get(membership.sourceId)).filter(Boolean));
check('VIEW_UNIQUE_CONTENT_HASHES_RECOMPUTED', recomputedViewHashes.size === view.uniqueContentHashes, recomputedViewHashes.size, view.uniqueContentHashes);
check('PACKAGE_DECISION_SNAPSHOTS_10', packageData.blueprints.length === 10 && packageData.blueprints.every((blueprint) => JSON.stringify(blueprint.productOwnerDecisionSnapshot) === JSON.stringify(decisions.decisions.find((decision) => decision.candidateId === blueprint.candidateId))), packageData.blueprints.length, 10);
check('EMAIL_RECIPIENTS_CONFIGURED', recipients.length === 2 && new Set(recipients.map((value) => value.toLowerCase())).size === 2, { configured: recipients.length === 2, recipientCount: recipients.length }, { configured: true, recipientCount: 2 });
check('EMAIL_SENDER_CONFIGURED', Boolean(env.GMAIL_FROM_ADDRESS?.trim()) && env.GMAIL_FROM_ADDRESS.trim().toLowerCase() === recipients[0]?.toLowerCase(), { configured: Boolean(env.GMAIL_FROM_ADDRESS?.trim()), matchesPrimary: env.GMAIL_FROM_ADDRESS?.trim().toLowerCase() === recipients[0]?.toLowerCase() }, { configured: true, matchesPrimary: true });
check('EMAIL_DELIVERY_DEPENDENCY_SEPARATE', authConfigured === false && packageData.emailRuntimeGate.scope === 'EMAIL_DELIVERY_ONLY', { authenticationConfigured: authConfigured, scope: packageData.emailRuntimeGate.scope }, { authenticationConfigured: false, scope: 'EMAIL_DELIVERY_ONLY' });
check('EMAIL_NOT_SENT_BY_ATOMIC_APPLY', packageData.emailRuntimeGate.deliveryTest === 'NOT_EXECUTED_AUTHENTICATION_NOT_CONFIGURED', packageData.emailRuntimeGate.deliveryTest, 'NOT_EXECUTED_AUTHENTICATION_NOT_CONFIGURED');
check('NO_TRANSACTION_RESIDUE', !existsSync(path.join(root, `${registryPath}.routing-toll-001-stage`)) && !existsSync(path.join(root, `${viewPath}.routing-toll-001-stage`)) && !existsSync(path.join(root, `${registryPath}.routing-toll-001-backup`)) && !existsSync(path.join(root, `${viewPath}.routing-toll-001-backup`)) && !existsSync(path.join(root, `${packageRoot}/.atomic-apply.lock`)), 'none', 'none');
check('EXACT_PROJECTED_HASHES_REALIZED', changeset.projected.registrySha256 === fileSha(registryPath) && changeset.projected.routingTollViewSha256 === fileSha(viewPath), { registry: fileSha(registryPath), view: fileSha(viewPath) }, { registry: changeset.projected.registrySha256, view: changeset.projected.routingTollViewSha256 });
check('NO_PARTIAL_9_OF_10_STATE', liveAdditionSources.length === 10 && liveAddedMemberships.length === 10, { sources: liveAdditionSources.length, memberships: liveAddedMemberships.length }, { sources: 10, memberships: 10 });

const failed = checks.filter((item) => !item.pass);
const result = {
  validator: 'ROUTING-TOLL-001_FINAL_ATOMIC_CLOSURE_READ_ONLY',
  validationMode: 'READ_ONLY_POST_APPLY',
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  summary: { passed: checks.length - failed.length, total: checks.length, failed: failed.length },
  checks,
  appliedState: {
    operations: { add: 10, modify: 0, delete: 0 },
    registry: { count: registry.sourceCount, sha256: fileSha(registryPath) },
    routingTollView: { count: view.sourceCount, uniqueContentHashes: view.uniqueContentHashes, sha256: fileSha(viewPath) },
  },
  emailDelivery: { status: 'BLOCKED_CONFIGURATION_REQUIRED', scope: 'EMAIL_DELIVERY_ONLY', authenticationConfigured: authConfigured, emailSent: false },
};
console.log(JSON.stringify(result, null, 2));
if (failed.length) process.exitCode = 1;

function parseEnv(value) {
  const parsed = {};
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let envValue = line.slice(separator + 1).trim();
    if ((envValue.startsWith('"') && envValue.endsWith('"')) || (envValue.startsWith("'") && envValue.endsWith("'"))) envValue = envValue.slice(1, -1);
    parsed[key] = envValue;
  }
  return parsed;
}
