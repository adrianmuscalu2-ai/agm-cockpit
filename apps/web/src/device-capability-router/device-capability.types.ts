export const deviceOperations = [
  'STT',
  'TTS',
  'OCR',
  'SIMPLE_TRANSLATION',
  'PROCESS_SELECTED_TEXT',
  'GENERAL_REASONING',
  'AGM_CONTEXT_REASONING',
  'DOCUMENT_ANALYSIS',
  'SAFETY_CRITICAL_READING',
  'CAR_MOVER_ACTION',
  'OPEN_DEVICE_ASSISTANT',
  'SHARE_CONTEXT',
] as const;

export type DeviceOperation = typeof deviceOperations[number];
export type ExecutionAuthority = 'LOCAL_DEVICE' | 'AGM_AI' | 'EXTERNAL_DEVICE_AI' | 'UNAVAILABLE';
export type ExecutionMode =
  | 'ON_DEVICE'
  | 'SYSTEM_SERVICE'
  | 'WEB_LOCAL'
  | 'AGM_NETWORK'
  | 'ANDROID_ASSIST'
  | 'ANDROID_SHARE'
  | 'ANDROID_PROCESS_TEXT'
  | 'NONE';
export type DataSensitivity = 'PUBLIC' | 'USER_TEXT' | 'PERSONAL' | 'DOCUMENT' | 'CAR_MOVER' | 'SECRET';

export type DeviceCapabilitySnapshot = {
  schemaVersion: 1;
  platform: 'android' | 'web';
  capturedAtEpochMs: number;
  expiresAtEpochMs: number;
  sdkInt?: number;
  online: boolean;
  capabilities: {
    speechRecognition: boolean;
    onDeviceSpeechRecognition: boolean;
    textToSpeech: boolean;
    camera: boolean;
    localWebOcr: boolean;
    shareText: boolean;
    processText: boolean;
    translateText: boolean;
    assist: boolean;
    voiceSettings: boolean;
  };
};

export type RoutingRequest = {
  operation: DeviceOperation;
  sensitivity: DataSensitivity;
  requiresAgmContext?: boolean;
  localCandidateAvailable?: boolean;
  userConfirmedExternal?: boolean;
  userConfirmedAgmTransfer?: boolean;
  safetyCritical?: boolean;
  verifiedLocalResult?: boolean;
};

export type RoutingDecision = {
  operation: DeviceOperation;
  authority: ExecutionAuthority;
  executionMode: ExecutionMode;
  reason: string;
  decisionLatencyMs: number;
  requiresUserConfirmation: boolean;
  fallbackChain: readonly string[];
  snapshotCapturedAtEpochMs: number;
};

export type RoutingMetric = {
  operation: DeviceOperation;
  authority: ExecutionAuthority;
  executionMode: ExecutionMode;
  decisionLatencyMs: number;
  executionLatencyMs?: number;
  capabilityLookupLatencyMs?: number;
  capabilityCacheHit?: boolean;
  success?: boolean;
  fallbackUsed?: boolean;
  atEpochMs: number;
};
