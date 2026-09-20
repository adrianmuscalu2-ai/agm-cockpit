export const LINGUISTIC_RESOURCE_CONTRACT_VERSION = 'agm.linguistic-resource-counts.v1';

export const LINGUISTIC_RESOURCE_COMPONENT_KEYS = [
  'app',
  'operational',
  'carMover',
  'premium',
] as const;

export type LinguisticResourceComponentKey = (typeof LINGUISTIC_RESOURCE_COMPONENT_KEYS)[number];
export type LinguisticResourceComponents = Record<LinguisticResourceComponentKey, number>;
export type LinguisticResourceCounts = LinguisticResourceComponents & { total: number };

export const LINGUISTIC_RESOURCE_COMPONENTS: Readonly<LinguisticResourceComponents> = Object.freeze({
  app: 1182,
  operational: 308,
  carMover: 37,
  premium: 199,
});

export const LINGUISTIC_RESOURCE_CONTRACT_CANONICAL = [
  LINGUISTIC_RESOURCE_CONTRACT_VERSION,
  ...LINGUISTIC_RESOURCE_COMPONENT_KEYS.map((key) => `${key}=${LINGUISTIC_RESOURCE_COMPONENTS[key]}`),
].join('|');

export const LINGUISTIC_RESOURCE_CONTRACT_DIGEST = 'sha256:8c2207d91a261c69af17eca9746867c14c603dcc0edc061d74c88330ceb721b1';

export function deriveLinguisticResourceTotal(components: LinguisticResourceComponents) {
  return LINGUISTIC_RESOURCE_COMPONENT_KEYS.reduce((total, key) => total + components[key], 0);
}

export function linguisticResourceCounts(components: LinguisticResourceComponents): LinguisticResourceCounts {
  return { ...components, total: deriveLinguisticResourceTotal(components) };
}

export function canonicalLinguisticResourceCounts(): LinguisticResourceCounts {
  return linguisticResourceCounts(LINGUISTIC_RESOURCE_COMPONENTS);
}

export type LinguisticResourceEvidenceInput = {
  language: string;
  counts: LinguisticResourceCounts;
  errors: number;
  journalStatus: string;
};

export function formatLinguisticResourceEvidence(input: LinguisticResourceEvidenceInput) {
  const { app, operational, carMover, premium, total } = input.counts;
  return [
    `contract=${LINGUISTIC_RESOURCE_CONTRACT_VERSION}`,
    `contractDigest=${LINGUISTIC_RESOURCE_CONTRACT_DIGEST}`,
    `language=${input.language}`,
    `app=${app}`,
    `operational=${operational}`,
    `carMover=${carMover}`,
    `premium=${premium}`,
    `total=${total}`,
    `errors=${input.errors}`,
    `journal=${input.journalStatus}`,
  ].join(';');
}

export type LinguisticResourceEvidenceValidation = {
  valid: boolean;
  resourceCountProven: boolean;
  contractVersionMatches: boolean;
  contractDigestMatches: boolean;
  componentsMatchCanonical: boolean;
  totalMatchesComponents: boolean;
  errorsZero: boolean;
  counts: LinguisticResourceCounts | null;
};

export function validateLinguisticResourceEvidence(detail: string): LinguisticResourceEvidenceValidation {
  const fields = parseEvidenceFields(detail);
  const counts = fields ? parseCounts(fields) : null;
  const contractVersionMatches = fields?.get('contract') === LINGUISTIC_RESOURCE_CONTRACT_VERSION;
  const contractDigestMatches = fields?.get('contractDigest') === LINGUISTIC_RESOURCE_CONTRACT_DIGEST;
  const componentsMatchCanonical = Boolean(counts && LINGUISTIC_RESOURCE_COMPONENT_KEYS.every(
    (key) => counts[key] === LINGUISTIC_RESOURCE_COMPONENTS[key],
  ));
  const totalMatchesComponents = Boolean(counts && counts.total === deriveLinguisticResourceTotal(counts));
  const errorsZero = fields?.get('errors') === '0';
  const resourceCountProven = Boolean(
    counts
    && contractVersionMatches
    && contractDigestMatches
    && componentsMatchCanonical
    && totalMatchesComponents,
  );
  return {
    valid: resourceCountProven && errorsZero,
    resourceCountProven,
    contractVersionMatches,
    contractDigestMatches,
    componentsMatchCanonical,
    totalMatchesComponents,
    errorsZero,
    counts,
  };
}

function parseEvidenceFields(detail: string) {
  const fields = new Map<string, string>();
  for (const segment of detail.split(';')) {
    const separator = segment.indexOf('=');
    if (separator <= 0) return null;
    const key = segment.slice(0, separator);
    const value = segment.slice(separator + 1);
    if (fields.has(key)) return null;
    fields.set(key, value);
  }
  return fields;
}

function parseCounts(fields: ReadonlyMap<string, string>): LinguisticResourceCounts | null {
  const count = (key: LinguisticResourceComponentKey | 'total') => {
    const raw = fields.get(key);
    return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  };
  const counts = {
    app: count('app'),
    operational: count('operational'),
    carMover: count('carMover'),
    premium: count('premium'),
    total: count('total'),
  };
  return Object.values(counts).every((value) => Number.isSafeInteger(value) && value >= 0) ? counts : null;
}
