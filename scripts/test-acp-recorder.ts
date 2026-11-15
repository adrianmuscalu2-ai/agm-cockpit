import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { AgentChainRecorder } from '../packages/shared/src/agent-chain-recorder';
import type { AcpEvent } from '../packages/shared/src/agent-chain-performance';
async function main(){
 const attempts:AcpEvent[]=[];let fail=true;
 const r=new AgentChainRecorder({chainId:'fixture',mandateId:'fixture',runId:'fixture',componentId:'fixture',componentKind:'AGENT'},async e=>{attempts.push(e);if(fail)throw new Error('fixture transport failure');});
 const proof={evidenceRef:'fixture',evidenceHash:'a'.repeat(64)};
 await assert.rejects(r.record('COMPLETED',proof));
 await assert.rejects(r.record('STARTED',proof));
 await assert.rejects(r.record('WORKING',proof));fail=false;
 await r.retryPending();assert.deepEqual(attempts[0],attempts[1]);
 await r.record('SUSPENDED',proof);await assert.rejects(r.record('WORKING',proof));
 await r.record('RESUMED',proof);await r.record('COMPLETED',proof);await assert.rejects(r.record('STARTED',proof));
 assert.deepEqual(attempts.slice(1).map(e=>e.sequence),[1,2,3,4]);
 writeFileSync('evidence/acp-20261115/recorder-tests.json',JSON.stringify({at:new Date().toISOString(),dataClass:'SYNTHETIC_TEST_FIXTURE',passed:['retry preserves event ID and time','invalid transitions rejected','terminal state immutable','sequence advances only after acknowledged append']},null,2));
 console.log('Recorder tests: 4 passed');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
