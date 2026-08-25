import assert from 'node:assert/strict';
import { VoiceSessionController } from '../src/premium-voice-shell/voice-session';
const states:string[]=[];const session=new VoiceSessionController(s=>states.push(s));
const token=session.on();session.transition('LISTENING');session.beginCycle();session.transition('SPEECH_DETECTED');session.markSpeech();session.transition('TRANSCRIBING');session.markTranscript({silenceToEndMs:850,totalRecognitionMs:1400});session.transition('UNDERSTANDING');session.markEngineRequest();session.markEngineResponse({orchestratorMs:4,modelMs:120,serverTotalMs:124});session.transition('PREPARING');session.markTtsRequest();session.markAudioStart(35);session.transition('SPEAKING');session.settle();
const telemetry=session.snapshot();
assert.equal(session.isCurrent(token),true);assert.deepEqual(states,['STANDBY','LISTENING','SPEECH_DETECTED','TRANSCRIBING','UNDERSTANDING','PREPARING','SPEAKING','STANDBY']);assert.equal(telemetry?.nativeTiming?.silenceToEndMs,850);assert.equal(telemetry?.serverTiming?.modelMs,120);assert.equal(telemetry?.ttsRequestToAudioStartMs,35);assert.equal(telemetry?.micToAudioStartMs,(telemetry?.transcriptToAudioStartMs??0)+1400);
const replacementToken=session.interrupt();assert.equal(session.isCurrent(token),false);assert.equal(session.isCurrent(replacementToken),true);assert.equal(session.state(),'STANDBY');assert.equal(session.snapshot(),undefined);
session.off();assert.equal(session.state(),'OFF');assert.equal(session.isCurrent(replacementToken),false);
console.log('Premium Voice Session state machine: PASS');
