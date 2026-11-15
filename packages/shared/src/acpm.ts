import { projectAcpmCore, type AcpmEvent, type AcpmCoreSnapshot } from './acpm.engine';
export { ACPM_KINDS } from './acpm.engine';
export type { AcpmEvent, AcpmKind, AcpmRun } from './acpm.engine';
export { AcpmRecorder } from './acpm.recorder';
export type AcpmInventoryEntry = {componentId:string;kind:string;module:string;supervisorId:string|null;observation:string};
export type AcpmFilters = {componentId?:string;kind?:string;departmentId?:string;from?:string;to?:string};
export function asAcpm(snapshot: AcpmCoreSnapshot & {inventory?:AcpmInventoryEntry[]}) {
  return {...snapshot,contract:'agent-chain-performance-monitor.v1' as const,module:'ACPM' as const,legacyContract:'agent-chain-performance.v1' as const};
}
export type AcpmObserverHealth = {accepted:number;persisted:number;failed:number;dropped:number;pending:number;missingIdentity:number;startedAt:string;durability:string;scope:string};
export type AcpmSnapshot = ReturnType<typeof asAcpm> & {observerHealth?:AcpmObserverHealth};
export function projectAcpm(events: AcpmEvent[], observedAt: string, truncated=false) {
  return asAcpm(projectAcpmCore(events,observedAt,truncated));
}
/** Runs intersecting the interval retain their complete context. Comparisons only use
 * complete runs wholly inside the interval. Nothing is written or inferred as authority. */
export function selectAcpm(snapshot:AcpmSnapshot,filters:AcpmFilters) {
  const from=filters.from ? Date.parse(filters.from) : -Infinity;
  const to=filters.to ? Date.parse(filters.to) : Infinity;
  if(Number.isNaN(from)||Number.isNaN(to)||from>to)throw new Error('ACPM_INVALID_TIME_RANGE');
  const declared=new Map(snapshot.inventory?.map(n=>[n.componentId,n]) ?? []);
  const runs=snapshot.runs.filter(r=>{
    const kind=r.componentKind==='UNKNOWN' ? declared.get(r.componentId)?.kind ?? 'UNKNOWN' : r.componentKind;
    if(filters.componentId && r.componentId!==filters.componentId)return false;
    if(filters.kind && kind!==filters.kind)return false;
    if(filters.departmentId && r.departmentId!==filters.departmentId && !(kind==='DEPARTMENT'&&r.componentId===filters.departmentId))return false;
    const start=Math.min(...r.events.map(e=>Date.parse(e.occurredAt)));
    const end=['COMPLETED','FAILED'].includes(r.status)?Math.max(...r.events.map(e=>Date.parse(e.occurredAt))):Date.parse(snapshot.observedAt);
    return start<=to && end>=from;
  });
  const ids=new Set(runs.flatMap(r=>r.events.map(e=>e.eventId)));
  const originals:AcpmEvent[]=[];
  // Follow the correction chain back without losing original provenance.
  let changed=true;
  while(changed){changed=false;for(const c of snapshot.corrections){if(ids.has(c.eventId)&&!ids.has(c.original.eventId)){ids.add(c.original.eventId);originals.push(c.original);changed=true;}}}
  const selected=projectAcpm([...runs.flatMap(r=>r.events),...originals],snapshot.observedAt,snapshot.truncated||snapshot.issues.length>0);
  const whole=runs.filter(r=>r.complete&&r.events.every(e=>Date.parse(e.occurredAt)>=from&&Date.parse(e.occurredAt)<=to));
  const analytics=projectAcpm(whole.flatMap(r=>r.events),snapshot.observedAt,snapshot.truncated||snapshot.issues.length>0);
  const chronology=runs.flatMap(r=>r.events).sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.sequence-b.sequence||a.eventId.localeCompare(b.eventId));
  return {...selected,observerHealth:snapshot.observerHealth,issues:[...new Set([...snapshot.issues,...selected.issues])],inventory:snapshot.inventory,comparisons:analytics.comparisons,
    transfers:snapshot.transfers.filter(t=>ids.has(t.eventId)||(!!t.acceptedByEventId&&ids.has(t.acceptedByEventId))),
    signals:[...selected.signals.filter(s=>s.kind!=='REGRESSION_CANDIDATE'),...analytics.signals.filter(s=>s.kind==='REGRESSION_CANDIDATE')],
    selection:{...filters},totalAvailableRuns:snapshot.runs.length,chronology,
    intervalRule:'INTERSECTING_RUNS_WITH_FULL_CONTEXT; COMPARISONS_REQUIRE_CONTAINED_COMPLETE_RUNS',
    evolution:whole.slice().sort((a,b)=>Date.parse(a.events[0].occurredAt)-Date.parse(b.events[0].occurredAt)).map(r=>({runId:r.runId,componentId:r.componentId,mandateId:r.mandateId,result:r.status,activeMs:r.activeMs,at:r.events.at(-1)!.occurredAt,evidenceEventId:r.events.at(-1)!.eventId}))};
}
