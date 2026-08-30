import { agmTransferAllowed, externalTransferAllowed, sensitivityBlocksExternalTransfer } from './device-capability.policy';
import type { DeviceCapabilitySnapshot, RoutingDecision, RoutingRequest } from './device-capability.types';

type Clock = { now(): number };

export class DeviceCapabilityRouter {
  constructor(private readonly clock: Clock = performance) {}

  route(request: RoutingRequest, snapshot: DeviceCapabilitySnapshot): RoutingDecision {
    const startedAt = this.clock.now();
    const fallbackChain: string[] = [];
    const finish = (
      authority: RoutingDecision['authority'],
      executionMode: RoutingDecision['executionMode'],
      reason: string,
      requiresUserConfirmation = false,
    ): RoutingDecision => ({
      operation: request.operation,
      authority,
      executionMode,
      reason,
      decisionLatencyMs: Math.max(0, Math.round((this.clock.now() - startedAt) * 1000) / 1000),
      requiresUserConfirmation,
      fallbackChain,
      snapshotCapturedAtEpochMs: snapshot.capturedAtEpochMs,
    });

    if (request.operation === 'SAFETY_CRITICAL_READING') {
      if (request.localCandidateAvailable && request.verifiedLocalResult) {
        return finish('LOCAL_DEVICE', 'WEB_LOCAL', 'VERIFIED_LOCAL_READING_AVAILABLE');
      }
      fallbackChain.push(
        'LOCAL_DEVICE:READING_NOT_VERIFIED',
        'AGM_AI:GENERATION_PROHIBITED_FOR_MISSING_MEASUREMENT',
        'EXTERNAL_DEVICE_AI:TRANSFER_PROHIBITED',
        'SAFE_FALLBACK:MANUAL_MEASUREMENT_REQUIRED',
      );
      return finish('UNAVAILABLE', 'NONE', 'SAFETY_CRITICAL_VALUE_CANNOT_BE_READ_SAFELY');
    }

    if (request.operation === 'STT') {
      if (snapshot.capabilities.onDeviceSpeechRecognition) return finish('LOCAL_DEVICE', 'ON_DEVICE', 'ON_DEVICE_STT_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:ON_DEVICE_UNAVAILABLE');
      if (snapshot.capabilities.speechRecognition) return finish('LOCAL_DEVICE', 'SYSTEM_SERVICE', 'ANDROID_RECOGNITION_SERVICE_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:SYSTEM_STT_UNAVAILABLE', 'SAFE_FALLBACK:TYPED_INPUT');
      return finish('UNAVAILABLE', 'NONE', 'NO_SPEECH_RECOGNITION_SERVICE');
    }

    if (request.operation === 'TTS') {
      if (snapshot.capabilities.textToSpeech) return finish('LOCAL_DEVICE', 'SYSTEM_SERVICE', 'ANDROID_TTS_SERVICE_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:TTS_UNAVAILABLE', 'SAFE_FALLBACK:VISIBLE_TEXT');
      return finish('UNAVAILABLE', 'NONE', 'NO_TTS_SERVICE');
    }

    if (request.operation === 'OCR') {
      if (snapshot.capabilities.localWebOcr && request.localCandidateAvailable !== false) return finish('LOCAL_DEVICE', 'WEB_LOCAL', 'LOCAL_TESSERACT_RUNTIME_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:OCR_UNAVAILABLE');
      if (request.safetyCritical) {
        fallbackChain.push('AGM_AI:SAFETY_CRITICAL_OCR_FALLBACK_PROHIBITED', 'SAFE_FALLBACK:MANUAL_REVIEW');
        return finish('UNAVAILABLE', 'NONE', 'SAFETY_CRITICAL_OCR_REQUIRES_MANUAL_REVIEW');
      }
      if (snapshot.online && agmTransferAllowed(request.sensitivity, Boolean(request.userConfirmedAgmTransfer))) {
        return finish('AGM_AI', 'AGM_NETWORK', 'AGM_OCR_FALLBACK_ALLOWED');
      }
      fallbackChain.push('AGM_AI:SENSITIVE_TRANSFER_NOT_CONFIRMED', 'SAFE_FALLBACK:MANUAL_REVIEW');
      return finish('UNAVAILABLE', 'NONE', 'NO_SAFE_OCR_FALLBACK');
    }

    if (request.operation === 'SIMPLE_TRANSLATION') {
      if (request.localCandidateAvailable) return finish('LOCAL_DEVICE', 'WEB_LOCAL', 'LOCAL_TRANSLATION_RESULT_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:TRANSLATION_UNAVAILABLE');
      if (snapshot.online && agmTransferAllowed(request.sensitivity, Boolean(request.userConfirmedAgmTransfer))) {
        return finish('AGM_AI', 'AGM_NETWORK', 'AGM_TRANSLATION_AVAILABLE');
      }
      fallbackChain.push('AGM_AI:OFFLINE_OR_TRANSFER_BLOCKED', 'EXTERNAL_DEVICE_AI:USER_CONFIRMATION_REQUIRED');
      return finish('UNAVAILABLE', 'NONE', 'NO_AUTOMATIC_TRANSLATION_FALLBACK');
    }

    if (request.operation === 'PROCESS_SELECTED_TEXT') {
      if (request.localCandidateAvailable) return finish('LOCAL_DEVICE', 'WEB_LOCAL', 'LOCAL_TEXT_PROCESSOR_AVAILABLE');
      fallbackChain.push('LOCAL_DEVICE:TEXT_PROCESSOR_UNAVAILABLE');
      if (snapshot.online && agmTransferAllowed(request.sensitivity, Boolean(request.userConfirmedAgmTransfer))) {
        return finish('AGM_AI', 'AGM_NETWORK', 'AGM_TEXT_PROCESSING_AVAILABLE');
      }
      fallbackChain.push('AGM_AI:OFFLINE_OR_TRANSFER_BLOCKED');
      if (snapshot.capabilities.processText && externalTransferAllowed(request.sensitivity, Boolean(request.userConfirmedExternal))) {
        return finish('EXTERNAL_DEVICE_AI', 'ANDROID_PROCESS_TEXT', 'ANDROID_PROCESS_TEXT_CONFIRMED', true);
      }
      fallbackChain.push('EXTERNAL_DEVICE_AI:UNAVAILABLE_OR_NOT_CONFIRMED');
      return finish('UNAVAILABLE', 'NONE', 'NO_SAFE_TEXT_PROCESSOR');
    }

    if (request.operation === 'OPEN_DEVICE_ASSISTANT') {
      if (!snapshot.capabilities.assist) return finish('UNAVAILABLE', 'NONE', 'ANDROID_ASSIST_UNAVAILABLE');
      if (!request.userConfirmedExternal) return finish('UNAVAILABLE', 'NONE', 'EXTERNAL_HANDOFF_NOT_CONFIRMED', true);
      if (sensitivityBlocksExternalTransfer(request.sensitivity)) return finish('UNAVAILABLE', 'NONE', 'SENSITIVE_ROUTE_BLOCKS_ASSIST');
      return finish('EXTERNAL_DEVICE_AI', 'ANDROID_ASSIST', 'ANDROID_ASSIST_CONFIRMED', true);
    }

    if (request.operation === 'SHARE_CONTEXT') {
      if (!snapshot.capabilities.shareText) return finish('UNAVAILABLE', 'NONE', 'ANDROID_SHARE_UNAVAILABLE');
      if (!externalTransferAllowed(request.sensitivity, Boolean(request.userConfirmedExternal))) {
        return finish('UNAVAILABLE', 'NONE', sensitivityBlocksExternalTransfer(request.sensitivity) ? 'SENSITIVE_DATA_BLOCKS_EXTERNAL_SHARE' : 'EXTERNAL_SHARE_NOT_CONFIRMED', true);
      }
      return finish('EXTERNAL_DEVICE_AI', 'ANDROID_SHARE', 'ANDROID_SHARE_CONFIRMED', true);
    }

    const requiresAgm = request.requiresAgmContext || request.operation === 'AGM_CONTEXT_REASONING' || request.operation === 'CAR_MOVER_ACTION';
    if (requiresAgm) {
      if (snapshot.online && agmTransferAllowed(request.sensitivity, Boolean(request.userConfirmedAgmTransfer))) {
        return finish('AGM_AI', 'AGM_NETWORK', 'AGM_CONTEXT_AUTHORITY_REQUIRED');
      }
      fallbackChain.push('AGM_AI:OFFLINE_OR_TRANSFER_BLOCKED');
      return finish('UNAVAILABLE', 'NONE', 'AGM_AUTHORITY_UNAVAILABLE');
    }

    if (request.localCandidateAvailable) return finish('LOCAL_DEVICE', 'WEB_LOCAL', 'LOCAL_RESULT_AVAILABLE');
    fallbackChain.push('LOCAL_DEVICE:NO_MATCH');
    if (snapshot.online && agmTransferAllowed(request.sensitivity, Boolean(request.userConfirmedAgmTransfer))) {
      return finish('AGM_AI', 'AGM_NETWORK', 'AGM_REASONING_AVAILABLE');
    }
    fallbackChain.push('AGM_AI:OFFLINE_OR_TRANSFER_BLOCKED');
    if (externalTransferAllowed(request.sensitivity, Boolean(request.userConfirmedExternal)) && snapshot.capabilities.shareText) {
      return finish('EXTERNAL_DEVICE_AI', 'ANDROID_SHARE', 'EXTERNAL_REASONING_HANDOFF_CONFIRMED', true);
    }
    fallbackChain.push('EXTERNAL_DEVICE_AI:UNAVAILABLE_OR_NOT_CONFIRMED');
    return finish('UNAVAILABLE', 'NONE', 'NO_SAFE_EXECUTION_AUTHORITY');
  }
}
