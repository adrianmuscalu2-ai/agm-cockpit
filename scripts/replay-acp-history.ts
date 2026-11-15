import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { projectAcp, type AcpEvent } from '../packages/shared/src/agent-chain-performance';
const source=process.argv[2];if(!source)throw new Error('Explicit historical source required');
const bytes=readFileSync(source);let snapshot:any;
function find(x:any):void{
 if(typeof x==='string'){try{find(JSON.parse(x));}catch{}return;}
 if(!x||typeof x!=='object')return;
 if(x.contractVersion==='agent-runtime-accountability.v2'&&Array.isArray(x.agents))snapshot=x;
 for(const value of Object.values(x))find(value);
}
find(JSON.parse(bytes.toString('utf8')));if(!snapshot)throw new Error('No real accountability snapshot');
const events:AcpEvent[]=snapshot.agents.filter((a:any)=>a.executionEventId&&a.mandateId&&a.lastExecution&&['COMPLETED','FAILED','BLOCKED'].includes(a.lastResult)).map((a:any)=>({
 eventId:a.executionEventId,chainId:a.mandateId,mandateId:a.mandateId,runId:a.executionEventId,componentId:a.identity,componentKind:'UNKNOWN',kind:a.lastResult,
 sequence:1,occurredAt:a.lastExecution,evidenceRef:a.executionEvidenceRef,source:'LEGACY',
}));
const projection=projectAcp(events,snapshot.generatedAt);
if(projection.runs.some(r=>r.activeMs!==null)||projection.comparisons.length)throw new Error('Historical snapshots must not invent duration or model comparisons');
writeFileSync('evidence/acp-20261115/historical-replay.json',JSON.stringify({source,sha256:createHash('sha256').update(bytes).digest('hex'),dataClass:'REAL_HISTORICAL_SNAPSHOT_NOT_CURRENT_PRODUCTION',observedAt:snapshot.generatedAt,adaptation:'last execution only; sequence 1 is adapter position, not original sequence; chain grouped by mandate, no complete chain asserted',projection},null,2));
console.log(`Historical replay: ${projection.runs.length} real last-execution observations; no fabricated active durations or models`);
