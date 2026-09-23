import {
  createCanonicalOperationalLinguist,
  OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
  OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
  OPERATIONAL_LINGUIST_V1_COMPONENT_IDS,
  OPERATIONAL_LINGUIST_V1_LANGUAGES,
  OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION,
  type OperationalLinguistV1Evidence,
  type OperationalLinguistV1Language,
} from './operational-linguist-v1.contract';

export type OperationalLinguistV1ValidationIssue =
  | 'NOT_AN_OBJECT'
  | 'UNKNOWN_PROPERTY'
  | 'MISSING_PROPERTY'
  | 'INCOMPATIBLE_SCHEMA'
  | 'WRONG_BASELINE_VERSION'
  | 'WRONG_BASELINE_DIGEST'
  | 'UNKNOWN_COMPONENT'
  | 'UNKNOWN_LANGUAGE'
  | 'IDENTITY_LANGUAGE_MISMATCH'
  | 'INVALID_OPERATIONAL_STATE'
  | 'INVALID_OBSERVED_AT'
  | 'INVALID_PUBLISHER_BINDING'
  | 'WRONG_CONTRACT_VERSION'
  | 'WRONG_CONTRACT_DIGEST'
  | 'WRONG_CATALOG_DIGEST'
  | 'WRONG_RESOURCE_COUNTS'
  | 'INCONSISTENT_RESOURCE_TOTAL'
  | 'INVALID_ERRORS';

export type OperationalLinguistV1Validation = {
  valid: boolean;
  issues: OperationalLinguistV1ValidationIssue[];
  evidence: OperationalLinguistV1Evidence | null;
};

const ROOT_KEYS = ['schemaVersion', 'baselineVersion', 'baselineDigest', 'componentId', 'language', 'operationalState', 'observedAt', 'publisher', 'resources', 'errors'];
const PUBLISHER_KEYS = ['registrationId', 'authorityEpoch', 'sequence'];
const RESOURCE_KEYS = ['contractVersion', 'contractDigest', 'catalogDigest', 'app', 'operational', 'carMover', 'premium', 'total'];
const ERROR_KEYS = ['count', 'codes'];

export function validateOperationalLinguistV1Evidence(value: unknown): OperationalLinguistV1Validation {
  if (!record(value)) return invalid(['NOT_AN_OBJECT']);
  const issues: OperationalLinguistV1ValidationIssue[] = [];
  exactKeys(value, ROOT_KEYS, issues);
  if (!record(value.publisher)) issues.push('INVALID_PUBLISHER_BINDING');
  else exactKeys(value.publisher, PUBLISHER_KEYS, issues);
  if (!record(value.resources)) issues.push('WRONG_RESOURCE_COUNTS');
  else exactKeys(value.resources, RESOURCE_KEYS, issues);
  if (!record(value.errors)) issues.push('INVALID_ERRORS');
  else exactKeys(value.errors, ERROR_KEYS, issues);

  if (value.schemaVersion !== OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION) issues.push('INCOMPATIBLE_SCHEMA');
  if (value.baselineVersion !== OPERATIONAL_LINGUIST_V1_BASELINE_VERSION) issues.push('WRONG_BASELINE_VERSION');
  if (value.baselineDigest !== OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST) issues.push('WRONG_BASELINE_DIGEST');
  if (!(OPERATIONAL_LINGUIST_V1_COMPONENT_IDS as readonly unknown[]).includes(value.componentId)) issues.push('UNKNOWN_COMPONENT');
  if (!(OPERATIONAL_LINGUIST_V1_LANGUAGES as readonly unknown[]).includes(value.language)) issues.push('UNKNOWN_LANGUAGE');

  if ((OPERATIONAL_LINGUIST_V1_LANGUAGES as readonly unknown[]).includes(value.language)) {
    const definition = createCanonicalOperationalLinguist(value.language as OperationalLinguistV1Language);
    if (value.componentId !== definition.componentId) issues.push('IDENTITY_LANGUAGE_MISMATCH');
    if (record(value.resources)) {
      if (value.resources.contractVersion !== definition.resourceContractVersion) issues.push('WRONG_CONTRACT_VERSION');
      if (value.resources.contractDigest !== definition.resourceContractDigest) issues.push('WRONG_CONTRACT_DIGEST');
      if (value.resources.catalogDigest !== definition.resourceCatalogDigest) issues.push('WRONG_CATALOG_DIGEST');
      const counts = definition.resourceCounts;
      if (value.resources.app !== counts.app || value.resources.operational !== counts.operational || value.resources.carMover !== counts.carMover || value.resources.premium !== counts.premium) issues.push('WRONG_RESOURCE_COUNTS');
      if (!integers([value.resources.app, value.resources.operational, value.resources.carMover, value.resources.premium, value.resources.total])
        || value.resources.total !== Number(value.resources.app) + Number(value.resources.operational) + Number(value.resources.carMover) + Number(value.resources.premium)) issues.push('INCONSISTENT_RESOURCE_TOTAL');
    }
  }
  if (value.operationalState !== 'ONLINE') issues.push('INVALID_OPERATIONAL_STATE');
  if (typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt))) issues.push('INVALID_OBSERVED_AT');
  if (!record(value.publisher)
    || typeof value.publisher.registrationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.publisher.registrationId)
    || !positiveInteger(value.publisher.authorityEpoch)
    || !positiveInteger(value.publisher.sequence)) issues.push('INVALID_PUBLISHER_BINDING');
  if (!record(value.errors)
    || value.errors.count !== 0
    || !Array.isArray(value.errors.codes)
    || value.errors.codes.length !== 0
    || value.errors.codes.some((code) => typeof code !== 'string')) issues.push('INVALID_ERRORS');

  const uniqueIssues = [...new Set(issues)];
  return uniqueIssues.length ? invalid(uniqueIssues) : { valid: true, issues: [], evidence: value as OperationalLinguistV1Evidence };
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], issues: OperationalLinguistV1ValidationIssue[]) {
  const expectedSet = new Set(expected);
  if (Object.keys(value).some((key) => !expectedSet.has(key))) issues.push('UNKNOWN_PROPERTY');
  if (expected.some((key) => !(key in value))) issues.push('MISSING_PROPERTY');
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function positiveInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function integers(values: unknown[]) {
  return values.every((value) => Number.isSafeInteger(value) && Number(value) >= 0);
}

function invalid(issues: OperationalLinguistV1ValidationIssue[]): OperationalLinguistV1Validation {
  return { valid: false, issues, evidence: null };
}
