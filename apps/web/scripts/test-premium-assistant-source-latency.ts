import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const runtime = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.runtime.ts', import.meta.url), 'utf8');
const voiceView = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.view.ts', import.meta.url), 'utf8');
const copilotView = readFileSync(new URL('../src/premium-copilot/copilot.view.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/premium-voice-shell/premium-assistant.client.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

assert.doesNotMatch(runtime, /client\.sources\(|presentSources|sourceSummary|sourceList/, 'User runtime must not fetch or present engineering evidence');
assert.doesNotMatch(voiceView, /data-assistant-sources|premium-assistant-sources/, 'Voice user UI must not expose source trace');
assert.doesNotMatch(copilotView, /data-assistant-sources|premium-assistant-sources/, 'Copilot user UI must not expose source trace');
assert.doesNotMatch(css, /data-assistant-sources|premium-assistant-sources/, 'User CSS must not retain source controls');
assert.match(client, /async sources\(traceId:/, 'Engineering source trace retrieval must remain available');
assert.match(client, /premium-assistant\/sources\//, 'Engineering evidence must use the dedicated authenticated endpoint');
assert.match(client, /sourceTrace: Omit<AssistantSourceTrace, 'sources'>/, 'User response must carry only the trace handle and counts');

console.log('Premium Assistant source boundary: user UI hidden, engineering endpoint preserved PASS');
