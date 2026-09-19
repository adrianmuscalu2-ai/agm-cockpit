export const SHARED_ARCHIVE_CONTRACT_VERSION = 'agm-shared-archive.phase2c.v1' as const;

export const SHARED_ARCHIVE_CATEGORIES = [
  'TRANSLATION', 'OCR', 'CONVERSATION', 'PROFILE', 'CAR_MOVER', 'DOCUMENT', 'USER_CREATED', 'GMAIL_REFERENCE',
] as const;

export type SharedArchiveCategory = (typeof SHARED_ARCHIVE_CATEGORIES)[number];
export type SharedArchiveSurface = 'ANDROID' | 'BROWSER';
export type SharedArchiveSyncPolicy = 'LOCAL_ONLY' | 'SYNC_ALLOWED' | 'SYNC_REQUIRED';
export type SharedArchivePersistence = 'EPHEMERAL_SESSION' | 'USER_APPROVED_PERSISTENT' | 'NON_PERSISTENT_SENSITIVE_CONTEXT';

export type SharedArchivePolicy = {
  category: SharedArchiveCategory;
  defaultSyncPolicy: SharedArchiveSyncPolicy;
  userApprovalRequired: boolean;
  sensitivePayloadFields: readonly string[];
  purpose: string;
};

export const SHARED_ARCHIVE_STORAGE_POLICY: Readonly<Record<SharedArchiveCategory, SharedArchivePolicy>> = {
  TRANSLATION: policy('TRANSLATION', 'SYNC_ALLOWED', true, ['sourceText', 'translatedText'], 'User-approved reusable translations.'),
  OCR: policy('OCR', 'LOCAL_ONLY', true, ['extractedText', 'translatedText'], 'OCR stays local unless the user explicitly archives a text-only record.'),
  CONVERSATION: policy('CONVERSATION', 'LOCAL_ONLY', true, ['turns', 'summary'], 'Session history is ephemeral unless the user explicitly archives it.'),
  PROFILE: policy('PROFILE', 'SYNC_ALLOWED', true, ['value'], 'Profile archive references require explicit user approval.'),
  CAR_MOVER: policy('CAR_MOVER', 'SYNC_REQUIRED', true, ['operationalContext'], 'Reserved for Phase 2D domain orchestration; no implicit migration.'),
  DOCUMENT: policy('DOCUMENT', 'SYNC_ALLOWED', true, ['text'], 'User-approved document text, without binary evidence by default.'),
  USER_CREATED: policy('USER_CREATED', 'SYNC_ALLOWED', true, ['content'], 'User-created archive records.'),
  GMAIL_REFERENCE: policy('GMAIL_REFERENCE', 'SYNC_ALLOWED', true, ['messageReference'], 'References only; OAuth credentials and message bodies are prohibited.'),
};

export function assertSharedArchiveWritePolicy(input: {
  category: SharedArchiveCategory;
  syncPolicy: SharedArchiveSyncPolicy;
  persistence: SharedArchivePersistence;
  userApprovedAt?: string | null;
  approvalEvidence?: string | null;
}) {
  if (input.syncPolicy === 'LOCAL_ONLY') throw new Error('LOCAL_ONLY_CANNOT_SYNC');
  if (input.persistence !== 'USER_APPROVED_PERSISTENT') throw new Error('PERSISTENT_ARCHIVE_REQUIRES_USER_APPROVAL');
  if (!validIso(input.userApprovedAt) || !input.approvalEvidence?.trim()) throw new Error('USER_APPROVAL_REQUIRED');
  if (input.category === 'CAR_MOVER') throw new Error('CAR_MOVER_ARCHIVE_RESERVED_FOR_PHASE_2D');
}

export function sharedArchivePolicyFor(category: SharedArchiveCategory) {
  return SHARED_ARCHIVE_STORAGE_POLICY[category];
}

function policy(category: SharedArchiveCategory, defaultSyncPolicy: SharedArchiveSyncPolicy, userApprovalRequired: boolean, sensitivePayloadFields: readonly string[], purpose: string): SharedArchivePolicy {
  return { category, defaultSyncPolicy, userApprovalRequired, sensitivePayloadFields, purpose };
}

function validIso(value: string | null | undefined) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
