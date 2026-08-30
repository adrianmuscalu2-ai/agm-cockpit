import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registryRelative = 'AGM_LIBRARY/REGISTRY/canonical-sources.json';
const viewRelative = 'AGM_LIBRARY/VIEWS/routing-toll.view.json';
const outputRelative = 'AGM_LIBRARY/PHASE3/ROUTING_TOLL_001_ASSESSMENT/ROUTING_TOLL_VIEW_263_SOURCE_AUDIT.json';
const expectedRegistrySha256 = 'af9940ec068684b136a2e0b7499c27ffbb8489d15a3a89413c2160e9e77d6a31';

const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const registryBuffer = readFileSync(path.join(root, registryRelative));
const registry = JSON.parse(registryBuffer.toString('utf8'));
const view = readJson(viewRelative);
const bySourceId = new Map(registry.sources.map((source) => [source.sourceId, source]));

function auditClass(source) {
  if (source.authority?.authorityType === 'AUTHORITATIVE_WITH_SCOPE') {
    return 'AUTHORITATIVE_WITH_SCOPE';
  }
  if (['HISTORICAL', 'EVIDENCE', 'SUPERSEDED'].includes(source.status)) {
    return 'HISTORICAL_OR_EVIDENCE';
  }
  return 'CANDIDATE_NOT_AUTHORITATIVE';
}

function subjectScope(source) {
  const value = [source.canonicalPath, source.title, source.owner, ...(source.evidenceRefs ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const scopes = [];
  if (/toll|maut|vignette/.test(value)) scopes.push('TOLL');
  if (/rout|tomtom|valhalla|navigation|map/.test(value)) scopes.push('ROUTING');
  if (/field|observation|telemetry/.test(value)) scopes.push('FIELD_EVIDENCE');
  if (/architect|policy|contract|runbook/.test(value)) scopes.push('INTERNAL_POLICY');
  if (/test|report|evidence|screenshot|incident/.test(value)) scopes.push('TEST_OR_EVIDENCE');
  return scopes.length ? [...new Set(scopes)] : ['INDEX_ONLY'];
}

function contribution(source) {
  if (source.sourceId === 'CS-AGM-CM-ARCH-V1') {
    return 'Defines approved internal Car Mover routing architecture and provider boundaries; does not establish external toll law or tariffs.';
  }
  if (source.sourceId === 'CS-AGM-CM-FIELD-RUNBOOK-V1') {
    return 'Defines controlled field-evidence collection; measured evidence cannot substitute for official toll authority.';
  }
  if (source.status === 'EVIDENCE') {
    return 'Preserved operational/test evidence only; no external toll authority contribution.';
  }
  if (['HISTORICAL', 'SUPERSEDED'].includes(source.status)) {
    return 'Preserved historical record only; not current toll authority.';
  }
  return 'Internal implementation, documentation or index material; external authority remains unassessed and it cannot close ROUTING-TOLL-001.';
}

const rows = view.memberships.map((membership) => {
  const source = bySourceId.get(membership.sourceId);
  if (!source) throw new Error(`View source missing from registry: ${membership.sourceId}`);
  const artifactRelative = source.canonicalPath ?? null;
  const artifactAbsolute = artifactRelative ? path.join(root, artifactRelative) : null;
  const artifactExists = artifactAbsolute ? existsSync(artifactAbsolute) : false;
  let actualSha256 = null;
  let integrityStatus = 'NO_LOCAL_ARTIFACT';
  if (artifactExists) {
    actualSha256 = sha256(readFileSync(artifactAbsolute));
    integrityStatus = actualSha256 === source.sha256 ? 'MATCH' : 'MISMATCH';
  }
  return {
    membershipId: membership.membershipId,
    sourceId: source.sourceId,
    canonicalPath: artifactRelative,
    canonicalUri: source.canonicalUri ?? null,
    canonicalAuthority: source.authority?.issuingBody ?? null,
    authorityClassification: source.authority?.authorityType ?? 'UNKNOWN',
    auditClass: auditClass(source),
    jurisdictions: source.authority?.jurisdictions ?? [],
    routingTollScope: subjectScope(source),
    vehicleScope: 'NOT_ESTABLISHED_BY_REGISTRY_RECORD',
    sourceStatus: source.status,
    sourceDate: source.sourceDate ?? null,
    effectiveDate: source.effectiveDate ?? null,
    version: source.version ?? null,
    freshness: source.effectiveDate || source.sourceDate ? 'DATE_RECORDED_REVIEW_REQUIRED' : 'UNKNOWN',
    verifiedArtifact: artifactExists,
    expectedSha256: source.sha256 ?? null,
    actualSha256,
    integrityStatus,
    duplicateContentSourceIds: [],
    exactContribution: contribution(source),
    routingToll001Coverage: source.sourceId.startsWith('CS-AGM-')
      ? 'INTERNAL_SUPPORT_ONLY'
      : 'NO_AUTHORITATIVE_EXTERNAL_COVERAGE',
  };
});

const idsByHash = new Map();
for (const row of rows) {
  if (!row.expectedSha256) continue;
  const ids = idsByHash.get(row.expectedSha256) ?? [];
  ids.push(row.sourceId);
  idsByHash.set(row.expectedSha256, ids);
}
for (const row of rows) {
  row.duplicateContentSourceIds = (idsByHash.get(row.expectedSha256) ?? []).filter((id) => id !== row.sourceId);
}

const countBy = (values) => Object.fromEntries(
  [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
);
const duplicateGroups = [...idsByHash.entries()]
  .filter(([, sourceIds]) => sourceIds.length > 1)
  .map(([hash, sourceIds]) => ({ sha256: hash, sourceIds }))
  .sort((a, b) => a.sha256.localeCompare(b.sha256));

const output = {
  schemaVersion: 'agm-routing-toll-001-source-audit.v1',
  generatedAt: '2026-08-29T23:30:00.000Z',
  mandate: 'PRODUCT_OWNER_MANDATE_ROUTING_TOLL_001',
  protectedBaseline: {
    centralRegistryPath: registryRelative,
    expectedSourceCount: 815,
    actualSourceCount: registry.sources.length,
    expectedSha256: expectedRegistrySha256,
    actualSha256: sha256(registryBuffer),
    unchanged: registry.sources.length === 815 && sha256(registryBuffer) === expectedRegistrySha256,
    routingTollViewPath: viewRelative,
    routingTollViewSourceCount: view.sourceCount,
  },
  summary: {
    sourcesEvaluated: rows.length,
    auditClassCounts: countBy(rows.map((row) => row.auditClass)),
    registryAuthorityClassificationCounts: countBy(rows.map((row) => row.authorityClassification)),
    sourceStatusCounts: countBy(rows.map((row) => row.sourceStatus)),
    externalOfficialAuthoritiesInRegistry: rows.filter((row) => row.authorityClassification === 'AUTHORITATIVE_WITH_SCOPE' && !row.sourceId.startsWith('CS-AGM-')).length,
    internalAuthoritiesWithScope: rows.filter((row) => row.authorityClassification === 'AUTHORITATIVE_WITH_SCOPE' && row.sourceId.startsWith('CS-AGM-')).length,
    formallyContextualSources: rows.filter((row) => row.authorityClassification === 'CONTEXTUAL').length,
    artifactsPresent: rows.filter((row) => row.verifiedArtifact).length,
    artifactHashMatches: rows.filter((row) => row.integrityStatus === 'MATCH').length,
    artifactHashMismatches: rows.filter((row) => row.integrityStatus === 'MISMATCH').length,
    duplicateHashGroups: duplicateGroups.length,
    recordsInDuplicateHashGroups: duplicateGroups.reduce((sum, group) => sum + group.sourceIds.length, 0),
  },
  duplicateHashGroups: duplicateGroups,
  sources: rows.sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
};

const outputPath = path.join(root, outputRelative);
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output: outputRelative, ...output.summary, registryUnchanged: output.protectedBaseline.unchanged }, null, 2));
