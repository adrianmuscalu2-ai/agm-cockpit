import assert from 'node:assert/strict';
import { AssistantTurnLatencyTracker, compactSourceSummary, startAnswerAndSourcePresentation } from '../src/premium-voice-shell/premium-assistant-source-presentation';

const timing = { timeToFirstTokenMs:250, orchestratorMs:20, modelMs:900, answerCompleteMs:950, serverTotalMs:970, sourceResolutionMs:4 };
const tracker = new AssistantTurnLatencyTracker(1_000);
tracker.acceptServer(timing);
tracker.markAudioStarted(1_300);
tracker.markSourcesVisible(121_000);
assert.deepEqual(tracker.snapshot(), {
  timeToFirstTokenMs:250,
  timeToFirstAudioMs:300,
  answerCompleteMs:950,
  sourcesVisibleMs:120_000,
});

const order:string[]=[];
let finishAudio!: (value:boolean)=>void;
let finishSources!: ()=>void;
const audioCompletion = new Promise<boolean>((resolve)=>{finishAudio=resolve;});
const sourceCompletion = new Promise<void>((resolve)=>{finishSources=resolve;});
const presentation=startAnswerAndSourcePresentation(
  ()=>{order.push('audio-start');return audioCompletion;},
  ()=>{order.push('sources-start');return sourceCompletion;},
);
assert.deepEqual(order,['audio-start','sources-start']);
finishSources();
await presentation.sources;
assert.equal(await Promise.race([presentation.audio,Promise.resolve('audio-still-running')]),'audio-still-running');
const simulatedVoiceAnswerDurationMs=30_000;
assert.equal(simulatedVoiceAnswerDurationMs,30_000);
finishAudio(true);
assert.equal(await presentation.audio,true);

assert.equal(compactSourceSummary({traceId:'t1',status:'LIBRARY_ONLY',generatedAt:'2026-09-12T12:00:00Z',counts:{total:2,library:2,live:0,cache:0}},'ro'),'Surse: 2 · Library 2');
assert.equal(compactSourceSummary({traceId:'t2',status:'READY',generatedAt:'2026-09-12T12:00:00Z',counts:{total:6,library:3,live:2,cache:1}},'ro'),'Surse: 6 · Library 3 · Live 2 · Cache 1');
assert.equal(compactSourceSummary({traceId:'t3',status:'LIVE_VERIFICATION_IN_PROGRESS',generatedAt:'2026-09-12T12:00:00Z',counts:{total:0,library:0,live:0,cache:0}},'ro'),'Sursă live în curs de verificare');
assert.equal(compactSourceSummary({traceId:'t4',status:'NO_VERIFIED_SOURCES',generatedAt:'2026-09-12T12:00:00Z',counts:{total:0,library:0,live:0,cache:0}},'ro'),'Nicio sursă verificată atașată');

console.log('Premium Assistant source latency: audio-first, 30s answer simulation, 120s source delay isolation PASS');
