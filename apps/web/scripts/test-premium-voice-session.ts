import assert from 'node:assert/strict';
import { VoiceSessionController } from '../src/premium-voice-shell/voice-session';
const states:string[]=[];const session=new VoiceSessionController(s=>states.push(s));
const token=session.on();session.transition('LISTENING');session.beginCycle();session.transition('SPEECH_DETECTED');session.markSpeech();session.transition('TRANSCRIBING');session.markTranscript({silenceToEndMs:900});session.transition('UNDERSTANDING');session.markEngineRequest();session.transition('SPEAKING');session.markTts();session.transition('STANDBY');
assert.equal(session.isCurrent(token),true);assert.deepEqual(states,['STANDBY','LISTENING','SPEECH_DETECTED','TRANSCRIBING','UNDERSTANDING','SPEAKING','STANDBY']);assert.equal(session.snapshot()?.nativeTiming?.silenceToEndMs,900);
session.off();assert.equal(session.state(),'OFF');assert.equal(session.isCurrent(token),false);
console.log('Premium Voice Session state machine: PASS');
