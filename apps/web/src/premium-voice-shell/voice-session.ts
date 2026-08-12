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
  ttsStartedAt?: number;
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
  on() { this.enabled = true; this.generation += 1; this.set('STANDBY'); return this.generation; }
  off() { this.enabled = false; this.generation += 1; this.telemetry = undefined; this.set('OFF'); }
  transition(state: VoiceSessionState) { if (this.enabled || state === 'ERROR' || state === 'OFF') this.set(state); }
  beginCycle() { this.telemetry = { cycleId: crypto.randomUUID(), listeningStartedAt: performance.now() }; return this.telemetry; }
  markSpeech() { if (this.telemetry && !this.telemetry.speechDetectedAt) this.telemetry.speechDetectedAt = performance.now(); }
  markTranscript(nativeTiming?: Record<string, number>) { if (this.telemetry) { this.telemetry.finalTranscriptAt = performance.now(); this.telemetry.nativeTiming = nativeTiming; } }
  markEngineRequest() { if (this.telemetry) this.telemetry.engineRequestAt = performance.now(); }
  markTts() { if (this.telemetry) this.telemetry.ttsStartedAt = performance.now(); }
  snapshot() { return this.telemetry ? structuredClone(this.telemetry) : undefined; }
  private set(state: VoiceSessionState) { this.value = state; this.onState(state); }
}
