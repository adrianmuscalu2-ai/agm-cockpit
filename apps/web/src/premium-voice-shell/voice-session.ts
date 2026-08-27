export type VoiceSessionState =
  | 'OFF' | 'STANDBY' | 'LISTENING' | 'SPEECH_DETECTED' | 'TRANSCRIBING'
  | 'UNDERSTANDING' | 'PREPARING' | 'AWAITING_CONFIRMATION' | 'EXECUTING'
  | 'SPEAKING' | 'ERROR';

export type VoiceSessionTelemetry = {
  cycleId: string;
  listeningStartedAt?: number;
  speechDetectedAt?: number;
  finalTranscriptAt?: number;
  engineRequestAt?: number;
  engineResponseAt?: number;
  engineLatencyMs?: number;
  serverTiming?: { orchestratorMs: number; modelMs: number; serverTotalMs: number };
  networkLatencyMs?: number;
  ttsRequestedAt?: number;
  ttsStartedAt?: number;
  audioStartedAt?: number;
  ttsRequestToAudioStartMs?: number;
  transcriptToTtsMs?: number;
  transcriptToAudioStartMs?: number;
  micToAudioStartMs?: number;
  nativeTiming?: Record<string, number>;
};

export class VoiceSessionController {
  private value: VoiceSessionState = 'OFF';
  private enabled = false;
  private generation = 0;
  private telemetry?: VoiceSessionTelemetry;
  constructor(private readonly onState: (state: VoiceSessionState) => void) {}
  state() { return this.value; }
  isEnabled() { return this.enabled; }
  token() { return this.generation; }
  isCurrent(token: number) { return this.enabled && token === this.generation; }
  isGenerationCurrent(token: number) { return token === this.generation; }
  currentCycleId() { return this.telemetry?.cycleId; }
  on() { this.enabled = true; this.generation += 1; this.set('STANDBY'); return this.generation; }
  off() { this.enabled = false; this.generation += 1; this.telemetry = undefined; this.set('OFF'); }
  interrupt() { this.generation += 1; this.telemetry = undefined; this.set(this.enabled ? 'STANDBY' : 'OFF'); return this.generation; }
  settle() { this.set(this.enabled ? 'STANDBY' : 'OFF'); }
  transition(state: VoiceSessionState) {
    if (!this.enabled && ['STANDBY', 'LISTENING', 'SPEECH_DETECTED', 'TRANSCRIBING'].includes(state)) return;
    this.set(state);
  }
  beginCycle() { this.telemetry = { cycleId: crypto.randomUUID(), listeningStartedAt: performance.now() }; return this.telemetry; }
  markSpeech() { if (this.telemetry && !this.telemetry.speechDetectedAt) this.telemetry.speechDetectedAt = performance.now(); }
  markTranscript(nativeTiming?: Record<string, number>) { if (this.telemetry) { this.telemetry.finalTranscriptAt = performance.now(); this.telemetry.nativeTiming = nativeTiming; } }
  markEngineRequest() { if (this.telemetry) this.telemetry.engineRequestAt = performance.now(); }
  markEngineResponse(serverTiming?: VoiceSessionTelemetry['serverTiming']) {
    if (!this.telemetry) return;
    this.telemetry.engineResponseAt = performance.now();
    if (this.telemetry.engineRequestAt !== undefined) this.telemetry.engineLatencyMs = Math.round(this.telemetry.engineResponseAt - this.telemetry.engineRequestAt);
    if (serverTiming) {
      this.telemetry.serverTiming = serverTiming;
      if (this.telemetry.engineLatencyMs !== undefined) this.telemetry.networkLatencyMs = Math.max(0, this.telemetry.engineLatencyMs - serverTiming.serverTotalMs);
    }
  }
  markTtsRequest() {
    if (!this.telemetry) return;
    this.telemetry.ttsRequestedAt = performance.now();
    if (this.telemetry.finalTranscriptAt !== undefined) this.telemetry.transcriptToTtsMs = Math.round(this.telemetry.ttsRequestedAt - this.telemetry.finalTranscriptAt);
  }
  markAudioStart(nativeRequestToStartMs?: number) {
    if (!this.telemetry || this.telemetry.audioStartedAt !== undefined) return;
    this.telemetry.audioStartedAt = performance.now();
    this.telemetry.ttsStartedAt = this.telemetry.audioStartedAt;
    if (this.telemetry.ttsRequestedAt !== undefined) this.telemetry.ttsRequestToAudioStartMs = nativeRequestToStartMs ?? Math.round(this.telemetry.audioStartedAt - this.telemetry.ttsRequestedAt);
    if (this.telemetry.finalTranscriptAt !== undefined) this.telemetry.transcriptToAudioStartMs = Math.round(this.telemetry.audioStartedAt - this.telemetry.finalTranscriptAt);
    const totalRecognitionMs = this.telemetry.nativeTiming?.totalRecognitionMs;
    if (totalRecognitionMs !== undefined && this.telemetry.transcriptToAudioStartMs !== undefined) this.telemetry.micToAudioStartMs = Math.round(totalRecognitionMs + this.telemetry.transcriptToAudioStartMs);
  }
  snapshot() { return this.telemetry ? structuredClone(this.telemetry) : undefined; }
  private set(state: VoiceSessionState) { this.value = state; this.onState(state); }
}
