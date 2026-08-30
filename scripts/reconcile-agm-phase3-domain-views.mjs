import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryPath = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const registryExpectedSha256 = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';
const reconciliationVersion = '1.1.0';
const reconciliationTimestamp = '2026-08-29T21:19:48.538Z';
const evidenceRoot = 'AGM_LIBRARY/PHASE3/DOMAIN_VIEW_RECONCILIATION';

const expectedBefore = {
  sourceCount: 798,
  membershipCount: 1466,
  subsetHashes: {
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
  },
};

const reconciliation = {
  'CS-AGM-CM-ARCH-V1': {
    domains: ['car-mover', 'routing-toll'],
    gaps: ['CAR-MOVER-001'],
    rationale: 'Approved internal Car Mover architecture source; reusable in the Car Mover and Routing/Toll documentary contexts.',
  },
  'CS-AGM-CM-FIELD-RUNBOOK-V1': {
    domains: ['car-mover', 'routing-toll'],
    gaps: ['FIELD-001'],
    rationale: 'Approved controlled field protocol; field evidence remains separate and non-conclusive.',
  },
  'CS-AGM-CM-JOB-V1': {
    domains: ['car-mover', 'documents-ocr-evidence'],
    gaps: ['CAR-MOVER-002'],
    rationale: 'Approved internal Job File specification with a controlled document/evidence relationship.',
  },
  'CS-AGM-CM-OCR-EVIDENCE-V1': {
    domains: ['car-mover', 'documents-ocr-evidence'],
    gaps: ['DOCS-001'],
    rationale: 'Approved internal OCR/Documents/Evidence contract; OCR output is not canonical truth without source verification.',
  },
  'CS-AGM-TACHO-CHANGE-MAP-V1': {
    domains: ['tacho'],
    gaps: ['TACHO-005'],
    rationale: 'Contextual Tacho change map with no independent legal authority.',
  },
  'CS-DE-FPERSG': {
    domains: ['tacho'],
    gaps: ['TACHO-004', 'TACHO-005'],
    rationale: 'Official German driver-hours legislation, authoritative only within the human-approved German scope.',
  },
  'CS-DE-FPERSV': {
    domains: ['tacho'],
    gaps: ['TACHO-004', 'TACHO-005'],
    rationale: 'Official German driver-hours regulation, authoritative only within the human-approved German scope.',
  },
  'CS-DE-GGVSEB': {
    domains: ['legislation-safety'],
    gaps: ['LEGAL-004'],
    rationale: 'Official German dangerous-goods legislation; transport applicability is not inferred automatically.',
  },
  'CS-DE-STVO': {
    domains: ['legislation-safety'],
    gaps: ['LEGAL-001', 'LEGAL-003', 'LEGAL-005'],
    rationale: 'Official German StVO source approved through LEGAL-001 only; mapping does not close or extend LEGAL-003 or LEGAL-005.',
  },
  'CS-DE-STVZO': {
    domains: ['legislation-safety'],
    gaps: ['LEGAL-002'],
    rationale: 'Official German vehicle regulation with vehicle-category and provision-specific applicability.',
  },
  'CS-EU-IMPL-REG-2016-799': {
    domains: ['tacho'],
    gaps: ['TACHO-003', 'TACHO-005'],
    rationale: 'Authentic EU implementing act for tachographs; applicability remains generation, vehicle and date specific.',
  },
  'CS-EU-IMPL-REG-2016-799-CONS-20230821': {
    domains: ['tacho'],
    gaps: ['TACHO-003', 'TACHO-005'],
    rationale: 'Contextual consolidated Tacho reference; not the authentic legal act.',
  },
  'CS-EU-REG-165-2014': {
    domains: ['tacho'],
    gaps: ['TACHO-002', 'TACHO-005'],
    rationale: 'Authentic EU tachograph regulation within the human-approved scope.',
  },
  'CS-EU-REG-165-2014-CONS-20241231': {
    domains: ['tacho'],
    gaps: ['TACHO-002', 'TACHO-005'],
    rationale: 'Contextual consolidated Tacho reference; not the authentic legal act.',
  },
  'CS-EU-REG-561-2006': {
    domains: ['tacho'],
    gaps: ['TACHO-001', 'TACHO-005'],
    rationale: 'Authentic EU driving-time regulation within the human-approved scope.',
  },
  'CS-EU-REG-561-2006-CONS-20241231': {
    domains: ['tacho'],
    gaps: ['TACHO-001', 'TACHO-005'],
    rationale: 'Contextual consolidated driving-time reference; not the authentic legal act.',
  },
  'CS-UNECE-ADR-2025': {
    domains: ['legislation-safety'],
    gaps: ['LEGAL-004'],
    rationale: 'Official ADR 2025 publication; goods classification, exceptions and transport applicability remain operation specific.',
  },
};

const affectedViewIds = ['car-mover', 'routing-toll', 'documents-ocr-evidence', 'tacho', 'legislation-safety'];
const allViewIds = ['common-platform', ...affectedViewIds.slice(0, 3), 'opportunity-communications', ...affectedViewIds.slice(3)];
const unresolvedGapIds = ['ROUTING-TOLL-001', 'LEGAL-003', 'LEGAL-005'];

assert(shaFile(registryPath) === registryExpectedSha256, 'CENTRAL_REGISTRY_HASH_DRIFT');
const registry = readJson(registryPath);
assert(registry.sourceCount === 815 && registry.sources.length === 815, 'CENTRAL_REGISTRY_COUNT_NOT_815');
const registryById = new Map(registry.sources.map((source) => [source.sourceId, source]));
const phase3Ids = Object.keys(reconciliation).sort();
assert(phase3Ids.length === 17, 'PHASE3_SOURCE_COUNT_NOT_17');
for (const sourceId of phase3Ids) assert(registryById.has(sourceId), `PHASE3_SOURCE_MISSING_FROM_REGISTRY:${sourceId}`);

const gapPackage = readJson('AGM_LIBRARY/PHASE3/CLOSURE_PROPOSAL/UNRESOLVED_GAPS.json');
assert(gapPackage.gapCount === 3, 'UNRESOLVED_GAP_COUNT_DRIFT');
assert(equalSets(gapPackage.gaps.map((gap) => gap.gapId), unresolvedGapIds), 'UNRESOLVED_GAP_SET_DRIFT');

const membershipsDocument = readJson('AGM_LIBRARY/MAPPINGS/domain-memberships.json');
const mappingDocument = readJson('AGM_LIBRARY/MAPPINGS/source-domain-mapping.json');
const policies = readJson('AGM_LIBRARY/GOVERNANCE/domain-ownership-policy.json');
const policyByDomain = new Map(policies.domains.map((domain) => [domain.domainId, domain]));
const views = new Map(allViewIds.map((viewId) => [viewId, readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`)]));

const baselineMemberships = membershipsDocument.memberships.filter((membership) => !phase3Ids.includes(membership.sourceId));
const baselineMappingRows = mappingDocument.sources.filter((row) => !phase3Ids.includes(row.sourceId));
const baselineViewReferences = new Map([...views].map(([viewId, view]) => [
  viewId,
  view.memberships.filter((membership) => !phase3Ids.includes(membership.sourceId)),
]));

assert(baselineMemberships.length === expectedBefore.membershipCount, 'PRE_EXISTING_MEMBERSHIP_COUNT_DRIFT');
assert(baselineMappingRows.length === expectedBefore.sourceCount, 'PRE_EXISTING_MAPPING_COUNT_DRIFT');
assert(shaObject(baselineMemberships) === expectedBefore.subsetHashes.memberships, 'PRE_EXISTING_MEMBERSHIPS_CHANGED');
assert(shaObject(baselineMappingRows) === expectedBefore.subsetHashes.mappingRows, 'PRE_EXISTING_MAPPING_ROWS_CHANGED');
for (const viewId of allViewIds) {
  assert(shaObject(baselineViewReferences.get(viewId)) === expectedBefore.subsetHashes.views[viewId], `PRE_EXISTING_VIEW_REFERENCES_CHANGED:${viewId}`);
}

const newMemberships = [];
for (const sourceId of registry.sources.map((source) => source.sourceId).filter((id) => phase3Ids.includes(id))) {
  const source = registryById.get(sourceId);
  for (const domainId of [...reconciliation[sourceId].domains].sort()) {
    const policy = policyByDomain.get(domainId);
    assert(policy, `DOMAIN_POLICY_MISSING:${domainId}`);
    newMemberships.push({
      membershipId: membershipId(sourceId, domainId),
      sourceId,
      domainId,
      role: membershipRole(source, policy),
      rationale: reconciliation[sourceId].rationale,
      viewVersion: reconciliationVersion,
      domainOwner: policy.owner,
      consumerPolicy: policy.consumerPolicy,
    });
  }
}
assert(newMemberships.length === 21, 'NEW_MEMBERSHIP_COUNT_NOT_21');

const memberships = [...baselineMemberships, ...newMemberships];
assert(new Set(memberships.map((membership) => membership.membershipId)).size === memberships.length, 'DUPLICATE_MEMBERSHIP_ID');

const membershipsBySource = new Map();
for (const membership of memberships) {
  const list = membershipsBySource.get(membership.sourceId) ?? [];
  list.push(membership);
  membershipsBySource.set(membership.sourceId, list);
}

const mappingRows = registry.sources.map((source) => {
  const sourceMemberships = membershipsBySource.get(source.sourceId) ?? [];
  return {
    sourceId: source.sourceId,
    domains: sourceMemberships.map((item) => item.domainId).sort(),
    membershipIds: sourceMemberships.map((item) => item.membershipId).sort(),
  };
});
assert(mappingRows.length === 815, 'AFTER_MAPPING_SOURCE_COUNT_NOT_815');
assert(mappingRows.every((row) => row.domains.length > 0), 'UNASSIGNED_CANONICAL_SOURCE_AFTER_RECONCILIATION');

const outputDocuments = new Map();
outputDocuments.set('AGM_LIBRARY/MAPPINGS/domain-memberships.json', {
  ...membershipsDocument,
  collectionVersion: reconciliationVersion,
  generatedAt: reconciliationTimestamp,
  membershipCount: memberships.length,
  memberships,
});
outputDocuments.set('AGM_LIBRARY/MAPPINGS/source-domain-mapping.json', {
  ...mappingDocument,
  mappingVersion: reconciliationVersion,
  generatedAt: reconciliationTimestamp,
  sourceCount: registry.sourceCount,
  membershipCount: memberships.length,
  sources: mappingRows,
});

for (const viewId of affectedViewIds) {
  const view = views.get(viewId);
  const domainMemberships = memberships.filter((membership) => membership.domainId === viewId);
  outputDocuments.set(`AGM_LIBRARY/VIEWS/${viewId}.view.json`, {
    ...view,
    viewVersion: reconciliationVersion,
    generatedAt: reconciliationTimestamp,
    sourceCount: domainMemberships.length,
    uniqueContentHashes: new Set(domainMemberships.map((membership) => registryById.get(membership.sourceId).sha256)).size,
    memberships: domainMemberships.map(({ membershipId: id, sourceId }) => ({ membershipId: id, sourceId })),
  });
}

applyWithRollback(outputDocuments);

const afterHashes = Object.fromEntries([...outputDocuments.keys()].map((file) => [file, shaFile(file)]));
const reportRows = phase3Ids.map((sourceId) => {
  const source = registryById.get(sourceId);
  const item = reconciliation[sourceId];
  return {
    sourceId,
    authorityClassification: source.authority.authorityType,
    previousDomainViewPresence: [],
    resultingDomainViewMappings: [...item.domains].sort(),
    crossDomain: item.domains.length > 1,
    canonicalArtifactReference: source.canonicalPath,
    integritySha256: source.sha256,
    affectedGaps: item.gaps,
    mappingClosesAnyGap: false,
  };
});

mkdirSync(path.join(root, evidenceRoot), { recursive: true });
writeJson(`${evidenceRoot}/RECONCILIATION_MANIFEST.json`, {
  schemaVersion: 'agm-phase3-domain-view-reconciliation.v1',
  reconciliationVersion,
  generatedAt: reconciliationTimestamp,
  authority: 'PRODUCT_OWNER_MANDATE_PHASE3_DOMAIN_VIEW_RECONCILIATION',
  centralRegistry: {
    path: registryPath,
    sourceCount: registry.sourceCount,
    sha256: registryExpectedSha256,
    mutated: false,
  },
  before: {
    mappedSources: expectedBefore.sourceCount,
    memberships: expectedBefore.membershipCount,
    unmappedPhase3Sources: 17,
  },
  after: {
    mappedSources: mappingRows.length,
    memberships: memberships.length,
    addedMemberships: newMemberships.length,
    unmappedPhase3Sources: 0,
    outputHashes: afterHashes,
  },
  unresolvedGaps: unresolvedGapIds.map((gapId) => ({ gapId, state: 'OPEN', changed: false })),
  sources: reportRows,
  runtimeProductionTurnChange: 'NONE',
  basicLibrarianChange: 'NONE',
  commitPush: 'NOT_EXECUTED',
});
writeText(`${evidenceRoot}/BEFORE_AFTER_RECONCILIATION_REPORT.md`, markdownReport(reportRows, memberships.length));

console.log('PHASE3_SOURCES_RECONCILED=17/17');
console.log(`DOMAIN_MEMBERSHIPS=${expectedBefore.membershipCount}->${memberships.length}`);
console.log(`MAPPED_SOURCES=${expectedBefore.sourceCount}->${mappingRows.length}`);
console.log('CENTRAL_REGISTRY_MUTATION=NONE');
console.log('UNRESOLVED_GAPS=3_OPEN');

function membershipRole(source, policy) {
  if (policy.authorityStatus === 'CANDIDATE_NOT_AUTHORITATIVE') return 'CANDIDATE';
  return source.authority.authorityType === 'CONTEXTUAL' ? 'CONTEXTUAL' : 'DOMAIN_PRIMARY';
}

function membershipId(sourceId, domainId) {
  return `DM-${createHash('sha256').update(`${sourceId}:${domainId}`).digest('hex').slice(0, 20).toUpperCase()}`;
}

function applyWithRollback(documents) {
  const transactionId = 'phase3-domain-view-reconciliation';
  const backups = [];
  try {
    for (const [relativePath, value] of documents) {
      const target = path.join(root, relativePath);
      const staged = `${target}.${transactionId}.new`;
      writeFileSync(staged, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      JSON.parse(readFileSync(staged, 'utf8'));
    }
    for (const relativePath of documents.keys()) {
      const target = path.join(root, relativePath);
      const staged = `${target}.${transactionId}.new`;
      const backup = `${target}.${transactionId}.bak`;
      if (existsSync(backup)) rmSync(backup);
      renameSync(target, backup);
      backups.push({ target, backup });
      renameSync(staged, target);
    }
    for (const { backup } of backups) rmSync(backup);
  } catch (error) {
    for (const relativePath of documents.keys()) {
      const target = path.join(root, relativePath);
      const staged = `${target}.${transactionId}.new`;
      if (existsSync(staged)) rmSync(staged);
    }
    for (const { target, backup } of backups.reverse()) {
      if (existsSync(target)) rmSync(target);
      if (existsSync(backup)) renameSync(backup, target);
    }
    throw error;
  }
}

function markdownReport(rows, membershipCount) {
  const lines = rows.map((row, index) => `| ${index + 1} | \`${row.sourceId}\` | ${row.authorityClassification} | NONE | ${row.resultingDomainViewMappings.join(', ')} | ${row.crossDomain ? 'YES' : 'NO'} | \`${row.canonicalArtifactReference}\` | \`${row.integritySha256}\` | ${row.affectedGaps.join(', ')} | **NO** |`).join('\n');
  return `# Phase 3 domain-view reconciliation — BEFORE / AFTER\n\nReconciliation version: \`${reconciliationVersion}\`  \nGenerated at: \`${reconciliationTimestamp}\`  \nMode: DOCUMENTARY / INDEX PROPAGATION ONLY\n\n## Transition\n\n- Central Registry: **815 -> 815**, SHA-256 \`${registryExpectedSha256}\`;\n- mapped sources: **798 -> 815**;\n- domain memberships: **1,466 -> ${membershipCount}**;\n- Phase 3 sourceIds reconciled: **17/17**;\n- canonical artifacts copied: **0**;\n- existing canonical records modified/deleted/reclassified: **0/0/0**;\n- unresolved gaps: **3 / OPEN / UNCHANGED**.\n\n## Source-level reconciliation\n\n| # | sourceId | Authority classification | Previous views | Resulting views | Cross-domain | Canonical artifact | SHA-256 | Affected gap(s) | Mapping closes gap |\n|---:|---|---|---|---|---|---|---|---|---|\n${lines}\n\n## Governance notes\n\n- A domain membership is a controlled reference; it does not alter the source authority record.\n- Tacho and Legislation/Safety view-level status remains \`CANDIDATE_NOT_AUTHORITATIVE\`; Central Registry classifications remain unchanged.\n- \`CS-DE-STVO\` is mapped only to Legislation/Safety. Its authority remains limited to the Product Owner decision for \`LEGAL-001\`; \`LEGAL-003\` and \`LEGAL-005\` remain open.\n- Contextual consolidated EU texts and the AGM Tacho change map do not acquire independent legal authority through membership.\n- Field evidence remains evidence/non-conclusive; its protocol mapping does not authorize Production or provider activation.\n\n## Scope\n\n- BASIC LIBRARIAN = UNCHANGED\n- RUNTIME / PRODUCTION / TURN = NO CHANGE\n- APPLICATION / API / SCHEMA / INFRASTRUCTURE = NO CHANGE\n- COMMIT / PUSH = NOT EXECUTED\n`;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(relativePath, value) {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relativePath, value) {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, value, 'utf8');
}

function shaFile(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(root, relativePath))).digest('hex');
}

function shaObject(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function equalSets(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function assert(value, message) {
  if (!value) throw new Error(message);
}
