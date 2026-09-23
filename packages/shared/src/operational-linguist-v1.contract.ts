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
export const OPERATIONAL_LINGUIST_V1_BASELINE_DIGEST = 'sha256:f5c9ffef6cdd240f7788f024942f00f606dfb208032fc3ed3d558bee69a22820';

export const OPERATIONAL_LINGUIST_V1_LANGUAGES = ['it', 'es', 'sv'] as const;
export type OperationalLinguistV1Language = (typeof OPERATIONAL_LINGUIST_V1_LANGUAGES)[number];

export const OPERATIONAL_LINGUIST_V1_COMPONENTS = {
  it: { componentId: 'premium-linguist-it', authorityScope: 'premium.linguistic.it', catalogDigest: 'sha256:5cf389fc2f2e60ff9d9a0dd6acd008ee370b07065e85e41f53f95610e260ea25' },
  es: { componentId: 'premium-linguist-es', authorityScope: 'premium.linguistic.es', catalogDigest: 'sha256:04d8f19c417113ef80550510007987aac56883461d4570eb15f58274afcece6f' },
  sv: { componentId: 'premium-linguist-sv', authorityScope: 'premium.linguistic.sv', catalogDigest: 'sha256:d9dae5ba8701281e4c21f258926702b517c729d608e4d23d0ddcbcae0c2ef90f' },
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
