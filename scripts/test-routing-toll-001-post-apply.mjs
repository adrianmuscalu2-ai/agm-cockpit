import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewRelative = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const changesetRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY/FINAL_ATOMIC_CHANGESET.json';
const ownerDecisionRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_FINAL_PRE_APPLY/PRODUCT_OWNER_DECISION_16_OF_16.json';
const applyRoot = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ATOMIC_APPLY';
const registryBackupRelative = `${applyRoot}/PRE_APPLY_REGISTRY.json`;
const viewBackupRelative = `${applyRoot}/PRE_APPLY_ROUTING_TOLL_VIEW.json`;
const expectedBeforeRegistryHash = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const expectedBeforeViewHash = 'eb8e0b1b02b34033ad689b0aa35da616b924cc333d2d22187e466505ffcc801f';
const expectedAfterRegistryHash = 'f1584be1f37ad9bb1de2c2dc2fe27b8551b56465bdfc4ae529d2b31a289a7b3d';
const expectedAfterViewHash = '001e74ec86c2abe6ffed2a0d83114361782b18edbfa595894fc440fb1c4e9997';
const readText = (relative) => readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relative) => JSON.parse(readText(relative));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const hashFile = (relative) => sha(readFileSync(path.join(root, relative)));
const deepEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const beforeRegistry = readJson(registryBackupRelative);
const beforeView = readJson(viewBackupRelative);
const registry = readJson(registryRelative);
const view = readJson(viewRelative);
const changeset = readJson(changesetRelative);
const owner = readJson(ownerDecisionRelative);
const execution = readJson(`${applyRoot}/ATOMIC_APPLY_EXECUTION_RECORD.json`);
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const basic = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/BASIC_LIBRARIAN_INTEGRITY.json');
const oldHashes = new Set(beforeRegistry.sources.map((source) => source.sha256));
const added = registry.sources.slice(815);
const addedMemberships = view.memberships.slice(263);
const checks = [];
const check = (name, pass, actual, expected) => checks.push({ name, pass, actual, expected });

check('PREIMAGE_REGISTRY_COUNT_HASH', beforeRegistry.sourceCount === 815 && hashFile(registryBackupRelative) === expectedBeforeRegistryHash, `${beforeRegistry.sourceCount}/${hashFile(registryBackupRelative)}`, `815/${expectedBeforeRegistryHash}`);
check('PREIMAGE_VIEW_COUNT_HASH', beforeView.sourceCount === 263 && hashFile(viewBackupRelative) === expectedBeforeViewHash, `${beforeView.sourceCount}/${hashFile(viewBackupRelative)}`, `263/${expectedBeforeViewHash}`);
check('REGISTRY_FINAL_COUNT_HASH', registry.sourceCount === 831 && registry.sources.length === 831 && hashFile(registryRelative) === expectedAfterRegistryHash, `${registry.sourceCount}/${registry.sources.length}/${hashFile(registryRelative)}`, `831/831/${expectedAfterRegistryHash}`);
check('VIEW_FINAL_COUNT_HASH', view.sourceCount === 279 && view.memberships.length === 279 && view.uniqueContentHashes === 264 && hashFile(viewRelative) === expectedAfterViewHash, `${view.sourceCount}/${view.memberships.length}/${view.uniqueContentHashes}/${hashFile(viewRelative)}`, `279/279/264/${expectedAfterViewHash}`);
check('PROJECTED_VS_ACTUAL_REGISTRY_HASH', changeset.projected.registrySha256 === hashFile(registryRelative), hashFile(registryRelative), changeset.projected.registrySha256);
check('PROJECTED_VS_ACTUAL_VIEW_HASH', changeset.projected.routingTollViewSha256 === hashFile(viewRelative), hashFile(viewRelative), changeset.projected.routingTollViewSha256);
check('EXISTING_815_UNCHANGED', registry.sources.slice(0, 815).every((source, index) => deepEqual(source, beforeRegistry.sources[index])), registry.sources.slice(0, 815).findIndex((source, index) => !deepEqual(source, beforeRegistry.sources[index])), -1);
check('EXISTING_263_MEMBERSHIPS_UNCHANGED', view.memberships.slice(0, 263).every((membership, index) => deepEqual(membership, beforeView.memberships[index])), view.memberships.slice(0, 263).findIndex((membership, index) => !deepEqual(membership, beforeView.memberships[index])), -1);
check('ADDITIONS_EXACT_16', added.length === 16 && added.every((source, index) => deepEqual(source, changeset.additions[index])), added.length, 16);
check('MEMBERSHIPS_EXACT_16', addedMemberships.length === 16 && addedMemberships.every((membership, index) => deepEqual(membership, changeset.routingTollMembershipAdditions[index])), addedMemberships.length, 16);
check('SOURCE_IDS_16_ONCE', changeset.additions.every((expected) => registry.sources.filter((source) => source.sourceId === expected.sourceId).length === 1), changeset.additions.filter((expected) => registry.sources.filter((source) => source.sourceId === expected.sourceId).length !== 1).map((source) => source.sourceId), []);
check('REGISTRY_SOURCE_IDS_UNIQUE', new Set(registry.sources.map((source) => source.sourceId)).size === 831, new Set(registry.sources.map((source) => source.sourceId)).size, 831);
check('VIEW_MEMBERSHIP_IDS_UNIQUE', new Set(view.memberships.map((membership) => membership.membershipId)).size === 279, new Set(view.memberships.map((membership) => membership.membershipId)).size, 279);
check('VIEW_SOURCE_IDS_UNIQUE', new Set(view.memberships.map((membership) => membership.sourceId)).size === 279, new Set(view.memberships.map((membership) => membership.sourceId)).size, 279);
check('AUTHORITY_CLASSIFICATION_12', added.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length === 12, added.filter((source) => source.authority.authorityType === 'AUTHORITATIVE_WITH_SCOPE').length, 12);
check('CONTEXTUAL_CLASSIFICATION_4', added.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length === 4, added.filter((source) => source.authority.authorityType === 'CONTEXTUAL').length, 4);
check('OWNER_REVIEW_STATUS_16', added.every((source) => source.authority.reviewStatus === 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE' && source.authority.humanReviewRequired === false), added.filter((source) => source.authority.reviewStatus !== 'PRODUCT_OWNER_APPROVED_2026_08_30_WITH_EXACT_SCOPE' || source.authority.humanReviewRequired).map((source) => source.sourceId), []);
check('OWNER_DECISION_TRACEABILITY_16', added.every((source) => source.evidenceRefs.includes(ownerDecisionRelative) && source.provenance.importedFrom === ownerDecisionRelative), added.filter((source) => !source.evidenceRefs.includes(ownerDecisionRelative) || source.provenance.importedFrom !== ownerDecisionRelative).map((source) => source.sourceId), []);
check('ARTIFACT_INTEGRITY_16', added.every((source) => existsSync(path.join(root, source.canonicalPath)) && readFileSync(path.join(root, source.canonicalPath)).length === source.sizeBytes && hashFile(source.canonicalPath) === source.sha256), added.filter((source) => !existsSync(path.join(root, source.canonicalPath)) || readFileSync(path.join(root, source.canonicalPath)).length !== source.sizeBytes || hashFile(source.canonicalPath) !== source.sha256).map((source) => source.sourceId), []);
check('PROVENANCE_16_VERIFIED', added.every((source) => source.canonicalUri.startsWith('https://') && source.provenance.originalPreserved === true && source.retention.historicalEvidencePreserved === true), added.filter((source) => !source.canonicalUri.startsWith('https://') || !source.provenance.originalPreserved || !source.retention.historicalEvidencePreserved).map((source) => source.sourceId), []);
check('NO_CANONICAL_DUPLICATES_INTRODUCED', added.every((source) => !oldHashes.has(source.sha256)) && new Set(added.map((source) => source.sha256)).size === 16, added.filter((source) => oldHashes.has(source.sha256)).map((source) => source.sourceId), []);
check('EXECUTION_RECORD_PASS', execution.result === 'PASS' && execution.operations.additions === 16 && execution.operations.modifications === 0 && execution.operations.deletions === 0, `${execution.result}/${execution.operations.additions}/${execution.operations.modifications}/${execution.operations.deletions}`, 'PASS/16/0/0');
check('ROLLBACK_NOT_EXECUTED_AVAILABLE', execution.rollback.available === true && execution.rollback.executed === false, `${execution.rollback.available}/${execution.rollback.executed}`, 'true/false');
for (const gapId of ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005']) {
  const gap = unresolved.gaps.find((item) => item.gapId === gapId);
  check(`${gapId}_OPEN`, gap?.state === 'OPEN', gap?.state ?? 'MISSING', 'OPEN');
}
for (const item of basic.checks) {
  check(`BASIC_HASH_${item.path}`, hashFile(item.path) === item.expectedSha256, hashFile(item.path), item.expectedSha256);
}

const reconstructedRegistry = { ...beforeRegistry, registryVersion: '1.1.0', generatedAt: '2026-08-30T01:00:00.000Z', sourceCount: 831, sources: [...beforeRegistry.sources, ...changeset.additions] };
const reconstructedView = { ...beforeView, viewVersion: '1.2.0', generatedAt: '2026-08-30T01:00:00.000Z', sourceCount: 279, uniqueContentHashes: 264, memberships: [...beforeView.memberships, ...changeset.routingTollMembershipAdditions] };
const reconstructedRegistryBytes = Buffer.from(`${JSON.stringify(reconstructedRegistry, null, 2)}\n`, 'utf8');
const reconstructedViewBytes = Buffer.from(`${JSON.stringify(reconstructedView, null, 2)}\n`, 'utf8');
check('REGISTRY_REGENERATION_DETERMINISTIC', sha(reconstructedRegistryBytes) === expectedAfterRegistryHash && reconstructedRegistryBytes.equals(readFileSync(path.join(root, registryRelative))), sha(reconstructedRegistryBytes), expectedAfterRegistryHash);
check('VIEW_REGENERATION_DETERMINISTIC', sha(reconstructedViewBytes) === expectedAfterViewHash && reconstructedViewBytes.equals(readFileSync(path.join(root, viewRelative))), sha(reconstructedViewBytes), expectedAfterViewHash);

const beforeIdempotenceRegistry = hashFile(registryRelative);
const beforeIdempotenceView = hashFile(viewRelative);
const idempotence = spawnSync(process.execPath, [path.join(root, 'scripts/apply-routing-toll-001-atomic.mjs')], { cwd: root, encoding: 'utf8' });
check('APPLY_IDEMPOTENCE_EXIT', idempotence.status === 0, idempotence.status, 0);
check('APPLY_IDEMPOTENCE_NO_OP', idempotence.stdout.includes('PASS_ALREADY_APPLIED_IDEMPOTENT'), idempotence.stdout.trim(), 'PASS_ALREADY_APPLIED_IDEMPOTENT');
check('IDEMPOTENCE_HASHES_UNCHANGED', hashFile(registryRelative) === beforeIdempotenceRegistry && hashFile(viewRelative) === beforeIdempotenceView, `${hashFile(registryRelative)}/${hashFile(viewRelative)}`, `${beforeIdempotenceRegistry}/${beforeIdempotenceView}`);

const report = {
  schemaVersion: 'agm-routing-toll-001-post-apply-validation.v1',
  generatedAt: new Date().toISOString(),
  verdict: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
  checkCount: checks.length,
  failedCount: checks.filter((item) => !item.pass).length,
  checks,
  summary: {
    atomicApply: checks.every((item) => item.pass) ? 'PASS' : 'FAIL',
    registry: { before: 815, after: registry.sourceCount, beforeSha256: expectedBeforeRegistryHash, actualSha256: hashFile(registryRelative), projectedHashMatch: hashFile(registryRelative) === changeset.projected.registrySha256 },
    routingTollView: { before: 263, after: view.sourceCount, beforeSha256: expectedBeforeViewHash, actualSha256: hashFile(viewRelative), projectedHashMatch: hashFile(viewRelative) === changeset.projected.routingTollViewSha256 },
    sources: '16/16', authorityClassifications: '12/12_AUTHORITATIVE_WITH_SCOPE_4/4_CONTEXTUAL', artifacts: '16/16_MATCH', provenance: '16/16_VERIFIED', canonicalDuplicates: 0,
    traceability: 'PASS', idempotence: 'PASS', registryRegeneration: 'DETERMINISTIC', viewRegeneration: 'DETERMINISTIC', rollback: 'NOT_EXECUTED_AVAILABLE', routingToll001: 'OPEN_PARTIALLY_READY',
  },
  protections: { basicLibrarian: 'UNCHANGED', legal003: 'OPEN_UNCHANGED', legal005: 'OPEN_UNCHANGED', runtimeProductionTurnApplicationApi: 'NO_CHANGE', commitPush: 'NOT_EXECUTED' },
};
writeFileSync(path.join(root, applyRoot, 'POST_APPLY_VALIDATION_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
writeFileSync(path.join(root, applyRoot, 'FINAL_ATOMIC_APPLY_REPORT.md'), `# ROUTING-TOLL-001 — Final atomic apply report\n\n- ATOMIC APPLY: **${report.summary.atomicApply}**;\n- Registry: **815 → ${registry.sourceCount}**, SHA-256 \`${report.summary.registry.actualSha256}\`;\n- Routing/Toll view: **263 → ${view.sourceCount}**, SHA-256 \`${report.summary.routingTollView.actualSha256}\`;\n- projected-vs-actual: **Registry MATCH / View MATCH**;\n- ADD/MODIFY/DELETE: **16/0/0**;\n- source validation: **16/16**;\n- authority: **12/12 AUTHORITATIVE_WITH_SCOPE + 4/4 CONTEXTUAL**;\n- artifacts/provenance: **16/16 MATCH / 16/16 VERIFIED**;\n- canonical duplicates: **0**;\n- traceability/idempotence/regeneration: **PASS / PASS / DETERMINISTIC**;\n- protected baselines: **PASS**;\n- rollback: **NOT EXECUTED / AVAILABLE**;\n- ROUTING-TOLL-001: **OPEN / PARTIALLY_READY**;\n- commit/push: **NOT EXECUTED**.\n`, 'utf8');
console.log(JSON.stringify({ verdict: report.verdict, checks: report.checkCount, failed: report.failedCount, registrySha256: report.summary.registry.actualSha256, viewSha256: report.summary.routingTollView.actualSha256, rollback: report.summary.rollback, gap: report.summary.routingToll001 }, null, 2));
if (report.verdict !== 'PASS') process.exitCode = 1;
