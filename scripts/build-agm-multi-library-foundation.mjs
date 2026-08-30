import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputRoot = path.join(root, 'AGM_LIBRARY');
const bootstrap = readJson('CAR_MOVER/INDEX.json');
const foundationVersion = '1.0.0';
const generatedAt = bootstrap.generatedAt;

const domains = [
  policy('common-platform', 'COMMON PLATFORM VIEW', 'Documentation & Knowledge', 'CONTROLLED_VIEW',
    'Shared platform contracts and governance referenced by multiple AGM domains.'),
  policy('car-mover', 'CAR MOVER VIEW', 'AGM Product Owner / Car Mover Steward', 'CONTROLLED_VIEW',
    'Car Mover is a distinct functional component inside AGM Premium, not a separate product or project.'),
  policy('routing-toll', 'ROUTING / TOLL VIEW', 'Mobility & Routing Steward', 'CONTROLLED_VIEW',
    'Routing, route profiles, toll, vignette and controlled field-measurement knowledge.'),
  policy('documents-ocr-evidence', 'DOCUMENTS / OCR / EVIDENCE VIEW', 'Inspector / Evidence Custody', 'CONTROLLED_VIEW',
    'Document intake, OCR, provenance, evidence and integrity knowledge.'),
  policy('opportunity-communications', 'OPPORTUNITY / COMMUNICATIONS VIEW', 'AGM Product Owner / Communications Steward', 'CONTROLLED_VIEW',
    'Opportunity intake, deduplication, offers and controlled communications knowledge.'),
  policy('tacho', 'TACHO VIEW', 'Transport Compliance Owner (designation required)', 'CANDIDATE_NOT_AUTHORITATIVE',
    'Candidate discovery view only; the current corpus does not establish canonical Tacho authority.'),
  policy('legislation-safety', 'LEGISLATION / SAFETY VIEW', 'Security & Legal / Human Reviewer', 'CANDIDATE_NOT_AUTHORITATIVE',
    'Candidate discovery view only; primary official sources and human review are required.'),
];

const canonicalSources = bootstrap.records.map((record) => ({
  sourceId: record.id,
  canonicalPath: record.path,
  canonicalUri: null,
  mediaType: record.mediaType,
  sizeBytes: record.sizeBytes,
  sha256: record.sha256,
  sourceDate: record.sourceDate,
  effectiveDate: null,
  version: record.version,
  status: record.status,
  owner: record.owner,
  authority: {
    issuingBody: null,
    authorityType: 'UNASSESSED_DOMAIN_AUTHORITY',
    jurisdictions: [],
    reviewStatus: reviewStatus(record.status),
    humanReviewRequired: true,
  },
  provenance: {
    importedFrom: 'CAR_MOVER/INDEX.json',
    observedPath: record.path,
    originalPreserved: record.originalPreserved === true,
    libraryCopyCreated: false,
  },
  retention: retentionFor(record.status),
  evidenceRefs: record.evidenceRefs,
  supersedes: record.supersedes,
  supersededBy: record.supersededBy,
}));

const registry = {
  $schema: '../SCHEMAS/canonical-source-registry.schema.json',
  schemaVersion: 'agm-canonical-source-registry.v1',
  registryVersion: foundationVersion,
  generatedAt,
  authority: 'AGM_CENTRAL_REGISTRY',
  authorityMode: 'SINGLE_SOURCE_OF_TRUTH',
  sourceMode: 'REFERENCE_ONLY_NO_PHYSICAL_COPY',
  bootstrapSource: 'CAR_MOVER/INDEX.json',
  sourceCount: canonicalSources.length,
  sources: canonicalSources,
};

const memberships = [];
for (const source of canonicalSources) {
  const record = bootstrap.records.find((item) => item.id === source.sourceId);
  for (const domain of domains) {
    if (!belongsTo(record, domain.domainId)) continue;
    memberships.push({
      membershipId: membershipId(source.sourceId, domain.domainId),
      sourceId: source.sourceId,
      domainId: domain.domainId,
      role: membershipRole(source.status, domain.authorityStatus),
      rationale: membershipRationale(record, domain.domainId),
      viewVersion: foundationVersion,
      domainOwner: domain.owner,
      consumerPolicy: domain.consumerPolicy,
    });
  }
}

const mapping = {
  $schema: '../SCHEMAS/source-domain-mapping.schema.json',
  schemaVersion: 'agm-source-domain-mapping.v1',
  mappingVersion: foundationVersion,
  generatedAt,
  centralRegistry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  sourceCount: canonicalSources.length,
  membershipCount: memberships.length,
  sources: canonicalSources.map((source) => {
    const sourceMemberships = memberships.filter((item) => item.sourceId === source.sourceId);
    return {
      sourceId: source.sourceId,
      domains: sourceMemberships.map((item) => item.domainId).sort(),
      membershipIds: sourceMemberships.map((item) => item.membershipId).sort(),
    };
  }),
};

const policyMatrix = {
  schemaVersion: 'agm-domain-ownership-policy.v1',
  policyVersion: foundationVersion,
  generatedAt,
  centralAuthority: 'AGM_CENTRAL_REGISTRY',
  centralOwner: 'Documentation & Knowledge',
  invariants: [
    'AGM CENTRAL REGISTRY = SINGLE SOURCE OF TRUTH',
    'DOMAIN LIBRARIES = CONTROLLED VIEWS / INDEXES ONLY',
    'ZERO PHYSICAL COPY BETWEEN LIBRARIES',
    'ONE CANONICAL sourceId PER SOURCE',
    'DOMAIN MEMBERSHIP CANNOT MUTATE CENTRAL STATUS, VERSION OR CONTENT',
    'BASIC LIBRARIAN = LINGUISTIC AUTHORITY ONLY',
    'CAR MOVER = AGM PREMIUM COMPONENT, NOT A SEPARATE PROJECT',
  ],
  domains,
};

const views = domains.map((domain) => {
  const domainMemberships = memberships.filter((item) => item.domainId === domain.domainId);
  const memberSources = domainMemberships.map((item) => registry.sources.find((source) => source.sourceId === item.sourceId));
  return {
    $schema: '../SCHEMAS/domain-view.schema.json',
    schemaVersion: 'agm-domain-view.v1',
    viewId: domain.domainId,
    displayName: domain.displayName,
    viewVersion: foundationVersion,
    generatedAt,
    viewType: 'CONTROLLED_REFERENCE_INDEX',
    authorityStatus: domain.authorityStatus,
    centralRegistry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
    owner: domain.owner,
    policyId: domain.policyId,
    sourceCount: domainMemberships.length,
    uniqueContentHashes: new Set(memberSources.map((source) => source.sha256)).size,
    memberships: domainMemberships.map(({ membershipId: id, sourceId }) => ({ membershipId: id, sourceId })),
  };
});

mkdir('REGISTRY');
mkdir('MAPPINGS');
mkdir('VIEWS');
mkdir('GOVERNANCE');
mkdir('REPORTS');
writeJson('REGISTRY/canonical-sources.json', registry);
writeJson('MAPPINGS/domain-memberships.json', {
  $schema: '../SCHEMAS/domain-membership-collection.schema.json',
  schemaVersion: 'agm-domain-membership-collection.v1',
  collectionVersion: foundationVersion,
  generatedAt,
  centralRegistry: 'AGM_LIBRARY/REGISTRY/canonical-sources.json',
  membershipCount: memberships.length,
  memberships,
});
writeJson('MAPPINGS/source-domain-mapping.json', mapping);
writeJson('GOVERNANCE/domain-ownership-policy.json', policyMatrix);
for (const view of views) writeJson(`VIEWS/${view.viewId}.view.json`, view);

console.log(`AGM_CENTRAL_REGISTRY=BUILT sources=${registry.sourceCount}`);
for (const view of views) console.log(`${view.viewId.toUpperCase().replaceAll('-', '_')}_VIEW=BUILT sources=${view.sourceCount} hashes=${view.uniqueContentHashes} authority=${view.authorityStatus}`);
console.log(`DOMAIN_MEMBERSHIPS=BUILT memberships=${memberships.length}`);
console.log('PHYSICAL_SOURCE_COPIES=0');

function policy(domainId, displayName, owner, authorityStatus, purpose) {
  return {
    domainId,
    displayName,
    policyId: `POLICY-${domainId.toUpperCase()}`,
    owner,
    authorityStatus,
    purpose,
    consumerPolicy: authorityStatus === 'CANDIDATE_NOT_AUTHORITATIVE'
      ? 'DISCOVERY_ONLY_HUMAN_REVIEW_REQUIRED_NO_OPERATIONAL_TRUTH'
      : 'READ_ONLY_VERSION_PINNED_WITH_PROVENANCE',
    mayCopySources: false,
    mayMutateCentralMetadata: false,
    mayPromoteSourceStatus: false,
    runtimeAuthority: 'NONE',
    publicationAuthority: 'NONE',
  };
}

function belongsTo(record, domainId) {
  const sourceText = readSourceText(record);
  const pathValue = record.path.toLowerCase();
  const tags = new Set(record.tags);
  const category = record.category;
  const signal = `${record.path}\n${sourceText}`;
  if (domainId === 'car-mover') return true;
  if (domainId === 'routing-toll') return tags.has('ROUTING') || tags.has('TOLL') || ['ROUTING', 'TOLL', 'FIELD'].includes(category);
  if (domainId === 'documents-ocr-evidence') return tags.has('OCR_DOCUMENTS') || ['OCR_DOCUMENTS', 'EVIDENCE'].includes(category) || /(^|[/_.-])(ocr|document|invoice|protocol)([/_.-]|$)/i.test(record.path);
  if (domainId === 'opportunity-communications') return tags.has('OPPORTUNITY_INTELLIGENCE') || category === 'OPPORTUNITY_INTELLIGENCE';
  if (domainId === 'common-platform') return ['GOVERNANCE', 'RUNBOOKS', 'RELEASES'].includes(category) || /(^|\/)(auth|premium-access|authority-control-plane|agent-governance|deploy\/operations|\.github\/workflows|prisma\/schema)/i.test(pathValue);
  if (domainId === 'tacho') return /tacho|tachograph/i.test(record.path) || countMatches(signal, /tachograph|\btacho\b|driving[- _]?time|rest[- _]?period|hours[- _]?of[- _]?service|pauz(?:a|e|ă)|odihn(?:a|ă|e)|lenkzeit|ruhezeit/gi) >= 3;
  if (domainId === 'legislation-safety') return /legislation|road[-_ ]?safety|load[-_ ]?safety|legal-source|\/legal\//i.test(record.path) || countMatches(signal, /legislation|legislative|legal source|regulation\s*\(?(?:EC|EU)|road safety|load safety|cargo secur|securitatea (?:rutier|încărc|incarc)|straßenverkehr|stvo|\bgesetz\b|\bADR\b/gi) >= 3;
  return false;
}

function membershipRole(status, authorityStatus) {
  if (authorityStatus === 'CANDIDATE_NOT_AUTHORITATIVE') return 'CANDIDATE';
  if (status === 'EVIDENCE') return 'EVIDENCE';
  if (status === 'HISTORICAL' || status === 'SUPERSEDED') return 'HISTORICAL';
  if (status === 'DRAFT') return 'CONTEXTUAL';
  return 'DOMAIN_PRIMARY';
}

function membershipRationale(record, domainId) {
  if (domainId === 'car-mover') return 'Member of the consolidated Car Mover corpus; reference only.';
  if (domainId === 'tacho' || domainId === 'legislation-safety') return 'Semantic candidate detected in the existing corpus; not authoritative and requires canonical-source acquisition plus human review.';
  return `Matched controlled ${domainId} classification using existing category, tags or canonical path metadata.`;
}

function reviewStatus(status) {
  if (status === 'CURRENT') return 'DOCUMENTARY_CURRENT_NOT_DOMAIN_REVIEWED';
  if (status === 'EVIDENCE') return 'EVIDENCE_PRESERVED_NOT_DOMAIN_AUTHORITY';
  if (status === 'HISTORICAL' || status === 'SUPERSEDED') return 'HISTORICAL_PRESERVED';
  return 'DRAFT_NOT_APPROVED';
}

function retentionFor(status) {
  return {
    classification: status === 'EVIDENCE' ? 'EVIDENCE_IMMUTABLE' : status === 'HISTORICAL' || status === 'SUPERSEDED' ? 'HISTORICAL_PRESERVE' : 'SOURCE_CONTROLLED_PRESERVE',
    deleteAuthorized: false,
    historicalEvidencePreserved: true,
  };
}

function readSourceText(record) {
  if (!/^(text\/|application\/(json|xml|javascript|typescript|sql))/.test(record.mediaType) || record.sizeBytes > 2_000_000) return '';
  const absolute = path.join(root, record.path);
  try {
    if (!statSync(absolute).isFile()) return '';
    return readFileSync(absolute, 'utf8');
  } catch {
    return '';
  }
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function membershipId(sourceId, domainId) {
  return `DM-${createHash('sha256').update(`${sourceId}:${domainId}`).digest('hex').slice(0, 20).toUpperCase()}`;
}

function mkdir(relativeDirectory) {
  mkdirSync(path.join(outputRoot, relativeDirectory), { recursive: true });
}

function writeJson(relativePath, value) {
  writeFileSync(path.join(outputRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}
