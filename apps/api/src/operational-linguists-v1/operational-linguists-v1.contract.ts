import type { RequestContext } from '../common/request-context';

export type OperationalLinguistV1Actor = RequestContext & {
  actorType: 'GitHubActionsOIDC';
  actorSubject: string;
  actorMetadata: Record<string, string>;
};

export type OperationalLinguistV1Request = {
  headers: { authorization?: string };
  machineProvisioning: OperationalLinguistV1Actor;
};

export const OPERATIONAL_LINGUIST_V1_FRESHNESS_MS = 24 * 60 * 60 * 1000;
export const OPERATIONAL_LINGUIST_V1_MAX_PAST_SKEW_MS = 15 * 60 * 1000;
export const OPERATIONAL_LINGUIST_V1_MAX_FUTURE_SKEW_MS = 60 * 1000;
export const OPERATIONAL_LINGUIST_V1_PUBLISHER_TTL_MS = 10 * 60 * 1000;
