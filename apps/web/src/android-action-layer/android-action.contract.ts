export const androidActionKinds = [
  'READ_CONTEXT', 'ASSISTANT', 'NAVIGATION', 'DIAL', 'OPEN_APP', 'CALENDAR', 'REMINDER', 'ALARM',
  'SHARE', 'EMAIL_DRAFT', 'MESSENGER_CHAT', 'SETTINGS',
] as const;

export type AndroidActionKind = typeof androidActionKinds[number];
export type AndroidActionResolutionStatus = 'RESOLVED' | 'CLARIFICATION_REQUIRED' | 'UNSUPPORTED';

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

export type ActiveDriverContext = GmailActionContext & {
  answerText: string;
  capturedAtEpochMs: number;
  expiresAtEpochMs: number;
};

export type AndroidActionPayload = {
  value?: string;
  navigationApp?: 'MAPS' | 'WAZE' | 'TOMTOM';
  contactId?: string;
  contactName?: string;
  contactSource?: 'AGM_PERSONAL_CONTACTS' | 'ANDROID_CONTACTS';
  requestedChannel?: 'PHONE' | 'EMAIL' | 'MESSENGER';
  requestedEmailLabel?: string;
  selectedEmailLabel?: string;
  availableEmailLabels?: string[];
  contextText?: string;
  startEpochMs?: number;
  hour?: number;
  minute?: number;
  mimeType?: string;
  contentUri?: string;
  subject?: string;
};

export type AndroidActionResolution = {
  contractVersion: 'android-action-resolution.v1';
  status: AndroidActionResolutionStatus;
  action?: AndroidActionKind;
  reason: string;
  source: 'REQUEST' | 'ACTIVE_GMAIL_CONTEXT' | 'GENERAL_HANDOFF' | 'NONE';
  payload?: AndroidActionPayload;
  confirmation: 'NONE' | 'USER_COMMAND' | 'AGM_REQUIRED' | 'ANDROID_TARGET';
};

export type AndroidActionReceipt = {
  contractVersion: 'android-action-receipt.v1';
  request: { text: string; action?: AndroidActionKind };
  resolution: AndroidActionResolution;
  target: string | null;
  result: 'OPENED' | 'READ' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'CLARIFICATION_REQUIRED' | 'CONFIRMATION_REQUIRED' | 'AUTH_PERMISSION_FAILURE';
  fallback: string | null;
  guardianEvidenceId?: string;
  guardianCorrelationId?: string;
  contactGuardianEvidenceId?: string;
  contactGuardianCorrelationId?: string;
  observedAt: string;
};
