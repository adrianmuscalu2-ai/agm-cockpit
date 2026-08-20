export type CapabilityId = 'OPEN_DIALER' | 'OPEN_MAPS' | 'SEND_EMAIL' | 'SEND_WHATSAPP';
export type ConfirmationMethod = 'VOICE' | 'TOUCH';
export type HandoffStatus = 'OPENED' | 'CANCELLED' | 'UNAVAILABLE' | 'FAILED';

export type CapabilityScope = {
  productId: 'agm-cockpit';
  moduleId: string;
  tenantId: string;
  subjectId: string;
  premiumEntitled: boolean;
};

export type CapabilityRequest = CapabilityScope & {
  requestId: string;
  conversationId: string;
  capabilityId: string;
  parameters: { phoneNumber?: string; displayName?: string; destination?: string; grounded?: boolean; recipient?: string; subject?: string; body?: string };
  requestedAt: string;
};

export type ActionPreview = {
  confirmationId: string;
  requestId: string;
  capabilityId: CapabilityId;
  actionType: 'DIAL' | 'NAVIGATE' | 'EMAIL' | 'WHATSAPP';
  recipient?: { displayName?: string; address: string };
  destination?: string;
  subject?: string;
  body?: string;
  contentHash: string;
  previewVersion: number;
  createdAt: string;
  expiresAt: string;
  executionMode: 'SYSTEM_HANDOFF' | 'PROVIDER_HANDOFF';
};

export type ActionConfirmation = {
  confirmationId: string;
  previewVersion: number;
  contentHash: string;
  method: ConfirmationMethod;
  confirmedAt: string;
};

export type HandoffReceipt = {
  receiptId: string;
  confirmationId: string;
  capabilityId: CapabilityId;
  handedOffAt: string;
  status: HandoffStatus;
  targetPackage?: string;
};

export type BrokerDecision =
  | { status: 'PREVIEW_READY'; preview: ActionPreview }
  | { status: 'NEEDS_INPUT'; missingFields: string[] }
  | { status: 'DENIED'; reason: string };
