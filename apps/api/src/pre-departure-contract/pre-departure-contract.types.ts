export const PRE_DEPARTURE_CONTRACT_VERSION = '1.0.0' as const;

export const PRE_DEPARTURE_LANGUAGES = ['ro', 'de', 'en'] as const;
export const PRE_DEPARTURE_CONTEXTS = [
  'local',
  'long-distance',
  'adr',
  'night',
  'adverse-weather',
] as const;
export const PRE_DEPARTURE_CHECK_IDS = [
  'vehicle',
  'driver',
  'documents',
  'tachograph',
  'cargo',
  'route',
  'adr',
  'weather',
] as const;
export const PRE_DEPARTURE_SESSION_STATES = [
  'DRAFT',
  'IN_PROGRESS',
  'NEEDS_ATTENTION',
  'BLOCKED',
  'READY_TO_CONFIRM',
  'CONFIRMED',
  'CLOSED',
] as const;
export const PRE_DEPARTURE_ANSWER_STATUSES = [
  'confirmed',
  'problem',
  'not-applicable',
] as const;

export type PreDepartureContractVersion = typeof PRE_DEPARTURE_CONTRACT_VERSION;
export type PreDepartureLanguage = (typeof PRE_DEPARTURE_LANGUAGES)[number];
export type PreDepartureContext = (typeof PRE_DEPARTURE_CONTEXTS)[number];
export type PreDepartureCheckId = (typeof PRE_DEPARTURE_CHECK_IDS)[number];
export type PreDepartureSessionState = (typeof PRE_DEPARTURE_SESSION_STATES)[number];
export type PreDepartureAnswerStatus = (typeof PRE_DEPARTURE_ANSWER_STATUSES)[number];

export type PreDepartureAnswerPayload = {
  checkId: PreDepartureCheckId;
  status: PreDepartureAnswerStatus;
  note?: string;
  notApplicableReason?: string;
  answeredAt: string;
};

export type PreDepartureSessionPayload = {
  contractVersion: PreDepartureContractVersion;
  clientSessionId: string;
  idempotencyKey: string;
  transportJobId?: string;
  deviceId?: string;
  vehicleReference?: string;
  trailerReference?: string;
  checklistVersion: string;
  language: PreDepartureLanguage;
  contexts: PreDepartureContext[];
  state: PreDepartureSessionState;
  answers: PreDepartureAnswerPayload[];
  clientRevision: number;
  startedAt: string;
  updatedAt: string;
  confirmedAt?: string;
  closedAt?: string;
};

export type CreatePreDepartureSessionRequest = {
  session: PreDepartureSessionPayload;
};

export type UpdatePreDepartureSessionRequest = {
  session: PreDepartureSessionPayload;
  expectedServerRevision: number;
};

export type PreDepartureSessionResource = PreDepartureSessionPayload & {
  id: string;
  companyId: string;
  driverUserId: string;
  serverRevision: number;
  createdAt: string;
  serverUpdatedAt: string;
};

export type PreDepartureSessionResponse = {
  contractVersion: PreDepartureContractVersion;
  data: PreDepartureSessionResource;
  requestId: string;
};

export type PreDepartureConflictResponse = {
  contractVersion: PreDepartureContractVersion;
  error: {
    code: 'PRE_DEPARTURE_REVISION_CONFLICT';
    message: string;
    serverRevision: number;
  };
  requestId: string;
};

export type PreDepartureValidationIssue = {
  path: string;
  code:
    | 'required'
    | 'invalid-type'
    | 'invalid-value'
    | 'invalid-format'
    | 'invalid-state'
    | 'duplicate'
    | 'inconsistent';
  message: string;
};

export type PreDepartureValidationResult =
  | { valid: true; value: PreDepartureSessionPayload }
  | { valid: false; issues: PreDepartureValidationIssue[] };

