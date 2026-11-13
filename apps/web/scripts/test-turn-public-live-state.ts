import assert from 'node:assert/strict';
import { parseAgmatccVoiceCommand, readGovernanceModule, governanceReadFailure, summarizeGovernanceRead } from '../src/turn-agmatcc/agmatcc.commands';
import { beginTurnModuleRead, updateTurnModuleReadState, resolveTurnInitialPage } from '../src/turn-command-navigation';

assert.deepEqual(parseAgmatccVoiceCommand('citește governance'), { type: 'read-governance' });
assert.deepEqual(parseAgmatccVoiceCommand('citește evaluările RK'), { type: 'read-risk-knowledge' });
assert.deepEqual(parseAgmatccVoiceCommand('caută în RK recuperare'), { type: 'read-risk-knowledge', query: 'recuperare' });
assert.deepEqual(parseAgmatccVoiceCommand('activează governance'), { type: 'none' });
assert.deepEqual(parseAgmatccVoiceCommand('aprobă evaluările RK'), { type: 'none' });
assert.equal(resolveTurnInitialPage('#turn-journal-risk-knowledge'), 'incidents');
assert.equal(resolveTurnInitialPage('#turn-governance-risk-knowledge-read-surface'), 'incidents');
assert.equal(resolveTurnInitialPage('#turn-premium'), 'premium');
assert.equal(resolveTurnInitialPage('#not-a-module'), 'agmatcc');

const calls: string[] = [];
const fetcher = async (path: string, init?: RequestInit) => {
  calls.push(path);
  assert.equal(init?.method, 'GET'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.body, undefined);
  return new Response(JSON.stringify({ data: [{ scope: 'Recovery review', verdict: 'REVIEW_REQUIRED', conditions: [{ id: 'recovery-drill', status: 'REQUIRED' }] }], meta: { requestId: 'read-proof' } }));
};
const read = await readGovernanceModule('risk-knowledge', 'restore + backup', fetcher);
assert.equal(calls[0], '/governance-v2/risk-knowledge/assessments?q=restore%20%2B%20backup');
assert.equal(read.requestId, 'read-proof');
assert.match(summarizeGovernanceRead(read), /REVIEW_REQUIRED.*recovery-drill REQUIRED/);
assert.doesNotMatch(summarizeGovernanceRead(read), /VALIDATED|SATISFIED/);
await readGovernanceModule('governance', undefined, fetcher);
assert.equal(calls[1], '/governance-v2/proposals');
await assert.rejects(readGovernanceModule('risk-knowledge', 'x', fetcher), /QUERY_INVALID/);
assert.equal(calls.length, 2, 'invalid query must not send a request');
for (const [status, state] of [[401, 'AUTH_REQUIRED'], [403, 'FORBIDDEN'], [503, 'UNAVAILABLE']] as const) {
  let denial: unknown;
  try { await readGovernanceModule('governance', undefined, async () => new Response('{}', { status })); } catch (e) { denial = e; }
  assert.ok(denial); assert.equal(governanceReadFailure(denial), state);
}
await assert.rejects(readGovernanceModule('governance', undefined, async () => new Response(JSON.stringify({ data: {} }))), /INVALID_RESPONSE/);
const empty = await readGovernanceModule('risk-knowledge', 'Production', async () => new Response(JSON.stringify({ data: [] })));
assert.match(summarizeGovernanceRead(empty), /fără evaluări/);
assert.doesNotMatch(summarizeGovernanceRead(empty), /PASS|VALIDATED/);

const nodes = [{ textContent: '', title: '', dataset: { validationStatus: 'UNKNOWN' } as Record<string, string> }];
Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelectorAll: () => nodes } });
updateTurnModuleReadState('governance', 'CONNECTED_READ_ONLY', 'actual-request');
assert.equal(nodes[0].dataset.validationStatus, 'UNKNOWN', 'connectivity must not rewrite validation');
assert.equal(nodes[0].dataset.connectionStatus, 'CONNECTED_READ_ONLY');
assert.match(nodes[0].title, /API conectat.*actual-request/);
updateTurnModuleReadState('governance', 'FORBIDDEN');
assert.equal(nodes[0].dataset.connectionStatus, 'FORBIDDEN', 'a later refusal must remove the connected indication');
assert.match(nodes[0].textContent, /Acces refuzat/);
assert.doesNotMatch(nodes[0].textContent, /conectat|VALIDATED/);
assert.match(nodes[0].title, /Acces refuzat/);
assert.doesNotMatch(nodes[0].title, /conectat|actual-request|VALIDATED/);
const oldRequest = beginTurnModuleRead('risk-knowledge');
const newRequest = beginTurnModuleRead('risk-knowledge');
assert.equal(updateTurnModuleReadState('risk-knowledge', 'FORBIDDEN', '', newRequest), true);
assert.equal(updateTurnModuleReadState('risk-knowledge', 'CONNECTED_READ_ONLY', '', oldRequest), false);
assert.equal(nodes[0].dataset.connectionStatus, 'FORBIDDEN', 'stale successful response must not replace a newer denial');
const latestRequest = beginTurnModuleRead('risk-knowledge');
assert.equal(updateTurnModuleReadState('risk-knowledge', 'CONNECTED_READ_ONLY', '', latestRequest), true);
assert.equal(nodes[0].dataset.validationStatus, 'UNKNOWN', 'a fresh connection still grants no validation authority');
Reflect.deleteProperty(globalThis, 'document');
console.log('TURN live read-state checks passed: read-only routing, refusals, malformed/empty evidence and no synthetic validation.');
