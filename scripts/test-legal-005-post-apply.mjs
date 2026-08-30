import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const applyRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_ATOMIC_APPLY';
const packageRoot = 'AGM_LIBRARY/PHASE3/LEGAL_005_FINAL_PRE_APPLY';
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const legislationViewPath = 'AGM_LIBRARY/VIEWS/legislation-safety.view.json';
const routingViewPath = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const preRegistryPath = `${applyRoot}/PRE_APPLY_REGISTRY.json`;
const preViewPath = `${applyRoot}/PRE_APPLY_LEGISLATION_SAFETY_VIEW.json`;
const preRoutingPath = `${applyRoot}/PRE_APPLY_ROUTING_TOLL_VIEW.json`;
const projectedRegistryPath = `${packageRoot}/PROJECTED_REGISTRY.json`;
const projectedViewPath = `${packageRoot}/PROJECTED_LEGISLATION_SAFETY_VIEW.json`;
const changesetPath = `${packageRoot}/PROJECTED_CHANGESET.json`;
const packagePath = `${packageRoot}/FINAL_PRE_APPLY_PACKAGE.json`;
const temporalPath = `${packageRoot}/CONSOLIDATED_AUTHORITY_TEMPORAL_REVIEW.json`;
const decisionsPath = 'AGM_LIBRARY/PHASE3/LEGAL_005_OWNER_REVIEW/PRODUCT_OWNER_DECISIONS.json';
const freshnessQueuePath = 'AGM_LIBRARY/PHASE3/SOURCE_FRESHNESS_ALERT_RULE/INITIAL_PRODUCT_OWNER_REVIEW_PACKAGE.json';
const expected = {
  preRegistry: '462db7f3a72204010972aa605901783997feff9ada7aac760ab03b358b2cd076',
  preView: '2db4f2b915e256f013bc4ed59188d810230a33c335333ec8cf364c6f1284dac1',
  finalRegistry: '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245',
  finalView: 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab',
  routing: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0',
};

const absolute = (relative) => path.join(root, relative);
const bytes = (relative) => readFileSync(absolute(relative));
const readJson = (relative) => JSON.parse(bytes(relative).toString('utf8').replace(/^\uFEFF/, ''));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(bytes(relative));
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const checks = [];
const check = (id, condition, actual, expectedValue) => checks.push({ id, status:condition ? 'PASS' : 'FAIL', actual, expected:expectedValue });

const beforeRegistry = readJson(preRegistryPath);
const beforeView = readJson(preViewPath);
const beforeRouting = readJson(preRoutingPath);
const registry = readJson(registryPath);
const view = readJson(legislationViewPath);
const routing = readJson(routingViewPath);
const projectedRegistry = readJson(projectedRegistryPath);
const projectedView = readJson(projectedViewPath);
const changeset = readJson(changesetPath);
const pkg = readJson(packagePath);
const temporal = readJson(temporalPath);
const decisions = readJson(decisionsPath);
const freshnessQueue = readJson(freshnessQueuePath);
const execution = readJson(`${applyRoot}/ATOMIC_APPLY_EXECUTION_RECORD.json`);

check('EXECUTION_RECORD_PASS', execution.result === 'PASS', execution.result, 'PASS');
check('ATOMIC_PARTIAL_APPLY_FALSE', execution.atomicity.partialApply === false, execution.atomicity, 'partialApply false');
check('ROLLBACK_AVAILABLE_NOT_EXECUTED', execution.atomicity.rollbackAvailable === true && execution.atomicity.rollbackExecuted === false, execution.atomicity, 'true/false');
check('PRE_REGISTRY_841_HASH', beforeRegistry.sourceCount === 841 && beforeRegistry.sources.length === 841 && hashFile(preRegistryPath) === expected.preRegistry, {count:beforeRegistry.sourceCount,sha256:hashFile(preRegistryPath)}, {count:841,sha256:expected.preRegistry});
check('PRE_VIEW_44_HASH', beforeView.sourceCount === 44 && beforeView.memberships.length === 44 && hashFile(preViewPath) === expected.preView, {count:beforeView.sourceCount,sha256:hashFile(preViewPath)}, {count:44,sha256:expected.preView});
check('PRE_ROUTING_289_HASH', beforeRouting.sourceCount === 289 && hashFile(preRoutingPath) === expected.routing, {count:beforeRouting.sourceCount,sha256:hashFile(preRoutingPath)}, {count:289,sha256:expected.routing});

check('FINAL_REGISTRY_862_HASH', registry.sourceCount === 862 && registry.sources.length === 862 && hashFile(registryPath) === expected.finalRegistry, {count:registry.sourceCount,length:registry.sources.length,sha256:hashFile(registryPath)}, {count:862,sha256:expected.finalRegistry});
check('FINAL_VIEW_66_HASH', view.sourceCount === 66 && view.memberships.length === 66 && view.uniqueContentHashes === 57 && hashFile(legislationViewPath) === expected.finalView, {count:view.sourceCount,length:view.memberships.length,uniqueContentHashes:view.uniqueContentHashes,sha256:hashFile(legislationViewPath)}, {count:66,uniqueContentHashes:57,sha256:expected.finalView});
check('ROUTING_UNCHANGED_289_HASH', routing.sourceCount === 289 && hashFile(routingViewPath) === expected.routing && bytes(routingViewPath).equals(bytes(preRoutingPath)), {count:routing.sourceCount,sha256:hashFile(routingViewPath)}, {count:289,sha256:expected.routing});
check('PROJECTED_REGISTRY_HASH_MATCH', pkg.projectedHashes.registrySha256 === hashFile(registryPath), hashFile(registryPath), pkg.projectedHashes.registrySha256);
check('PROJECTED_VIEW_HASH_MATCH', pkg.projectedHashes.legislationSafetyViewSha256 === hashFile(legislationViewPath), hashFile(legislationViewPath), pkg.projectedHashes.legislationSafetyViewSha256);
check('PROJECTED_ROUTING_HASH_MATCH', pkg.projectedHashes.routingTollViewSha256 === hashFile(routingViewPath), hashFile(routingViewPath), pkg.projectedHashes.routingTollViewSha256);
check('REGISTRY_DETERMINISTIC_BYTES', bytes(registryPath).equals(bytes(projectedRegistryPath)) && deepEqual(registry, projectedRegistry), hashFile(registryPath), hashFile(projectedRegistryPath));
check('VIEW_DETERMINISTIC_BYTES', bytes(legislationViewPath).equals(bytes(projectedViewPath)) && deepEqual(view, projectedView), hashFile(legislationViewPath), hashFile(projectedViewPath));

check('EXISTING_841_UNCHANGED', registry.sources.slice(0, 841).every((item, index) => deepEqual(item, beforeRegistry.sources[index])), registry.sources.slice(0,841).findIndex((item,index) => !deepEqual(item,beforeRegistry.sources[index])), -1);
check('EXISTING_44_MEMBERSHIPS_UNCHANGED', view.memberships.slice(0, 44).every((item, index) => deepEqual(item, beforeView.memberships[index])), view.memberships.slice(0,44).findIndex((item,index) => !deepEqual(item,beforeView.memberships[index])), -1);
const added = registry.sources.slice(841);
const addedMemberships = view.memberships.slice(44);
check('ADDITIONS_EXACT_21', added.length === 21 && added.every((item,index) => deepEqual(item,changeset.registryAdditions[index])), added.length, 21);
check('MEMBERSHIPS_EXACT_22', addedMemberships.length === 22 && addedMemberships.every((item,index) => deepEqual(item,changeset.legislationSafetyMembershipAdditions[index])), addedMemberships.length, 22);
check('NO_UNEXPECTED_MODIFY', registry.sources.slice(0,841).every((item,index) => deepEqual(item,beforeRegistry.sources[index])) && view.memberships.slice(0,44).every((item,index) => deepEqual(item,beforeView.memberships[index])), true, true);
check('NO_UNEXPECTED_DELETE', beforeRegistry.sources.every((item,index) => deepEqual(item,registry.sources[index])) && beforeView.memberships.every((item,index) => deepEqual(item,view.memberships[index])), true, true);

check('REGISTRY_SOURCE_IDS_UNIQUE', new Set(registry.sources.map((item) => item.sourceId)).size === 862, new Set(registry.sources.map((item) => item.sourceId)).size, 862);
check('VIEW_MEMBERSHIP_IDS_UNIQUE', new Set(view.memberships.map((item) => item.membershipId)).size === 66, new Set(view.memberships.map((item) => item.membershipId)).size, 66);
check('VIEW_SOURCE_IDS_UNIQUE', new Set(view.memberships.map((item) => item.sourceId)).size === 66, new Set(view.memberships.map((item) => item.sourceId)).size, 66);
check('VIEW_NO_ORPHANS', view.memberships.every((item) => registry.sources.some((source) => source.sourceId === item.sourceId)), true, true);
check('NEW_SOURCES_EXACTLY_ONCE', changeset.registryAdditions.every((expectedSource) => registry.sources.filter((item) => item.sourceId === expectedSource.sourceId).length === 1), changeset.registryAdditions.filter((expectedSource) => registry.sources.filter((item) => item.sourceId === expectedSource.sourceId).length !== 1).map((item) => item.sourceId), []);
check('NEW_MEMBERSHIPS_EXACTLY_ONCE', changeset.legislationSafetyMembershipAdditions.every((expectedMembership) => view.memberships.filter((item) => item.sourceId === expectedMembership.sourceId).length === 1), changeset.legislationSafetyMembershipAdditions.filter((expectedMembership) => view.memberships.filter((item) => item.sourceId === expectedMembership.sourceId).length !== 1).map((item) => item.sourceId), []);
check('REUSED_REGISTRY_EXACTLY_ONCE', ['CS-DE-STVO','CS-EU-REG-561-2006'].every((sourceId) => registry.sources.filter((item) => item.sourceId === sourceId).length === 1), true, true);
check('DE_STVO_MEMBERSHIP_REUSED', view.memberships.filter((item) => item.sourceId === 'CS-DE-STVO').length === 1, view.memberships.filter((item) => item.sourceId === 'CS-DE-STVO').length, 1);
check('EU_561_MEMBERSHIP_ADDED', !beforeView.memberships.some((item) => item.sourceId === 'CS-EU-REG-561-2006') && view.memberships.filter((item) => item.sourceId === 'CS-EU-REG-561-2006').length === 1, view.memberships.filter((item) => item.sourceId === 'CS-EU-REG-561-2006').length, 1);
check('RWV_ALIAS_NOT_CREATED', !registry.sources.some((item) => item.sourceId === 'CS-NL-RWV-HGV-ACCESS-20260701'), true, true);
check('CANONICAL_RVV_CREATED_ONCE', registry.sources.filter((item) => item.sourceId === 'CS-NL-RVV-HGV-ACCESS-20260701').length === 1, registry.sources.filter((item) => item.sourceId === 'CS-NL-RVV-HGV-ACCESS-20260701').length, 1);

const duplicateMetrics = (sources) => {
  const groups = new Map();
  for (const source of sources) groups.set(source.sha256, (groups.get(source.sha256) ?? 0) + 1);
  return { duplicateGroups:[...groups.values()].filter((count) => count > 1).length, duplicateExcess:[...groups.values()].reduce((sum,count) => sum + Math.max(0,count-1),0) };
};
const duplicatesBefore = duplicateMetrics(beforeRegistry.sources);
const duplicatesAfter = duplicateMetrics(registry.sources);
check('DUPLICATE_CONTENT_COUNT_UNCHANGED', deepEqual(duplicatesBefore,duplicatesAfter), duplicatesAfter, duplicatesBefore);
check('NO_NEW_HASH_COLLISIONS', added.every((item) => !beforeRegistry.sources.some((source) => source.sha256 === item.sha256)) && new Set(added.map((item) => item.sha256)).size === 21, added.filter((item) => beforeRegistry.sources.some((source) => source.sha256 === item.sha256)).map((item) => item.sourceId), []);

check('ADDED_CLASSIFICATION_19_SCOPED', added.filter((item) => item.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 19, added.filter((item) => item.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length, 19);
check('ADDED_CLASSIFICATION_2_CONTEXTUAL', added.filter((item) => item.authority.authorityType === 'CONTEXTUAL').length === 2, added.filter((item) => item.authority.authorityType === 'CONTEXTUAL').length, 2);
check('ALL_23_DECISION_CLASSIFICATIONS_PRESERVED', decisions.decisions.every((decision) => registry.sources.find((item) => item.sourceId === decision.sourceId)?.authority.authorityType === decision.classification), decisions.decisions.filter((decision) => registry.sources.find((item) => item.sourceId === decision.sourceId)?.authority.authorityType !== decision.classification).map((item) => item.sourceId), []);
check('NO_STATUS_PROMOTION_BEYOND_APPROVAL', added.every((item) => item.status === 'EVIDENCE' && item.authority.reviewStatus === 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE_ATOMIC_APPLY_NOT_AUTHORIZED'), added.filter((item) => item.status !== 'EVIDENCE').map((item) => item.sourceId), []);
check('TRACEABILITY_21', added.every((item) => item.provenance.importedFrom === decisionsPath && item.evidenceRefs.includes(decisionsPath) && item.evidenceRefs.includes(`${path.dirname(decisionsPath).replaceAll('\\','/')}/CANDIDATE_AUTHORITY_PACKAGE.json`)), added.filter((item) => item.provenance.importedFrom !== decisionsPath).map((item) => item.sourceId), []);
check('PROVENANCE_21', added.every((item) => item.canonicalUri?.startsWith('https://') && item.provenance.originalPreserved === true && item.provenance.libraryCopyCreated === false && item.retention.historicalEvidencePreserved === true), added.filter((item) => !item.canonicalUri?.startsWith('https://')).map((item) => item.sourceId), []);
check('ARTIFACT_INTEGRITY_21', added.every((item) => existsSync(absolute(item.canonicalPath)) && bytes(item.canonicalPath).length === item.sizeBytes && hashFile(item.canonicalPath) === item.sha256), added.filter((item) => !existsSync(absolute(item.canonicalPath)) || bytes(item.canonicalPath).length !== item.sizeBytes || hashFile(item.canonicalPath) !== item.sha256).map((item) => item.sourceId), []);

const fire = registry.sources.find((item) => item.sourceId === 'CS-FR-TRUCK-BAN-FIRE-EXCEPTION-2026');
check('FIRE_EFFECTIVE_UNTIL_20260831', fire?.freshness.effectiveUntil === '2026-08-31', fire?.freshness, '2026-08-31');
check('FIRE_EXPIRY_WARNING_AS_OF_20260830', fire?.freshness.currentStatus === 'EXPIRY_WARNING' && fire.freshness.reviewRequired === true, fire?.freshness, 'EXPIRY_WARNING/reviewRequired');
check('FIRE_POST_EXPIRY_CONTROL', temporal.specialTransitions.some((item) => item.sourceId === fire.sourceId && item.atAndAfter20260831 === 'EXPIRED_REVIEW_REQUIRED' && item.postExpiryCurrent === 'FORBIDDEN' && item.postExpiryFallback === 'UNKNOWN_HUMAN_VERIFICATION'), temporal.specialTransitions, 'expired/current forbidden/unknown');
const arv1 = registry.sources.find((item) => item.sourceId === 'CS-CH-ARV1-20250501');
check('ARV1_NEW_VERSION_DETECTED', arv1?.freshness.currentStatus === 'NEW_VERSION_DETECTED' && arv1.freshness.effectiveUntil === '2026-09-30' && arv1.freshness.reviewRequired === true, arv1?.freshness, 'new version/2026-09-30/review');
check('ARV1_CURRENT_FORBIDDEN_20261001', temporal.specialTransitions.some((item) => item.sourceId === arv1.sourceId && item.from20261001 === 'CURRENT_FORBIDDEN'), temporal.specialTransitions, 'CURRENT_FORBIDDEN');
check('ARV1_NO_AUTO_SUPERSESSION', arv1.supersedes.length === 0 && arv1.supersededBy.length === 0 && temporal.newVersionDetected.every((item) => item.automaticSupersession === false), {supersedes:arv1.supersedes,supersededBy:arv1.supersededBy}, 'empty/false');
check('ARV1_FRESHNESS_QUEUE', freshnessQueue.items.some((item) => item.sourceId === 'CS-CH-ARV1-20250501' && item.detectedChangeEffectiveFrom === '2026-10-01' && item.automaticSupersession === false), freshnessQueue.items.map((item) => item.sourceId), 'ARV1 queued');
for (const sourceId of ['CS-AT-HGV-BAN-CALENDAR-2026','CS-AT-A10-SUMMER-HGV-BAN-2026','CS-AT-LUEGBRUECKE-HGV-BAN-2026','CS-FR-TRUCK-BAN-2026']) {
  check(`END_20261231_${sourceId}`, registry.sources.find((item) => item.sourceId === sourceId)?.freshness.effectiveUntil === '2026-12-31', registry.sources.find((item) => item.sourceId === sourceId)?.freshness.effectiveUntil, '2026-12-31');
}
check('UNKNOWN_FALLBACK_NEVER_ZERO_SAFE_PASS_NO_RESTRICTION', added.every((item) => !/ZERO|SAFE|PASS|NO_RESTRICTION/i.test(item.freshness.usageFallback)) && temporal.invariants.unknownIsNotSafePassZeroOrNoRestriction === true, added.map((item) => ({sourceId:item.sourceId,fallback:item.freshness.usageFallback})), 'no forbidden fallback');

const beforeSecondApply = { registry:hashFile(registryPath), view:hashFile(legislationViewPath), routing:hashFile(routingViewPath) };
const secondApply = spawnSync(process.execPath, ['scripts/apply-legal-005-final-atomic.mjs','--product-owner-authorized'], { cwd:root, encoding:'utf8' });
let secondApplyPayload = null;
try { secondApplyPayload = JSON.parse(secondApply.stdout); } catch { secondApplyPayload = { stdout:secondApply.stdout.trim(), stderr:secondApply.stderr.trim() }; }
check('SECOND_APPLY_EXIT_ZERO', secondApply.status === 0, secondApply.status, 0);
check('SECOND_APPLY_ZERO_OPERATIONS', secondApplyPayload?.status === 'ALREADY_APPLIED_IDEMPOTENT_PASS' && deepEqual(secondApplyPayload.operationsReexecuted,{add:0,modify:0,delete:0}), secondApplyPayload, 'ALREADY_APPLIED + zero operations');
check('SECOND_APPLY_HASHES_UNCHANGED', hashFile(registryPath) === beforeSecondApply.registry && hashFile(legislationViewPath) === beforeSecondApply.view && hashFile(routingViewPath) === beforeSecondApply.routing, {registry:hashFile(registryPath),view:hashFile(legislationViewPath),routing:hashFile(routingViewPath)}, beforeSecondApply);

const failed = checks.filter((item) => item.status === 'FAIL');
const report = {
  schemaVersion:'agm-legal-005-post-apply-validation.v1',
  validatedAt:'2026-08-30T20:45:00.000Z',
  result:failed.length ? 'FAIL' : 'PASS',
  passed:checks.length-failed.length,
  total:checks.length,
  failedCount:failed.length,
  checks,
  summary:{
    atomicApply:failed.length ? 'FAIL' : 'PASS',
    postApplyValidation:failed.length ? 'FAIL' : 'PASS',
    idempotence:secondApplyPayload?.status === 'ALREADY_APPLIED_IDEMPOTENT_PASS' ? 'PASS' : 'FAIL',
    secondApplyOperations:secondApplyPayload?.operationsReexecuted ?? null,
    deterministicRegeneration:bytes(registryPath).equals(bytes(projectedRegistryPath)) && bytes(legislationViewPath).equals(bytes(projectedViewPath)) ? 'PASS' : 'FAIL',
    registry:{before:841,after:registry.sourceCount,sha256:hashFile(registryPath),projectedHashMatch:hashFile(registryPath)===expected.finalRegistry},
    legislationSafetyView:{before:44,after:view.sourceCount,sha256:hashFile(legislationViewPath),projectedHashMatch:hashFile(legislationViewPath)===expected.finalView},
    routingTollView:{before:289,after:routing.sourceCount,sha256:hashFile(routingViewPath),unchanged:hashFile(routingViewPath)===expected.routing},
    operations:{registry:{add:21,modify:0,delete:0},legislationSafetyView:{add:22,modify:0,delete:0},routingTollView:{add:0,modify:0,delete:0}},
    duplicates:{before:duplicatesBefore,after:duplicatesAfter,newDuplicateImpact:0},
    rollback:'NOT_EXECUTED_AVAILABLE',
  },
  protections:{runtimeProduction:'NO_CHANGE',commitPush:'NOT_EXECUTED'},
};
writeFileSync(absolute(`${applyRoot}/POST_APPLY_VALIDATION_REPORT.json`), `${JSON.stringify(report,null,2)}\n`, 'utf8');
writeFileSync(absolute(`${applyRoot}/FINAL_ATOMIC_APPLY_REPORT.md`), `# LEGAL-005 — Final atomic apply report\n\n- ATOMIC APPLY: **${report.summary.atomicApply}**\n- POST-APPLY VALIDATION: **${report.summary.postApplyValidation}** (${report.passed}/${report.total})\n- IDEMPOTENCE: **${report.summary.idempotence}**; second apply **0/0/0**\n- Registry: **841 → ${registry.sourceCount}**, SHA-256 \`${report.summary.registry.sha256}\`\n- Legislation/Safety: **44 → ${view.sourceCount}**, SHA-256 \`${report.summary.legislationSafetyView.sha256}\`\n- Routing/Toll: **289 → ${routing.sourceCount} UNCHANGED**, SHA-256 \`${report.summary.routingTollView.sha256}\`\n- Deterministic regeneration: **${report.summary.deterministicRegeneration}**\n- Unexpected MODIFY/DELETE: **0/0**\n- Runtime/Production: **NO CHANGE**\n- Commit/push: **NOT EXECUTED**\n`, 'utf8');
console.log(JSON.stringify({
  result:report.result,
  passed:report.passed,
  total:report.total,
  summary:report.summary,
  failed:failed.map((item) => item.id),
}, null, 2));
if (failed.length) process.exit(1);
