export const canonicalAuthorityDomains = ['ROUTING_TOLL', 'LEGISLATION_SAFETY'] as const;
export type CanonicalAuthorityDomain = typeof canonicalAuthorityDomains[number];

export const canonicalRuntimeStates = [
  'CANONICAL_CURRENT',
  'CONTEXTUAL_ONLY',
  'FRESHNESS_UNKNOWN',
  'EXPIRED_REVIEW_REQUIRED',
  'NEW_VERSION_DETECTED',
  'UNKNOWN_HUMAN_VERIFICATION',
] as const;
export type CanonicalRuntimeState = typeof canonicalRuntimeStates[number];

export type CanonicalAuthorityType =
  | 'AUTHORITATIVE'
  | 'AUTHORITATIVE_WITH_SCOPE'
  | 'CONTEXTUAL'
  | string;

export type CanonicalSource = {
  sourceId: string;
  canonicalPath: string;
  canonicalUri: string | null;
  sha256: string;
  sourceDate: string | null;
  effectiveDate: string | null;
  version: string | null;
  status: string;
  authority: {
    issuingBody: string | null;
    authorityType: CanonicalAuthorityType;
    jurisdictions: string[];
    reviewStatus: string;
    humanReviewRequired: boolean;
  };
  provenance: Record<string, unknown>;
  evidenceRefs: string[];
  supersedes: string[];
  supersededBy: string[];
  freshness?: {
    effectiveFrom?: string | null;
    effectiveUntil?: string | null;
    capturedAt?: string | null;
    lastFreshnessCheck?: string | null;
    nextFreshnessCheck?: string | null;
    currentStatus?: string | null;
    reviewRequired?: boolean;
    usageFallback?: string | null;
    limitations?: string[];
  };
};

export type CanonicalAuthorityRequest = {
  domain: CanonicalAuthorityDomain;
  sourceId: string;
  jurisdiction: string;
  evaluatedAt: string;
  purpose: 'NORMATIVE' | 'CONTEXTUAL';
  scopeConfirmed: boolean;
};

export type CanonicalAuthorityDecision = {
  sourceId: string;
  domain: CanonicalAuthorityDomain;
  state: CanonicalRuntimeState;
  normativeAuthority: boolean;
  usageDisposition: 'ALLOWED_WITHIN_APPROVED_SCOPE' | 'CONTEXTUAL_ONLY' | 'UNKNOWN_HUMAN_VERIFICATION';
  resolvedValue: null;
  reasons: string[];
  trace: {
    canonicalRegistry: string;
    canonicalView: string;
    canonicalPath: string;
    canonicalUri: string | null;
    sha256: string;
    authorityType: CanonicalAuthorityType;
    issuingAuthority: string | null;
    jurisdictions: string[];
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    freshnessStatus: string;
    provenance: Record<string, unknown>;
    evidenceRefs: string[];
    scopeLimitations: string[];
  } | null;
};

export const CANONICAL_BASELINE = {
  registry: { count: 862, sha256: '7d4901c4479129669e8036197cbdb116674f219ea21db34db7e1d20eefc48245' },
  routingToll: { count: 289, sha256: '049deb2d0714ffee8f71ff6ac6945ab2a084b69981a1e9f7e81910d0bf9f62b0' },
  legislationSafety: { count: 66, sha256: 'c6d45d7c4fcc86574790add0491e37727691909f287d461e356be05f69a1b0ab' },
} as const;
