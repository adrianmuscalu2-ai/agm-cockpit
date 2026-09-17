export const PREMIUM_ASSISTANT_CONTRACT = {
  // Source trace and cache metadata are additive fields. Keep the response
  // identity compatible with already-installed v1 Android clients; a future
  // breaking version requires explicit client/server negotiation.
  version: 'premium-assistant.v1',
  productId: 'agm-cockpit',
  requiredRole: 'PREMIUM_ACCESS',
  provider: 'openai',
  defaultModel: 'gpt-4.1-mini',
  endpoint: 'https://api.openai.com/v1/responses',
  maximumHistoryTurns: 20,
  maximumInputLength: 2_000,
  timeoutMs: 15_000,
  externalEffects: false,
} as const;

export type AssistantSourceReference = {
  sourceId: string;
  title: string;
  origin: string;
  urlOrIdentifier: string | null;
  timestamp: string | null;
  domain: string[];
  language: string;
  confidence: number;
  originType: 'AGM_INTERNAL' | 'DOCUMENT_LIBRARY' | 'WEB' | 'GMAIL';
  retrievalType: 'LIBRARY' | 'CACHE' | 'LIVE';
  freshness: { status: 'CURRENT' | 'STALE' | 'EXPIRED' | 'UNKNOWN' | 'INVALIDATED'; checkedAt: string | null; expiresAt: string | null; ttlSeconds: number };
  provenance: { canonicalPath: string | null; sha256: string | null; authorityType: string; reviewStatus: string };
};

export type AssistantSourceTrace = {
  traceId: string;
  status: 'READY' | 'LIVE_VERIFICATION_IN_PROGRESS' | 'LIBRARY_ONLY' | 'NO_VERIFIED_SOURCES';
  generatedAt: string;
  counts: { total: number; library: number; live: number; cache: number };
  sources: AssistantSourceReference[];
};

export type GmailActionContext = {
  contractVersion: 'gmail-action-context.v1';
  traceId: string;
  messageRef: string;
  senderEmail: string | null;
  subject: string;
  receivedAt: string;
  destinations: readonly string[];
  phoneNumbers: readonly string[];
  dateTimes: readonly string[];
  shareText: string;
};

export type PremiumAssistantResponse = {
  contractVersion: typeof PREMIUM_ASSISTANT_CONTRACT.version;
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai' | 'agm';
  productId: typeof PREMIUM_ASSISTANT_CONTRACT.productId;
  moduleId: string;
  contextRefs: readonly string[];
  sourceTrace: Omit<AssistantSourceTrace, 'sources'>;
  toolTrace?: {
    tool: 'gmail-inbox'; status: 'SUCCESS' | 'UNAVAILABLE'; operation: string; resultCount: number; errorCode: string | null;
    guardianDecision?: 'APPROVED' | 'DENIED' | 'NOT_PROVEN'; guardianEvidenceId?: string; guardianCorrelationId?: string;
    translationStatus?: 'NOT_REQUIRED' | 'SUCCESS' | 'UNAVAILABLE'; translationSourceLanguages?: readonly string[];
    translationTargetLanguage?: string; translationProvider?: 'openai' | 'unavailable' | 'none';
  };
  actionContext?: GmailActionContext;
  cache: { disposition: 'HIT' | 'MISS'; ttlSeconds: number };
  externalEffectPerformed: false;
  timing: { timeToFirstTokenMs: number; orchestratorMs: number; modelMs: number; answerCompleteMs: number; serverTotalMs: number; sourceResolutionMs: number };
};
