export const AGM_LIBRARY_CONTROL_PLANE_VERSION = 'agm-library-control-plane.phase1.v1' as const;

export type AgmLibraryDomain = 'BASIC' | 'PREMIUM' | 'PROFILE' | 'CAR_MOVER';
export type AgmRequestSurface = AgmLibraryDomain | 'ANDROID' | 'BROWSER';

export type AgmLibrarySourceId =
  | 'CONVERSATION_HISTORY'
  | 'PREVIOUS_TRANSLATIONS'
  | 'OCR_ARCHIVE'
  | 'AGM_CANONICAL_LIBRARY'
  | 'PROFILE_PERMITTED_DATA'
  | 'GMAIL'
  | 'PERSONAL_CONTACTS'
  | 'ANDROID_HANDOFF'
  | 'PREMIUM_ACTIONS'
  | 'PREMIUM_CONTEXT'
  | 'PROFILE_CONTACTS'
  | 'PROFILE_PREFERENCES'
  | 'PROFILE_CONFIGURATION'
  | 'PROFILE_RELATIONSHIPS'
  | 'CAR_MOVER_TRANSPORTS'
  | 'CAR_MOVER_OFFERS'
  | 'CAR_MOVER_CLIENTS'
  | 'CAR_MOVER_VEHICLES'
  | 'CAR_MOVER_PLATFORMS'
  | 'CAR_MOVER_TRIP_HISTORY'
  | 'CAR_MOVER_DOCUMENTS'
  | 'CAR_MOVER_RATES'
  | 'CAR_MOVER_EMPTY_KILOMETRES'
  | 'CAR_MOVER_COSTS'
  | 'AGM_SHARED_ARCHIVE';

export type LibraryIdentity = {
  tenantId: string;
  subjectId: string;
  roles: readonly string[];
};

export type LibraryRequest = {
  requestId: string;
  correlationId: string;
  surface: AgmRequestSurface;
  activeDomain?: AgmLibraryDomain;
  requestedDomains?: readonly AgmLibraryDomain[];
  identity: LibraryIdentity;
  query: {
    text: string;
    language: string;
    intentHints?: readonly string[];
    subjectHints?: readonly string[];
  };
};

export type LibrarySourceDescriptor = {
  resolverId: string;
  source: AgmLibrarySourceId;
  owner: string;
  supportedDomains: readonly AgmLibraryDomain[];
  sensitivity: 'STANDARD' | 'PERSONAL' | 'OPERATIONAL' | 'CREDENTIAL_BOUND';
  authorizationAction: string;
};

export type ResolverMatch = {
  eligible: boolean;
  confidence: number;
  intent: string;
  subject?: string;
};

export type LibraryAuthorizationDecision = {
  decision: 'GRANTED' | 'DENIED' | 'NOT_PROVEN';
  authorityGranted: boolean;
  reasonCode: string;
  evidenceRef: string;
  allowedPayloadFields: readonly string[];
};

export type LibraryMandate = {
  mandateId: string;
  requestId: string;
  domain: AgmLibraryDomain;
  orchestratorId: string;
  issuedAt: string;
  policyVersion: string;
  authorizedResolvers: readonly {
    resolverId: string;
    source: AgmLibrarySourceId;
    authorization: LibraryAuthorizationDecision;
    match: ResolverMatch;
  }[];
};

export type LibraryProvenance = {
  sourceRecordId: string;
  owner: string;
  namespace: string;
  evidenceRefs: readonly string[];
};

export type LibraryFreshness = {
  status: 'CURRENT' | 'STALE' | 'EXPIRED' | 'UNKNOWN';
  observedAt: string;
  expiresAt: string | null;
};

export type LibraryResolverResult = {
  status: 'FOUND' | 'NO_DATA' | 'AMBIGUOUS' | 'UNAVAILABLE';
  identity: { subjectType: string; subjectId: string | null; displayName?: string };
  query: { intent: string; normalizedText: string };
  result: { summary: string; recordCount: number };
  confidence: number;
  ambiguity: { ambiguous: boolean; candidateIds: readonly string[]; clarificationPrompt?: string };
  provenance: LibraryProvenance;
  freshness: LibraryFreshness;
  minimalAuthorizedPayload: Readonly<Record<string, unknown>>;
  deduplicationKey: string;
};

export type LibraryResolverInput = {
  request: LibraryRequest;
  mandate: LibraryMandate;
  authorization: LibraryAuthorizationDecision;
  match: ResolverMatch;
};

export interface LibraryResolver {
  readonly descriptor: LibrarySourceDescriptor;
  match(request: LibraryRequest): ResolverMatch;
  resolve(input: LibraryResolverInput): Promise<LibraryResolverResult>;
}

export interface LibraryAuthorizationPort {
  authorize(input: {
    request: LibraryRequest;
    domain: AgmLibraryDomain;
    source: LibrarySourceDescriptor;
    match: ResolverMatch;
  }): Promise<LibraryAuthorizationDecision>;
}

export interface LibraryDomainClassifier {
  classify(request: LibraryRequest): readonly AgmLibraryDomain[];
}

export type AuthorizedResolutionRecord = LibraryResolverResult & {
  domain: AgmLibraryDomain;
  orchestratorId: string;
  resolverId: string;
  source: AgmLibrarySourceId;
  authorization: LibraryAuthorizationDecision;
};

export type ResolvedContextItem = {
  contextId: string;
  identity: LibraryResolverResult['identity'];
  summary: string;
  confidence: number;
  provenance: readonly LibraryProvenance[];
  freshness: LibraryFreshness;
  minimalAuthorizedPayload: Readonly<Record<string, unknown>>;
  contributingSources: readonly AgmLibrarySourceId[];
};

export type LibraryControlTraceEvent = {
  sequence: number;
  stage:
    | 'REQUEST_RECEIVED'
    | 'DOMAIN_CLASSIFIED'
    | 'RESOLVER_ELIGIBLE'
    | 'AUTHORIZATION_EVALUATED'
    | 'MANDATE_ISSUED'
    | 'RESOLVER_CALLED'
    | 'RESULT_COLLECTED'
    | 'CONTEXT_PACKAGED'
    | 'DISPATCH_DECIDED';
  domain?: AgmLibraryDomain;
  resolverId?: string;
  outcome: string;
};

export type ResolvedContextPackage = {
  contractVersion: typeof AGM_LIBRARY_CONTROL_PLANE_VERSION;
  requestId: string;
  correlationId: string;
  status: 'CONTEXT_READY' | 'VERIFIED_NO_DATA' | 'CLARIFICATION_REQUIRED' | 'BLOCKED';
  domains: readonly AgmLibraryDomain[];
  mandates: readonly LibraryMandate[];
  contexts: readonly ResolvedContextItem[];
  conflicts: readonly { deduplicationKey: string; selectedResolverId: string; rejectedResolverIds: readonly string[] }[];
  authorizationDenials: readonly { domain: AgmLibraryDomain; resolverId: string; reasonCode: string; evidenceRef: string }[];
  failures: readonly { domain: AgmLibraryDomain; resolverId: string; reasonCode: string }[];
  dispatch: {
    assistantAllowed: boolean;
    injectResolvedContext: boolean;
    genericFallbackAllowed: boolean;
    reason: 'RESOLVED_CONTEXT_REQUIRED' | 'VERIFIED_NO_DATA' | 'CLARIFICATION_REQUIRED' | 'RESOLUTION_INCOMPLETE';
  };
  trace: readonly LibraryControlTraceEvent[];
};
