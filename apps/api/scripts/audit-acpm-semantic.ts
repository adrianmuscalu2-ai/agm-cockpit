import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { projectAcp, type AcpmEvent } from '@agm/shared';
import { canonicalAcpm } from '../src/acpm/acpm.canonical';
import { AcpmSemanticIndex } from '../src/acpm/acpm.semantic';
import { legacyAcp } from '../src/acpm/acpm.service';
import { premiumNetworkSeed } from '../src/authority-control-plane/premium-network.seed';
import { basicAgentDutySeed } from '../src/authority-control-plane/basic-agent-duty.seed';
const declarations=[...premiumNetworkSeed,...basicAgentDutySeed];

// Offline replay of a read-only canonical export, not a substitute for OWNER HTTP authentication.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('USAGE: audit-acpm-semantic.ts canonical-snapshot.json output.json');
const raw=readFileSync(input,'utf8');
const data=JSON.parse(raw) as { companyId:string;observedAt:string;productionCommit:string;configuredCandidateModel:string;
  rows:Array<{payload:AcpmEvent;payloadHash:string}>;legacy:Array<Parameters<typeof legacyAcp>[0]>;legacyTruncated:boolean;
  mandates:Array<{id:string;mandateKey:string;agentId:string;scopeId:string;version:number;status:string}> };
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const invalid=data.rows.filter(r=>hash(canonicalAcpm(r.payload))!==r.payloadHash);
if(invalid.length)throw new Error('CANONICAL_EXPORT_HASH_MISMATCH');
const native=data.rows.map(r=>r.payload),byId=new Map(native.map(e=>[e.eventId,e]));
const legacy=data.legacy.slice(0,10000).map(r=>legacyAcp({...r,occurredAt:new Date(r.occurredAt)})).filter(e=>{
  const n=byId.get(e.eventId);return !n||['chainId','mandateId','runId','componentId','sequence','occurredAt','evidenceRef','evidenceHash','kind'].some(k=>n[k as keyof AcpmEvent]!==e[k as keyof AcpmEvent]);
});
const snapshot=projectAcp([...native,...legacy],data.observedAt,data.legacyTruncated);
const events=[...snapshot.runs.flatMap(r=>r.events),...snapshot.corrections.map(c=>c.original)];
const index=new AcpmSemanticIndex(data.companyId),first=index.sync(events.slice(0,Math.floor(events.length/2)),data.observedAt,data.legacyTruncated,snapshot.issues);
const incremental=index.sync(events,data.observedAt,data.legacyTruncated,snapshot.issues);
const rebuilt=new AcpmSemanticIndex(data.companyId);rebuilt.sync(events.slice().reverse(),data.observedAt,data.legacyTruncated,snapshot.issues);
const rebuildIdentical=index.status().documentSetHash===rebuilt.status().documentSetHash;
if(!rebuildIdentical)throw new Error('REBUILD_MISMATCH');
const event=native[0],queries=[{q:'execuțiile agentului',agent:event?.componentId},{q:'gpt-6 luna',model:'gpt-6-luna'},
  {mandate:event?.mandateId},{q:'blocaje justificate'},{q:'blocaje nejustificate'},{q:'execuții eșuate'},{q:'opriri'},{incident:'missing-incident-not-fabricated'}];
const queryResults=queries.map(q=>index.search(q));
const nativeIndex=new AcpmSemanticIndex(data.companyId);nativeIndex.sync(native,data.observedAt);
const observedChain=nativeIndex.chain(event.chainId);
const gaps={model:native.filter(e=>!e.model).length,department:native.filter(e=>!e.departmentId).length,workload:native.filter(e=>!e.workload).length,
  unknownRegistryAgents:[...new Set(native.filter(e=>!declarations.some(n=>n.canonicalId===e.componentId)).map(e=>e.componentId))],
  unresolvedMandates:[...new Set(native.filter(e=>!data.mandates.some(m=>m.id===e.mandateId||m.mandateKey===e.mandateId)).map(e=>e.mandateId))]};
const report={at:new Date().toISOString(),sourceObservedAt:data.observedAt,sourceSnapshotSHA256:hash(raw),productionCommit:data.productionCommit,
  mode:'LOCAL_REPLAY_OF_REAL_CANONICAL_READONLY_EXPORT',sourceWrites:0,providerCalls:0,ownerHttpAuthenticationClaimed:false,
  counts:{native:native.length,legacyRead:data.legacy.length,legacyIncluded:legacy.length,projected:events.length},gaps,
  registryLinks:[...new Set(native.map(e=>e.componentId))].map(id=>({componentId:id,declaration:declarations.find(n=>n.canonicalId===id)??null,provenance:'premiumNetworkSeed + basicAgentDutySeed: declaration only, not execution or model identity'})),
  mandateLinks:data.mandates.map(m=>({...m,observedRuns:snapshot.runs.filter(r=>r.mandateId===m.id||r.mandateId===m.mandateKey).map(r=>({runId:r.runId,status:r.status,complete:r.complete}))})),
  index:{first,incremental,rebuildIdentical,status:index.status()},queryResults,
  chain:{nativeCompleteWindow:observedChain,combinedWindow:index.chain(event.chainId)},
  modelState:{configuredAlias:data.configuredCandidateModel,...index.modelState('gpt-6-luna')},
  correlation:{chains:snapshot.chains.length,issues:snapshot.issues,transfers:snapshot.transfers,blocks:snapshot.blocks,signals:snapshot.signals,comparisons:snapshot.comparisons},
  limits:['Legacy source window is bounded at10000; no full-history recovery attempted.','Model labels never imply provider execution.','Incident links require explicit evidence references; absence is not a successful incident query.','Deterministic RO/EN ontology, no general embedding or language-model understanding.']};
writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({output,counts:report.counts,gaps,rebuildIdentical,modelVerdict:report.modelState.verdict,chain:observedChain.completeness}));
