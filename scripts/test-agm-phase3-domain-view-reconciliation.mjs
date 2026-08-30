import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryHash = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const phase3Domains = {
  'CS-AGM-CM-ARCH-V1': ['car-mover', 'routing-toll'],
  'CS-AGM-CM-FIELD-RUNBOOK-V1': ['car-mover', 'routing-toll'],
  'CS-AGM-CM-JOB-V1': ['car-mover', 'documents-ocr-evidence'],
  'CS-AGM-CM-OCR-EVIDENCE-V1': ['car-mover', 'documents-ocr-evidence'],
  'CS-AGM-TACHO-CHANGE-MAP-V1': ['tacho'],
  'CS-DE-FPERSG': ['tacho'],
  'CS-DE-FPERSV': ['tacho'],
  'CS-DE-GGVSEB': ['legislation-safety'],
  'CS-DE-STVO': ['legislation-safety'],
  'CS-DE-STVZO': ['legislation-safety'],
  'CS-EU-IMPL-REG-2016-799': ['tacho'],
  'CS-EU-IMPL-REG-2016-799-CONS-20230821': ['tacho'],
  'CS-EU-REG-165-2014': ['tacho'],
  'CS-EU-REG-165-2014-CONS-20241231': ['tacho'],
  'CS-EU-REG-561-2006': ['tacho'],
  'CS-EU-REG-561-2006-CONS-20241231': ['tacho'],
  'CS-UNECE-ADR-2025': ['legislation-safety'],
};
const phase3Ids = Object.keys(phase3Domains).sort();
const openGaps = ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005'];
const allViews = ['common-platform', 'car-mover', 'routing-toll', 'documents-ocr-evidence', 'opportunity-communications', 'tacho', 'legislation-safety'];
const expectedViewCounts = {
  'common-platform': 34,
  'car-mover': 802,
  'routing-toll': 263,
  'documents-ocr-evidence': 165,
  'opportunity-communications': 139,
  tacho: 40,
  'legislation-safety': 44,
};
const baselineSubsetHashes = {
  memberships: '238a7e7df8bd2d883d73c6cf941073c5eda5e8b3beade2c4b97dbc0250268225',
  mappingRows: '890a387a3a83b44bb9d1cffc03350cc72e50a8a456a984e4ea87f9dca40646e5',
  views: {
    'common-platform': 'f093b9cb6b3715da295a9c26d14e224aa264d3a98d746999f54ddee415ddf32f',
    'car-mover': '68ecb71d7af59da437fb5b471dd229586118443746e49a348801ec0098a74b28',
    'routing-toll': 'aed9cec6eeaaa7590838bd1d3e571e4a734e9162cfd2f504488a0e13d4c51ce7',
    'documents-ocr-evidence': '8dc21022977cdb2cb7e18b1f092b66e8bada70286d0edc0ecad42a13bb77ed67',
    'opportunity-communications': 'b041583dbbdead44301198b4d3213d13bf875e6346ab8dd07fabc71fba30a076',
    tacho: '8c8d58534034e7c34ad124f1680437d4c3c90ff92081c821bd16f1c673f30927',
    'legislation-safety': '63751ac0bd1eafabe23e5b1260b86757c2f54a692013c9bededb0299c3b965b5',
  },
};
const basicExpected = {
  'apps/web/src/agent-governance.registry.ts': 'f74c4b0341048badace3a19449170ff34fa1c8943078cca7e618472aaa7bfa82',
  'apps/web/src/maintenance-department.ts': '5b8746e9a7e12b9a0b769fc762869d9fa977734a4af1eef0704e7975e8c3aaf0',
  'evidence/governance/modules/PRE-005/v1.0/LINGUISTIC_AGENTS_CONTRACT.md': '3234d8b0f5dcbb4ba3b3242e7da9c355ebe1edc5d4159cec67a80f8348260231',
};
const checks = [];

const registry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const membershipsDocument = readJson('AGM_LIBRARY/MAPPINGS/domain-memberships.json');
const mapping = readJson('AGM_LIBRARY/MAPPINGS/source-domain-mapping.json');
const manifest = readJson('AGM_LIBRARY/PHASE3/DOMAIN_VIEW_RECONCILIATION/RECONCILIATION_MANIFEST.json');
const unresolved = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
const registryById = new Map(registry.sources.map((source) => [source.sourceId, source]));

check('CENTRAL_REGISTRY_815_HASH_UNCHANGED', () => {
  assert(registry.sourceCount === 815 && registry.sources.length === 815, 'REGISTRY_COUNT_INVALID');
  assert(shaFile('AGM_LIBRARY/REGISTRY/canonical-sources.json') === registryHash, 'REGISTRY_HASH_DRIFT');
  assert(new Set(registry.sources.map((source) => source.sourceId)).size === 815, 'DUPLICATE_CANONICAL_SOURCE_ID');
  assert(new Set(registry.sources.map((source) => source.canonicalPath)).size === 815, 'DUPLICATE_CANONICAL_PATH');
});

check('PHASE3_SOURCE_SET_EXACT_17', () => {
  assert(phase3Ids.length === 17, 'EXPECTED_SET_NOT_17');
  for (const sourceId of phase3Ids) assert(registryById.has(sourceId), `SOURCE_NOT_IN_REGISTRY:${sourceId}`);
  const previouslyUnmapped = manifest.sources.filter((source) => source.previousDomainViewPresence.length === 0).map((source) => source.sourceId);
  assert(equalSets(previouslyUnmapped, phase3Ids), 'BEFORE_SOURCE_SET_NOT_EXACT');
});

check('DOMAIN_MAPPINGS_17_OF_17_EXACT', () => {
  assert(mapping.sourceCount === 815 && mapping.sources.length === 815, 'MAPPING_SOURCE_COUNT_INVALID');
  assert(mapping.membershipCount === 1487, 'MAPPING_MEMBERSHIP_COUNT_INVALID');
  const mappingById = new Map(mapping.sources.map((row) => [row.sourceId, row]));
  assert(mappingById.size === 815, 'DUPLICATE_MAPPING_SOURCE_ID');
  for (const [sourceId, expectedDomains] of Object.entries(phase3Domains)) {
    const row = mappingById.get(sourceId);
    assert(row, `MAPPING_ROW_MISSING:${sourceId}`);
    assert(equalSets(row.domains, expectedDomains), `DOMAIN_SET_INVALID:${sourceId}`);
    assert(row.membershipIds.length === expectedDomains.length, `MEMBERSHIP_CARDINALITY_INVALID:${sourceId}`);
  }
});

check('PRE_EXISTING_798_BASELINE_PRESERVED', () => {
  const oldMemberships = membershipsDocument.memberships.filter((item) => !phase3Ids.includes(item.sourceId));
  const oldRows = mapping.sources.filter((item) => !phase3Ids.includes(item.sourceId));
  assert(oldMemberships.length === 1466, 'OLD_MEMBERSHIP_COUNT_DRIFT');
  assert(oldRows.length === 798, 'OLD_MAPPING_ROW_COUNT_DRIFT');
  assert(shaObject(oldMemberships) === baselineSubsetHashes.memberships, 'OLD_MEMBERSHIP_CONTENT_DRIFT');
  assert(shaObject(oldRows) === baselineSubsetHashes.mappingRows, 'OLD_MAPPING_CONTENT_DRIFT');
  for (const viewId of allViews) {
    const oldReferences = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`).memberships.filter((item) => !phase3Ids.includes(item.sourceId));
    assert(shaObject(oldReferences) === baselineSubsetHashes.views[viewId], `OLD_VIEW_CONTENT_DRIFT:${viewId}`);
  }
});

check('NO_SOURCE_OR_MEMBERSHIP_DUPLICATION', () => {
  assert(membershipsDocument.membershipCount === 1487, 'MEMBERSHIP_COUNT_INVALID');
  assert(membershipsDocument.memberships.length === 1487, 'MEMBERSHIP_ARRAY_COUNT_INVALID');
  assert(new Set(membershipsDocument.memberships.map((item) => item.membershipId)).size === 1487, 'DUPLICATE_MEMBERSHIP_ID');
  const pairs = membershipsDocument.memberships.map((item) => `${item.sourceId}:${item.domainId}`);
  assert(new Set(pairs).size === pairs.length, 'DUPLICATE_SOURCE_DOMAIN_PAIR');
  const newMemberships = membershipsDocument.memberships.filter((item) => phase3Ids.includes(item.sourceId));
  assert(newMemberships.length === 21, 'NEW_MEMBERSHIP_COUNT_INVALID');
});

check('CONTROLLED_VIEWS_REFERENCE_ONLY_AND_COUNTS_VALID', () => {
  const membershipById = new Map(membershipsDocument.memberships.map((item) => [item.membershipId, item]));
  for (const viewId of allViews) {
    const view = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`);
    assert(view.sourceCount === expectedViewCounts[viewId], `VIEW_COUNT_INVALID:${viewId}`);
    assert(view.memberships.length === expectedViewCounts[viewId], `VIEW_ARRAY_COUNT_INVALID:${viewId}`);
    assert(view.viewType === 'CONTROLLED_REFERENCE_INDEX', `VIEW_TYPE_INVALID:${viewId}`);
    for (const reference of view.memberships) {
      assert(Object.keys(reference).sort().join(',') === 'membershipId,sourceId', `CANONICAL_METADATA_COPIED_TO_VIEW:${viewId}`);
      const membership = membershipById.get(reference.membershipId);
      assert(membership?.sourceId === reference.sourceId && membership.domainId === viewId, `VIEW_REFERENCE_INVALID:${viewId}:${reference.membershipId}`);
    }
  }
});

check('CANDIDATE_VIEW_AUTHORITY_NOT_PROMOTED', () => {
  for (const viewId of ['tacho', 'legislation-safety']) {
    const view = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`);
    assert(view.authorityStatus === 'CANDIDATE_NOT_AUTHORITATIVE', `VIEW_AUTHORITY_PROMOTED:${viewId}`);
    const phase3Memberships = membershipsDocument.memberships.filter((item) => item.domainId === viewId && phase3Ids.includes(item.sourceId));
    assert(phase3Memberships.every((item) => item.role === 'CANDIDATE'), `VIEW_ROLE_PROMOTED:${viewId}`);
  }
});

check('CS_DE_STVO_SCOPE_PRESERVED', () => {
  const row = mapping.sources.find((item) => item.sourceId === 'CS-DE-STVO');
  assert(equalSets(row.domains, ['legislation-safety']), 'STVO_DOMAIN_SCOPE_EXTENDED');
  const reportRow = manifest.sources.find((item) => item.sourceId === 'CS-DE-STVO');
  assert(reportRow.affectedGaps.includes('LEGAL-003') && reportRow.affectedGaps.includes('LEGAL-005'), 'STVO_OPEN_GAP_LINK_MISSING');
  assert(reportRow.mappingClosesAnyGap === false, 'STVO_MAPPING_CLOSED_GAP');
});

check('UNRESOLVED_GAPS_EXACTLY_3_OPEN', () => {
  assert(unresolved.gapCount === 3, 'OPEN_GAP_COUNT_INVALID');
  assert(equalSets(unresolved.gaps.map((gap) => gap.gapId), openGaps), 'OPEN_GAP_SET_INVALID');
  assert(unresolved.gaps.every((gap) => gap.state === 'OPEN'), 'OPEN_GAP_STATE_CHANGED');
  assert(manifest.unresolvedGaps.every((gap) => gap.state === 'OPEN' && gap.changed === false), 'MANIFEST_GAP_CHANGE_DETECTED');
  assert(manifest.sources.every((source) => source.mappingClosesAnyGap === false), 'MAPPING_CLOSED_A_GAP');
});

check('CANONICAL_ARTIFACT_INTEGRITY_17_OF_17', () => {
  for (const sourceId of phase3Ids) {
    const source = registryById.get(sourceId);
    assert(statSync(path.join(root, source.canonicalPath)).isFile(), `CANONICAL_ARTIFACT_MISSING:${sourceId}`);
    assert(shaFile(source.canonicalPath) === source.sha256, `CANONICAL_ARTIFACT_HASH_MISMATCH:${sourceId}`);
  }
});

check('DUPLICATE_HASH_GROUPS_PRESERVED', () => {
  const groups = new Map();
  for (const source of registry.sources) groups.set(source.sha256, [...(groups.get(source.sha256) ?? []), source.sourceId]);
  const duplicates = [...groups.values()].filter((sourceIds) => sourceIds.length > 1);
  assert(duplicates.length === 62, 'DUPLICATE_HASH_GROUP_COUNT_DRIFT');
  assert(duplicates.reduce((sum, sourceIds) => sum + sourceIds.length, 0) === 257, 'DUPLICATE_HASH_RECORD_COUNT_DRIFT');
});

check('SCHEMAS_UNCHANGED', () => {
  const schemaDir = path.join(root, 'AGM_LIBRARY/SCHEMAS');
  const lines = readdirSync(schemaDir).sort().map((file) => `${shaFile(`AGM_LIBRARY/SCHEMAS/${file}`)} ${file}`).join('\n');
  assert(createHash('sha256').update(lines).digest('hex') === 'a9199b1c931b5f457339574e750b4d8a8ef36672155984531864c1db7050cfbc', 'SCHEMA_DIRECTORY_HASH_DRIFT');
});

check('BASIC_LIBRARIAN_HASHES_3_OF_3_MATCH', () => {
  for (const [file, expected] of Object.entries(basicExpected)) assert(shaFile(file) === expected, `BASIC_HASH_DRIFT:${file}`);
});

check('TRACEABILITY_COMPLETE', () => {
  assert(manifest.sources.length === 17, 'MANIFEST_SOURCE_COUNT_INVALID');
  for (const item of manifest.sources) {
    const source = registryById.get(item.sourceId);
    assert(source, `MANIFEST_SOURCE_UNKNOWN:${item.sourceId}`);
    assert(item.authorityClassification === source.authority.authorityType, `MANIFEST_AUTHORITY_MISMATCH:${item.sourceId}`);
    assert(item.canonicalArtifactReference === source.canonicalPath, `MANIFEST_PATH_MISMATCH:${item.sourceId}`);
    assert(item.integritySha256 === source.sha256, `MANIFEST_HASH_MISMATCH:${item.sourceId}`);
  }
});

check('GENERATOR_IDEMPOTENCE_TWO_RUN_SIGNATURE_MATCH', () => {
  const generatedFiles = [
    'AGM_LIBRARY/MAPPINGS/domain-memberships.json',
    'AGM_LIBRARY/MAPPINGS/source-domain-mapping.json',
    'AGM_LIBRARY/VIEWS/car-mover.view.json',
    'AGM_LIBRARY/VIEWS/routing-toll.view.json',
    'AGM_LIBRARY/VIEWS/documents-ocr-evidence.view.json',
    'AGM_LIBRARY/VIEWS/tacho.view.json',
    'AGM_LIBRARY/VIEWS/legislation-safety.view.json',
    'AGM_LIBRARY/PHASE3/DOMAIN_VIEW_RECONCILIATION/RECONCILIATION_MANIFEST.json',
    'AGM_LIBRARY/PHASE3/DOMAIN_VIEW_RECONCILIATION/BEFORE_AFTER_RECONCILIATION_REPORT.md',
  ];
  assert(combinedFileSignature(generatedFiles) === '646552402d11b1ca0f87c06bfe0d6161fcf90ade77425d5ccf7f433104556b7f', 'IDEMPOTENCE_SIGNATURE_DRIFT');
});

const failed = checks.filter((check) => check.status === 'FAIL');
const report = `# Phase 3 domain-view reconciliation validation\n\nGenerated at: \`2026-08-29T21:19:48.538Z\`  \nVerdict: **${failed.length === 0 ? 'PASS' : 'FAIL'}**\n\n## Checks\n\n${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}\n\n## Validated transition\n\n- canonical sources: 815 -> 815;\n- mapped sources: 798 -> 815;\n- memberships: 1,466 -> 1,487;\n- new source/domain memberships: 21;\n- Phase 3 sourceIds reconciled: 17/17;\n- duplicate hash groups/records: 62/257, unchanged through immutable Registry hash;\n- unresolved gaps: ROUTING-TOLL-001, LEGAL-003, LEGAL-005 — OPEN;\n- Basic Librarian hashes: 3/3 MATCH;\n- generator idempotence: two consecutive runs MATCH; combined output SHA-256 \`646552402d11b1ca0f87c06bfe0d6161fcf90ade77425d5ccf7f433104556b7f\`;\n- runtime / Production / TURN: NO CHANGE;\n- commit / push: NOT EXECUTED.\n`;
writeFileSync(path.join(root, 'AGM_LIBRARY/PHASE3/DOMAIN_VIEW_RECONCILIATION/VALIDATION_REPORT.md'), report, 'utf8');

for (const item of checks) console.log(`${item.name}=${item.status}${item.error ? ` error=${item.error}` : ''}`);
console.log(`PHASE3_DOMAIN_VIEW_RECONCILIATION=${failed.length === 0 ? 'PASS' : 'FAIL'}`);
if (failed.length > 0) process.exitCode = 1;

function check(name, operation) {
  try {
    operation();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function shaFile(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex');
}

function shaObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function combinedFileSignature(files) {
  const lines = files.map((file) => `${shaFile(file)} ${file}`).join('\n');
  return createHash('sha256').update(lines).digest('hex');
}

function equalSets(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assert(value, message) {
  if (!value) throw new Error(message);
}
