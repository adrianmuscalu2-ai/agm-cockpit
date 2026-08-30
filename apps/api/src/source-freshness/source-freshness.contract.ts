export const sourceFreshnessStatuses = [
  'CURRENT',
  'EXPIRY_WARNING',
  'NEW_VERSION_DETECTED',
  'SUPERSEDED_PENDING_REVIEW',
  'REVIEW_REQUIRED',
  'EXPIRED_REVIEW_REQUIRED',
  'FRESHNESS_UNKNOWN',
] as const;

export type SourceFreshnessStatus = typeof sourceFreshnessStatuses[number];

export const sourceAlertTypes = [
  'NEW_VERSION_DETECTED',
  'SUPERSEDED_PENDING_REVIEW',
  'EXPIRY_30_DAYS',
  'EXPIRY_14_DAYS',
  'EXPIRY_7_DAYS',
  'EXPIRY_1_DAY',
  'EXPIRY_DAY',
  'EXPIRED',
  'FRESHNESS_UNKNOWN',
] as const;

export type SourceAlertType = typeof sourceAlertTypes[number];

export type SourceAuthorityClassification =
  | 'AUTHORITATIVE'
  | 'AUTHORITATIVE_WITH_SCOPE'
  | 'CONTEXTUAL';

export type SourceFreshnessRecord = {
  sourceId: string;
  candidateId?: string;
  country: string;
  domain: string;
  authority: string;
  authorityClassification: SourceAuthorityClassification;
  title: string;
  officialUrl: string;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  version?: string | null;
  capturedAt: string;
  lastFreshnessCheck?: string | null;
  nextFreshnessCheck?: string | null;
  sha256: string;
  currentStatus: SourceFreshnessStatus;
  supersedes: string[];
  supersededBy: string[];
  reviewRequired: boolean;
  lastAlertAt?: string | null;
  lastAlertType?: SourceAlertType | null;
};

export type DetectedSourceCandidate = {
  candidateId?: string;
  officialUrl: string;
  version?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  sha256?: string | null;
  detectedAt: string;
  supersessionClaimed?: boolean;
};

export type FreshnessCheckOutcome = 'CONFIRMED_CURRENT' | 'FAILED' | 'NOT_RUN';

export type SourceFreshnessObservation = {
  checkedAt: string;
  checkOutcome: FreshnessCheckOutcome;
  checkFailureReason?: string;
  detectedCandidate?: DetectedSourceCandidate;
  manualReviewRequested?: boolean;
  manualReviewReason?: string;
};

export type SourceAlertEvent = {
  sourceId: string;
  alertType: SourceAlertType;
  status: SourceFreshnessStatus;
  dedupKey: string;
  effectiveVersionOrDate: string;
  condition: string;
  impact: string;
  requiredProductOwnerAction: string;
  detectedCandidate?: DetectedSourceCandidate;
};

export type SourceUsageDisposition =
  | 'ALLOWED_WITHIN_APPROVED_SCOPE'
  | 'ALLOWED_WITHIN_APPROVED_SCOPE_EXPIRY_WARNING'
  | 'UNKNOWN_HUMAN_VERIFICATION';

export type SourceFreshnessEvaluation = {
  source: SourceFreshnessRecord;
  status: SourceFreshnessStatus;
  reviewRequired: boolean;
  usageDisposition: SourceUsageDisposition;
  resolvedValue: null;
  alerts: SourceAlertEvent[];
  candidateReview?: {
    currentSourceId: string;
    candidate: DetectedSourceCandidate;
    comparisonStatus: 'PENDING_PRODUCT_OWNER_REVIEW';
    automaticPromotion: false;
  };
  guardrails: {
    registryMutation: 'NONE';
    routingTollViewMutation: 'NONE';
    authorityPromotion: 'NONE';
    tariffMutation: 'NONE';
    productionDataMutation: 'NONE';
  };
};

export type AlertLedgerEntry = {
  dedupKey: string;
  sourceId: string;
  alertType: SourceAlertType;
  status: SourceFreshnessStatus;
  sentAt: string;
  acknowledgedAt?: string | null;
};

export type AlertReminderPolicy = {
  resendAfterDays?: number;
};

export type SourceAlertEmail = {
  to: string;
  subject: string;
  bodyText: string;
  clientMessageId: string;
  dedupKey: string;
};

export type SourceAlertBatchDelivery = {
  status: EmailAlertGateStatus;
  recipients: string[];
  emails: SourceAlertEmail[];
  ledgerEntry?: AlertLedgerEntry;
};

export type EmailAlertGateStatus =
  | 'SENT'
  | 'DEDUP_SUPPRESSED'
  | 'EMAIL_DESTINATION_NOT_CONFIGURED'
  | 'EMAIL_TRANSPORT_NOT_CONFIGURED';
