import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const libraryRoot = path.join(root, 'AGM_LIBRARY');
const bootstrap = readJson('CAR_MOVER/INDEX.json');
const registry = readJson('AGM_LIBRARY/REGISTRY/canonical-sources.json');
const membershipCollection = readJson('AGM_LIBRARY/MAPPINGS/domain-memberships.json');
const mapping = readJson('AGM_LIBRARY/MAPPINGS/source-domain-mapping.json');
const policies = readJson('AGM_LIBRARY/GOVERNANCE/domain-ownership-policy.json');
const gaps = readJson('AGM_LIBRARY/REPORTS/canonical-source-gaps.phase2.json');
const basicBaseline = readJson('CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json');
const requiredViews = ['common-platform', 'car-mover', 'routing-toll', 'documents-ocr-evidence', 'opportunity-communications', 'tacho', 'legislation-safety'];
const candidateViews = new Set(['tacho', 'legislation-safety']);
const forbiddenMembershipFields = ['status', 'version', 'content', 'sha256', 'canonicalPath', 'canonicalUri', 'retention', 'supersedes', 'supersededBy'];
const checks = [];

check('SCHEMAS_PRESENT_AND_JSON_VALID', () => {
  for (const file of ['canonical-source.schema.json', 'canonical-source-registry.schema.json', 'domain-membership.schema.json', 'domain-membership-collection.schema.json', 'domain-view.schema.json', 'source-domain-mapping.schema.json']) {
    const schema = readJson(`AGM_LIBRARY/SCHEMAS/${file}`);
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `SCHEMA_DRAFT_INVALID:${file}`);
    assert(schema.additionalProperties === false, `SCHEMA_NOT_CLOSED:${file}`);
  }
});

check('CENTRAL_REGISTRY_SINGLE_SOURCE_OF_TRUTH', () => {
  assert(registry.authority === 'AGM_CENTRAL_REGISTRY', 'CENTRAL_AUTHORITY_INVALID');
  assert(registry.authorityMode === 'SINGLE_SOURCE_OF_TRUTH', 'SOT_MODE_INVALID');
  assert(registry.sourceMode === 'REFERENCE_ONLY_NO_PHYSICAL_COPY', 'SOURCE_MODE_INVALID');
  assert(registry.bootstrapSource === 'CAR_MOVER/INDEX.json', 'BOOTSTRAP_SOURCE_INVALID');
  assert(registry.sourceCount === 798 && registry.sources.length === 798, 'CANONICAL_SOURCE_COUNT_INVALID');
});

check('CANONICAL_SOURCE_IDENTITY_AND_METADATA_PRESERVED', () => {
  assert(new Set(registry.sources.map((source) => source.sourceId)).size === registry.sources.length, 'DUPLICATE_SOURCE_ID');
  assert(new Set(registry.sources.map((source) => source.canonicalPath)).size === registry.sources.length, 'DUPLICATE_CANONICAL_PATH');
  const bootstrapById = new Map(bootstrap.records.map((source) => [source.id, source]));
  for (const source of registry.sources) {
    const original = bootstrapById.get(source.sourceId);
    assert(original, `SOURCE_ID_NOT_IN_BOOTSTRAP:${source.sourceId}`);
    for (const field of ['canonicalPath', 'sha256', 'version', 'status', 'owner']) {
      const originalField = field === 'canonicalPath' ? original.path : original[field];
      assert(source[field] === originalField, `CENTRAL_METADATA_CHANGED:${source.sourceId}:${field}`);
    }
    assert(source.provenance.originalPreserved === true, `ORIGINAL_NOT_PRESERVED:${source.sourceId}`);
    assert(source.provenance.libraryCopyCreated === false, `LIBRARY_COPY_FLAG_INVALID:${source.sourceId}`);
    assert(source.retention.deleteAuthorized === false, `DELETE_AUTHORIZED:${source.sourceId}`);
    assert(source.retention.historicalEvidencePreserved === true, `HISTORY_NOT_PRESERVED:${source.sourceId}`);
    assert(!source.canonicalPath.startsWith('AGM_LIBRARY/'), `REGISTRY_RECURSIVE_SOURCE:${source.sourceId}`);
    assert(existsSync(path.join(root, source.canonicalPath)), `CANONICAL_PATH_MISSING:${source.canonicalPath}`);
  }
});

check('DOMAIN_MEMBERSHIP_CANNOT_MUTATE_CENTRAL_METADATA', () => {
  const validSources = new Set(registry.sources.map((source) => source.sourceId));
  const validDomains = new Set(requiredViews);
  assert(membershipCollection.membershipCount === membershipCollection.memberships.length, 'MEMBERSHIP_COUNT_INVALID');
  assert(new Set(membershipCollection.memberships.map((item) => item.membershipId)).size === membershipCollection.memberships.length, 'DUPLICATE_MEMBERSHIP_ID');
  for (const membership of membershipCollection.memberships) {
    assert(validSources.has(membership.sourceId), `MEMBERSHIP_SOURCE_UNKNOWN:${membership.sourceId}`);
    assert(validDomains.has(membership.domainId), `MEMBERSHIP_DOMAIN_UNKNOWN:${membership.domainId}`);
    for (const field of forbiddenMembershipFields) assert(!(field in membership), `MEMBERSHIP_MUTABLE_FIELD_PRESENT:${membership.membershipId}:${field}`);
  }
});

check('CONTROLLED_VIEWS_REFERENCE_ONLY', () => {
  const membershipById = new Map(membershipCollection.memberships.map((item) => [item.membershipId, item]));
  for (const viewId of requiredViews) {
    const view = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`);
    assert(view.viewId === viewId, `VIEW_ID_INVALID:${viewId}`);
    assert(view.viewType === 'CONTROLLED_REFERENCE_INDEX', `VIEW_TYPE_INVALID:${viewId}`);
    assert(view.centralRegistry === 'AGM_LIBRARY/REGISTRY/canonical-sources.json', `VIEW_REGISTRY_INVALID:${viewId}`);
    assert(view.sourceCount === view.memberships.length, `VIEW_COUNT_INVALID:${viewId}`);
    for (const reference of view.memberships) {
      assert(Object.keys(reference).sort().join(',') === 'membershipId,sourceId', `VIEW_CONTAINS_COPIED_METADATA:${viewId}`);
      const membership = membershipById.get(reference.membershipId);
      assert(membership?.sourceId === reference.sourceId && membership.domainId === viewId, `VIEW_MEMBERSHIP_INVALID:${viewId}:${reference.membershipId}`);
    }
  }
});

check('REQUIRED_VIEW_COUNTS_REPRODUCIBLE', () => {
  const expected = {
    'common-platform': 34,
    'car-mover': 798,
    'routing-toll': 261,
    'documents-ocr-evidence': 163,
    'opportunity-communications': 139,
    tacho: 31,
    'legislation-safety': 40,
  };
  for (const [viewId, count] of Object.entries(expected)) assert(readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`).sourceCount === count, `VIEW_COUNT_DRIFT:${viewId}`);
});

check('CANDIDATE_VIEWS_NOT_AUTHORITATIVE', () => {
  for (const viewId of candidateViews) {
    const view = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`);
    assert(view.authorityStatus === 'CANDIDATE_NOT_AUTHORITATIVE', `CANDIDATE_AUTHORITY_INVALID:${viewId}`);
    const memberships = membershipCollection.memberships.filter((item) => item.domainId === viewId);
    assert(memberships.length > 0, `CANDIDATE_VIEW_EMPTY:${viewId}`);
    assert(memberships.every((item) => item.role === 'CANDIDATE'), `CANDIDATE_ROLE_PROMOTED:${viewId}`);
    assert(memberships.every((item) => item.consumerPolicy === 'DISCOVERY_ONLY_HUMAN_REVIEW_REQUIRED_NO_OPERATIONAL_TRUTH'), `CANDIDATE_POLICY_INVALID:${viewId}`);
  }
});

check('SOURCE_DOMAIN_MAPPING_COMPLETE', () => {
  assert(mapping.sourceCount === registry.sourceCount, 'MAPPING_SOURCE_COUNT_INVALID');
  assert(mapping.membershipCount === membershipCollection.membershipCount, 'MAPPING_MEMBERSHIP_COUNT_INVALID');
  assert(mapping.sources.length === registry.sources.length, 'MAPPING_ROWS_INVALID');
  const mappingIds = new Set(mapping.sources.map((item) => item.sourceId));
  for (const source of registry.sources) assert(mappingIds.has(source.sourceId), `SOURCE_MAPPING_MISSING:${source.sourceId}`);
  for (const row of mapping.sources) {
    assert(row.domains.includes('car-mover'), `CAR_MOVER_MEMBERSHIP_MISSING:${row.sourceId}`);
    assert(row.domains.length === row.membershipIds.length, `MAPPING_CARDINALITY_INVALID:${row.sourceId}`);
  }
});

check('DOMAIN_OWNERSHIP_AND_POLICY_COMPLETE', () => {
  assert(policies.centralAuthority === 'AGM_CENTRAL_REGISTRY', 'POLICY_CENTRAL_AUTHORITY_INVALID');
  assert(policies.domains.length === requiredViews.length, 'POLICY_DOMAIN_COUNT_INVALID');
  for (const domain of policies.domains) {
    assert(requiredViews.includes(domain.domainId), `POLICY_DOMAIN_UNKNOWN:${domain.domainId}`);
    assert(domain.owner && domain.policyId && domain.consumerPolicy, `POLICY_METADATA_MISSING:${domain.domainId}`);
    assert(domain.mayCopySources === false, `POLICY_COPY_ALLOWED:${domain.domainId}`);
    assert(domain.mayMutateCentralMetadata === false, `POLICY_MUTATION_ALLOWED:${domain.domainId}`);
    assert(domain.mayPromoteSourceStatus === false, `POLICY_PROMOTION_ALLOWED:${domain.domainId}`);
    assert(domain.runtimeAuthority === 'NONE' && domain.publicationAuthority === 'NONE', `POLICY_RUNTIME_AUTHORITY_INVALID:${domain.domainId}`);
  }
});

check('ZERO_PHYSICAL_SOURCE_COPY', () => {
  const allowedExtensions = new Set(['.json']);
  for (const file of files(path.join(libraryRoot, 'VIEWS'))) assert(allowedExtensions.has(path.extname(file)), `NON_INDEX_FILE_IN_VIEW:${relative(file)}`);
  for (const source of registry.sources) assert(source.provenance.libraryCopyCreated === false, `SOURCE_COPY_DETECTED:${source.sourceId}`);
});

check('BASIC_LIBRARIAN_UNCHANGED', () => {
  for (const protectedFile of basicBaseline.protectedHashes) assert(sha(protectedFile.path) === protectedFile.sha256, `BASIC_BASELINE_CHANGED:${protectedFile.path}`);
  assert(!read('apps/web/src/agent-governance.registry.ts').includes('agm-central-librarian'), 'CENTRAL_AGENT_INSERTED_IN_BASIC_RUNTIME_REGISTRY');
});

check('CAR_MOVER_PREMIUM_BOUNDARY_RECONCILED_WITHOUT_HISTORY_REWRITE', () => {
  const decision = read('AGM_LIBRARY/GOVERNANCE/CAR_MOVER_BOUNDARY_DECISION.md');
  assert(decision.includes('not a separate AGM\nproduct or project') || decision.includes('not a separate AGM product or project'), 'CAR_MOVER_CURRENT_BOUNDARY_MISSING');
  assert(decision.includes('Historical sources modified: `NO`'), 'HISTORICAL_REWRITE_POLICY_MISSING');
  assert(existsSync(path.join(root, 'evidence/governance/AGM_CAR_MOVER_FOUNDATION_REUSE_AUDIT_2026-08-12.md')), 'HISTORICAL_SOURCE_A_MISSING');
  assert(existsSync(path.join(root, 'evidence/car-mover/CAR_MOVER_HANDOFF_2026-08-23.md')), 'HISTORICAL_SOURCE_B_MISSING');
});

check('PHASE2_CANONICAL_GAPS_EXACT_AND_NOT_PROMOTED', () => {
  assert(gaps.phase === 'PHASE_2_CANONICAL_SOURCES_ACQUISITION_AND_CONSOLIDATION', 'GAP_PHASE_INVALID');
  assert(gaps.status === 'NOT_STARTED_SEPARATE_MANDATE_REQUIRED', 'GAP_STATUS_INVALID');
  assert(gaps.gaps.length === 15, 'GAP_COUNT_INVALID');
  assert(new Set(gaps.gaps.map((gap) => gap.gapId)).size === gaps.gaps.length, 'DUPLICATE_GAP_ID');
  assert(gaps.rules.officialPrimarySourcesFirst === true && gaps.rules.automaticAuthoritativePromotion === false && gaps.rules.humanReviewBeforeCurrent === true, 'GAP_GOVERNANCE_INVALID');
  for (const gap of gaps.gaps) {
    for (const field of ['gapId', 'domainId', 'requiredSource', 'expectedIssuingBody', 'jurisdictions', 'reviewStatus', 'owner', 'retention']) assert(gap[field] !== undefined && gap[field] !== '', `GAP_FIELD_MISSING:${gap.gapId}:${field}`);
    assert(!['CURRENT', 'AUTHORITATIVE', 'PASS'].includes(gap.reviewStatus), `GAP_FALSE_PROMOTION:${gap.gapId}`);
  }
});

check('NO_RUNTIME_PRODUCTION_TURN_AUTHORITY', () => {
  const contract = read('AGM_LIBRARY/GOVERNANCE/MULTI_LIBRARY_FOUNDATION_CONTRACT.md');
  assert(contract.includes('creates no API, runtime\nroute, TURN projection, heartbeat, health gate, deployment or Production'), 'SCOPE_BOUNDARY_MISSING');
  for (const domain of policies.domains) assert(domain.runtimeAuthority === 'NONE' && domain.publicationAuthority === 'NONE', `AUTHORITY_BOUNDARY_INVALID:${domain.domainId}`);
});

const failed = checks.filter((item) => item.status === 'FAIL');
const viewRows = requiredViews.map((viewId) => {
  const view = readJson(`AGM_LIBRARY/VIEWS/${viewId}.view.json`);
  return `| ${view.displayName} | ${view.sourceCount} | ${view.uniqueContentHashes} | ${view.authorityStatus} |`;
}).join('\n');
const report = `# AGM Multi-Library Foundation — Phase 1 validation report

Generated from foundation version: \`${registry.registryVersion}\`
Bootstrap timestamp: \`${registry.generatedAt}\`
Verdict: **${failed.length === 0 ? 'PASS' : 'FAIL'}**

## Validation results

${checks.map((item) => `- ${item.name} = ${item.status}${item.error ? ` — ${item.error}` : ''}`).join('\n')}

## Controlled views

| View | Memberships | Unique hashes | Authority |
|---|---:|---:|---|
${viewRows}

## Counts

- canonical sources: ${registry.sourceCount};
- domain memberships: ${membershipCollection.membershipCount};
- physical source copies created: 0;
- Phase 2 canonical-source gaps: ${gaps.gaps.length}.

## Scope

- RUNTIME CHANGE = NONE
- PRODUCTION CHANGE = NONE
- TURN CHANGE = NONE
- BASIC LIBRARIAN = UNCHANGED
- HISTORICAL EVIDENCE = PRESERVED
`;
writeFileSync(path.join(libraryRoot, 'REPORTS', 'PHASE1_VALIDATION_REPORT.md'), report, 'utf8');

for (const result of checks) console.log(`${result.name}=${result.status}${result.error ? ` error=${result.error}` : ''}`);
console.log(`CANONICAL_SOURCES=${registry.sourceCount}`);
console.log(`DOMAIN_MEMBERSHIPS=${membershipCollection.membershipCount}`);
console.log(`PHASE2_GAPS=${gaps.gaps.length}`);
console.log(`PHASE1_MULTI_LIBRARY_FOUNDATION=${failed.length === 0 ? 'PASS' : 'FAIL'}`);
if (failed.length > 0) process.exitCode = 1;

function check(name, operation) {
  try {
    operation();
    checks.push({ name, status: 'PASS' });
  } catch (error) {
    checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
  }
}

function files(directory, result = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files(absolute, result);
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function relative(absolutePath) {
  return path.relative(root, absolutePath).replaceAll('\\', '/');
}

function sha(relativePath) {
  const absolute = path.join(root, relativePath);
  assert(statSync(absolute).isFile(), `NOT_A_FILE:${relativePath}`);
  return createHash('sha256').update(readFileSync(absolute)).digest('hex');
}

function assert(value, message) {
  if (!value) throw new Error(message);
}
