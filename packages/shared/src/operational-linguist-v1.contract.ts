import {
  canonicalLinguisticResourceCounts,
  LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
  LINGUISTIC_RESOURCE_CONTRACT_VERSION,
  type LinguisticResourceCounts,
} from './linguistic-resource-contract';

export const OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION = 'agm.operational-linguist-evidence.v1';
export const OPERATIONAL_LINGUIST_V1_BASELINE_VERSION = 'agm.operational-linguist.v1';
export const OPERATIONAL_LINGUIST_V1_PUBLISHER_POLICY = 'github-actions-oidc.v1';
export const OPERATIONAL_LINGUIST_V1_WRITER_ID = 'agm.operational-linguist.workflow-auditor';
export const OPERATIONAL_LINGUIST_V1_WRITER_VERSION = '1.0.0';
export const OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST = 'sha256:3888efd48d32036e9a0b0f9880859938c26519e1d190a863f04f50204e2fbdf4';

export const OPERATIONAL_LINGUIST_V1_LANGUAGES = ['it', 'es', 'sv'] as const;
export type OperationalLinguistV1Language = (typeof OPERATIONAL_LINGUIST_V1_LANGUAGES)[number];

export const OPERATIONAL_LINGUIST_V1_COMPONENTS = {
  it: { componentId: 'premium-linguist-it', authorityScope: 'premium.linguistic.it', catalogDigest: 'sha256:e91e75fd69ab2c000e515fa987364859581f00fe72264a2e8a3205f6cf15caba' },
  es: { componentId: 'premium-linguist-es', authorityScope: 'premium.linguistic.es', catalogDigest: 'sha256:7fceb6c9f8819d1cd15878bf0363922954144729bda71b4619a600c82849ca50' },
  sv: { componentId: 'premium-linguist-sv', authorityScope: 'premium.linguistic.sv', catalogDigest: 'sha256:2545d9bcee9d5201cef1145ac64df9603396c39abff2f685a22baaa0bf3bc8a8' },
} as const;

export type OperationalLinguistV1ComponentId =
  (typeof OPERATIONAL_LINGUIST_V1_COMPONENTS)[OperationalLinguistV1Language]['componentId'];

export const OPERATIONAL_LINGUIST_V1_COMPONENT_IDS = OPERATIONAL_LINGUIST_V1_LANGUAGES.map(
  (language) => OPERATIONAL_LINGUIST_V1_COMPONENTS[language].componentId,
) as readonly OperationalLinguistV1ComponentId[];

export const OPERATIONAL_LINGUIST_V1_BASELINE_CANONICAL = [
  OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
  `schema=${OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION}`,
  `publisherPolicy=${OPERATIONAL_LINGUIST_V1_PUBLISHER_POLICY}`,
  `writer=${OPERATIONAL_LINGUIST_V1_WRITER_ID}@${OPERATIONAL_LINGUIST_V1_WRITER_VERSION}`,
  ...OPERATIONAL_LINGUIST_V1_LANGUAGES.map((language) => {
    const component = OPERATIONAL_LINGUIST_V1_COMPONENTS[language];
    return `${language}=${component.componentId}@${component.authorityScope}@${component.catalogDigest}`;
  }),
  `resourceContract=${LINGUISTIC_RESOURCE_CONTRACT_VERSION}`,
  `resourceDigest=${LINGUISTIC_RESOURCE_CONTRACT_DIGEST}`,
  ...Object.entries(canonicalLinguisticResourceCounts()).map(([key, value]) => `${key}=${value}`),
].join('|');

export type OperationalLinguistV1Definition = {
  componentId: OperationalLinguistV1ComponentId;
  language: OperationalLinguistV1Language;
  authorityScope: `premium.linguistic.${OperationalLinguistV1Language}`;
  mandateOwner: 'premium.orchestrator';
  mandatePermission: 'i18n.catalog.read';
  schemaVersion: typeof OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION;
  baselineVersion: typeof OPERATIONAL_LINGUIST_V1_BASELINE_VERSION;
  baselineDigest: typeof OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST;
  publisherPolicy: typeof OPERATIONAL_LINGUIST_V1_PUBLISHER_POLICY;
  resourceContractVersion: typeof LINGUISTIC_RESOURCE_CONTRACT_VERSION;
  resourceContractDigest: typeof LINGUISTIC_RESOURCE_CONTRACT_DIGEST;
  resourceCatalogDigest: string;
  resourceCounts: LinguisticResourceCounts;
};

export function createCanonicalOperationalLinguist(
  language: OperationalLinguistV1Language,
): OperationalLinguistV1Definition {
  const component = OPERATIONAL_LINGUIST_V1_COMPONENTS[language];
  return Object.freeze({
    componentId: component.componentId,
    language,
    authorityScope: component.authorityScope,
    mandateOwner: 'premium.orchestrator',
    mandatePermission: 'i18n.catalog.read',
    schemaVersion: OPERATIONAL_LINGUIST_V1_SCHEMA_VERSION,
    baselineVersion: OPERATIONAL_LINGUIST_V1_BASELINE_VERSION,
    baselineDigest: OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST,
    publisherPolicy: OPERATIONAL_LINGUIST_V1_PUBLISHER_POLICY,
    resourceContractVersion: LINGUISTIC_RESOURCE_CONTRACT_VERSION,
    resourceContractDigest: LINGUISTIC_RESOURCE_CONTRACT_DIGEST,
    resourceCatalogDigest: component.catalogDigest,
    resourceCounts: Object.freeze(canonicalLinguisticResourceCounts()),
  });
}

export type OperationalLinguistV1Evidence = {
  schemaVersion: string;
  baselineVersion: string;
  baselineDigest: string;
  componentId: string;
  language: string;
  operationalState: string;
  observedAt: string;
  publisher: {
    registrationId: string;
    authorityEpoch: number;
    sequence: number;
  };
  resources: {
    contractVersion: string;
    contractDigest: string;
    catalogDigest: string;
    app: number;
    operational: number;
    carMover: number;
    premium: number;
    total: number;
  };
  errors: {
    count: number;
    codes: string[];
  };
};

export type OperationalLinguistV1Audit = {
  componentId: OperationalLinguistV1ComponentId;
  language: OperationalLinguistV1Language;
  operationalState: 'ONLINE' | 'DEGRADED';
  resources: OperationalLinguistV1Evidence['resources'];
  errors: OperationalLinguistV1Evidence['errors'];
  resourceEvidenceDigest: string;
};
