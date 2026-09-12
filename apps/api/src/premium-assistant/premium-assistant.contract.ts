export const PREMIUM_ASSISTANT_CONTRACT = {
  version: 'premium-assistant.v2',
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
  originType: 'AGM_INTERNAL' | 'DOCUMENT_LIBRARY' | 'WEB';
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

export type PremiumAssistantResponse = {
  contractVersion: typeof PREMIUM_ASSISTANT_CONTRACT.version;
  kind: 'answer' | 'clarification';
  text: string;
  provider: 'openai';
  productId: typeof PREMIUM_ASSISTANT_CONTRACT.productId;
  moduleId: string;
  contextRefs: readonly string[];
  sourceTrace: Omit<AssistantSourceTrace, 'sources'>;
  cache: { disposition: 'HIT' | 'MISS'; ttlSeconds: number };
  externalEffectPerformed: false;
  timing: { timeToFirstTokenMs: number; orchestratorMs: number; modelMs: number; answerCompleteMs: number; serverTotalMs: number; sourceResolutionMs: number };
};
