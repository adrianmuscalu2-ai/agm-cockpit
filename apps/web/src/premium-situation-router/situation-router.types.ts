import type { BasicLanguageCode } from '../language-registry';

export type FieldBatchSituationId =
  | 'trip-context' | 'vehicle-safety' | 'load-securing' | 'tachograph-time'
  | 'adr-compliance' | 'route-compatibility' | 'night-weather'
  | 'driver-fitness' | 'ready-gate';
export type AuthorizedSituationId = 'required-document' | 'road-control' | FieldBatchSituationId;
export type AfterFieldSituationId =
  | 'unsafe-interaction' | 'immediate-danger' | 'incident-accident' | 'vehicle-breakdown'
  | 'driver-fatigue' | 'cargo-issue' | 'route-blocked' | 'weather-road'
  | 'language-barrier' | 'route-document' | 'independent-communication'
  | 'arrival-closeout' | 'final-report-archive';
export type AnyAuthorizedSituationId = AuthorizedSituationId | AfterFieldSituationId;
export type SituationHub = 'BEFORE_DEPARTURE' | 'AFTER_DEPARTURE';
export type OperationalCaseState =
  | 'CREATED' | 'SAFETY_GATE' | 'QUALIFYING' | 'ACTIVE_STEP'
  | 'REVIEW_REQUIRED' | 'ACTION_READY' | 'AWAITING_CONFIRMATION'
  | 'RESOLVED' | 'FOLLOW_UP_REQUIRED' | 'ESCALATED' | 'BLOCKED'
  | 'RECOVERY_REQUIRED';

export type SituationStepId =
  | 'identify-document' | 'document-availability' | 'capture-original'
  | 'ocr-review' | 'document-check' | 'remediation' | 'ready-verdict'
  | 'safe-interaction' | 'safe-stop' | 'qualify-request' | 'contextual-evidence'
  | 'human-review' | 'contextual-translation' | 'contextual-communication' | 'case-disposition'
  | 'qualify' | 'verify' | 'remediate' | 'verdict';

export type SituationDefinition = {
  readonly id: AnyAuthorizedSituationId;
  readonly version: 1;
  readonly hub: SituationHub;
  readonly steps: readonly SituationStepId[];
  readonly initialState: OperationalCaseState;
  readonly i18nKeyPrefix: string;
};

export type ExternalEffect = {
  readonly operationId: string;
  readonly channel: 'email' | 'whatsapp';
  readonly phase: 'PREPARED' | 'HUMAN_CONFIRMED' | 'SENT' | 'RECEIPT_CONFIRMED' | 'FAILED';
  readonly providerReceipt?: string;
};

export type OperationalCase = {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly situationId: AnyAuthorizedSituationId;
  readonly definitionVersion: 1;
  readonly language: BasicLanguageCode;
  readonly state: OperationalCaseState;
  readonly activeStep: SituationStepId;
  readonly completedSteps: readonly SituationStepId[];
  readonly data: Readonly<Record<string, unknown>>;
  readonly evidence: readonly {
    id: string; kind: 'original' | 'ocr-proposal' | 'human-confirmation'; sha256: string;
    sourceId?: string; sourceSha256?: string; initialText?: string; confirmedText?: string;
    confirmedAt?: string; confirmedBy?: string;
  }[];
  readonly externalEffects: readonly ExternalEffect[];
  readonly revision: number;
  readonly updatedAt: string;
};

export type CaseCommand =
  | { type: 'CONFIRM_SAFE_INTERACTION'; safe: boolean }
  | { type: 'CONFIRM_SAFE_STOP' }
  | { type: 'SET_DATA'; values: Readonly<Record<string, unknown>> }
  | { type: 'ADD_EVIDENCE'; evidence: OperationalCase['evidence'][number] }
  | { type: 'REQUIRE_RECOVERY'; reason: string }
  | { type: 'ADVANCE' }
  | { type: 'BLOCK' }
  | { type: 'REMEDIATE' }
  | { type: 'CONFIRM_READY' }
  | { type: 'SET_DISPOSITION'; disposition: 'RESOLVED' | 'FOLLOW_UP_REQUIRED' | 'ESCALATED' }
  | { type: 'PREPARE_EXTERNAL'; effect: Omit<ExternalEffect, 'phase'> }
  | { type: 'CONFIRM_EXTERNAL'; operationId: string }
  | { type: 'MARK_SENT'; operationId: string }
  | { type: 'RECORD_RECEIPT'; operationId: string; receipt: string };
