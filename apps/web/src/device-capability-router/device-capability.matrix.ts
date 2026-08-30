import type { DeviceOperation } from './device-capability.types';

export type CapabilityMatrixRow = {
  operation: DeviceOperation;
  order: readonly string[];
  safeFallback: string;
  transferredData: string;
};

export const deviceCapabilityMatrix: readonly CapabilityMatrixRow[] = [
  { operation: 'STT', order: ['LOCAL_DEVICE:on-device', 'LOCAL_DEVICE:system-service'], safeFallback: 'typed input', transferredData: 'microphone audio to the selected Android recognition service; confirmed transcript only to AGM' },
  { operation: 'TTS', order: ['LOCAL_DEVICE:offline-voice', 'LOCAL_DEVICE:system-service'], safeFallback: 'visible text', transferredData: 'response text to the selected Android TTS engine' },
  { operation: 'OCR', order: ['LOCAL_DEVICE:Tesseract'], safeFallback: 'manual correction; AGM only after explicit sensitive-data confirmation', transferredData: 'image stays in AGM unless the user explicitly authorizes a transfer' },
  { operation: 'SIMPLE_TRANSLATION', order: ['LOCAL_DEVICE:known-local-result', 'AGM_AI'], safeFallback: 'original text; external action offered separately', transferredData: 'selected text only' },
  { operation: 'PROCESS_SELECTED_TEXT', order: ['LOCAL_DEVICE:built-in', 'AGM_AI', 'EXTERNAL_DEVICE_AI:PROCESS_TEXT'], safeFallback: 'original selected text', transferredData: 'selected text shown in the preview' },
  { operation: 'GENERAL_REASONING', order: ['AGM_AI', 'EXTERNAL_DEVICE_AI:user-confirmed'], safeFallback: 'no generated answer', transferredData: 'confirmed question only' },
  { operation: 'AGM_CONTEXT_REASONING', order: ['AGM_AI'], safeFallback: 'AGM unavailable message', transferredData: 'allowlisted AGM context' },
  { operation: 'DOCUMENT_ANALYSIS', order: ['LOCAL_DEVICE', 'AGM_AI:user-confirmed'], safeFallback: 'manual review', transferredData: 'no automatic external transfer' },
  { operation: 'SAFETY_CRITICAL_READING', order: ['LOCAL_DEVICE:verified-result-only'], safeFallback: 'explicit cannot-read result and mandatory manual measurement', transferredData: 'none; AGM and external AI are prohibited from filling a missing measurement' },
  { operation: 'CAR_MOVER_ACTION', order: ['AGM_AI'], safeFallback: 'no action', transferredData: 'no external device AI transfer' },
  { operation: 'OPEN_DEVICE_ASSISTANT', order: ['EXTERNAL_DEVICE_AI:ASSIST'], safeFallback: 'control hidden/unavailable', transferredData: 'no explicit AGM payload' },
  { operation: 'SHARE_CONTEXT', order: ['EXTERNAL_DEVICE_AI:SEND'], safeFallback: 'remain in AGM', transferredData: 'exact user-confirmed preview text' },
] as const;
