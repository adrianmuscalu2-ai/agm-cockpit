/** ACPM is an observation projection. It grants no authority and never changes RK/Guardian. */
export const ACPM_KINDS = ['STARTED', 'WORKING', 'SUSPENDED', 'RESUMED', 'BLOCKED', 'HANDOFF', 'COMPLETED', 'FAILED'] as const;
export type AcpmKind = typeof ACPM_KINDS[number];
export const ACPM_COMPONENT_KINDS = ['AGENT','ORCHESTRATOR','INSPECTOR','DEPARTMENT','CONTROL_PLANE','GUARDIAN','SERVICE','GATEWAY','UNKNOWN'] as const;
export type AcpmEvent = {
  eventId: string; chainId: string; mandateId: string; runId: string;
  componentId: string; componentKind: typeof ACPM_COMPONENT_KINDS[number];
  departmentId?: string; kind: AcpmKind; sequence: number; occurredAt: string;
  evidenceRef: string; evidenceHash?: string; source: 'ACP' | 'LEGACY';
  parentEventId?: string; targetComponentId?: string;
  block?: { classification: 'JUSTIFIED' | 'UNJUSTIFIED' | 'UNREVIEWED'; reason: string; decisionRef: string };
  model?: { provider: string; name: string; version: string };
  workload?: { equivalenceKey: string; protocolVersion: string; environment: string; configurationHash: string };
  capacity?: number;
  supersedesEventId?: string; correctionReason?: string;
};
export type AcpmRun = {
  runId: string; chainId: string; mandateId: string; componentId: string;
  componentKind: AcpmEvent['componentKind']; departmentId?: string; status: string;
  activeMs: number | null; suspendedMs: number | null; wallMs: number | null;
  complete: boolean; issues: string[]; events: AcpmEvent[];
};
const median = (values: number[]) => { const s = [...values].sort((a,b) => a-b); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1]+s[m])/2; };
const cohort = (e: AcpmEvent) => e.workload && e.model ? JSON.stringify([e.workload.equivalenceKey, e.workload.protocolVersion, e.workload.environment, e.workload.configurationHash]) : null;
const modelKey = (e: AcpmEvent) => e.model ? JSON.stringify([e.model.provider,e.model.name,e.model.version]) : null;

export function projectAcpmCore(input: AcpmEvent[], observedAt: string, truncated = false) {
  const now = Date.parse(observedAt);
  if (!Number.isFinite(now)) throw new Error('INVALID_OBSERVATION_TIME');
  const issues: string[] = [];
  const superseded = new Set<string>();
  const corrections: Array<{eventId:string; supersedesEventId:string; reason:string; original:AcpmEvent}> = [];
  for (const e of input.filter(e=>e.supersedesEventId)) {
    const original=input.find(x=>x.eventId===e.supersedesEventId);
    if(!original || original.source!=='ACP' || e.source!=='ACP' || !e.correctionReason || original.eventId===e.eventId ||
      ['chainId','runId','mandateId','componentId','sequence'].some(k=>original[k as keyof AcpmEvent]!==e[k as keyof AcpmEvent]) || superseded.has(original.eventId)) {
      issues.push(`INVALID_CORRECTION:${e.eventId}`);continue;
    }
    const visited=new Set([e.eventId]);let ancestor:AcpmEvent|undefined=original;
    while(ancestor){if(visited.has(ancestor.eventId)){issues.push(`CORRECTION_CYCLE:${e.eventId}`);break;}visited.add(ancestor.eventId);ancestor=input.find(x=>x.eventId===ancestor?.supersedesEventId);}
    superseded.add(original.eventId);corrections.push({eventId:e.eventId,supersedesEventId:original.eventId,reason:e.correctionReason,original});
  }
  const ids = new Map<string, string>();
  const groups = new Map<string, AcpmEvent[]>();
  for (const event of input) {
    if(superseded.has(event.eventId)) continue;
    const signature = JSON.stringify(event);
    if (ids.has(event.eventId)) { if (ids.get(event.eventId) !== signature) issues.push(`CONFLICT:${event.eventId}`); continue; }
    ids.set(event.eventId, signature);
    if (!Number.isFinite(Date.parse(event.occurredAt)) || Date.parse(event.occurredAt) > now) { issues.push(`INVALID_TIME:${event.eventId}`); continue; }
    const key = JSON.stringify([event.chainId,event.runId,event.componentId]);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const runs: AcpmRun[] = [];
  for (const events of groups.values()) {
    events.sort((a,b) => a.sequence-b.sequence || a.eventId.localeCompare(b.eventId));
    const first = events[0]; const faults: string[] = [];
    let state = 'NONE', active = 0, suspended = 0, previous = Date.parse(first.occurredAt);
    let sequence = 0, finished = false;
    for (const event of events) {
      const time = Date.parse(event.occurredAt);
      if (event.sequence !== sequence + 1) faults.push(`SEQUENCE_GAP:${event.eventId}`);
      if (time < previous) faults.push(`TIME_REVERSED:${event.eventId}`);
      if (event.mandateId !== first.mandateId || event.componentKind !== first.componentKind || event.departmentId !== first.departmentId) faults.push(`IDENTITY_CHANGED:${event.eventId}`);
      if (finished) faults.push(`AFTER_TERMINAL:${event.eventId}`);
      if (state === 'ACTIVE') active += Math.max(0,time-previous);
      if (state === 'PAUSED') suspended += Math.max(0,time-previous);
      if (event.kind === 'STARTED') { if (state !== 'NONE') faults.push(`DUPLICATE_START:${event.eventId}`); state = 'ACTIVE'; }
      else if (event.kind === 'RESUMED') { if (state !== 'PAUSED') faults.push(`INVALID_RESUME:${event.eventId}`); state = 'ACTIVE'; }
      else if (event.kind === 'SUSPENDED' || event.kind === 'BLOCKED') { if (state !== 'ACTIVE') faults.push(`INVALID_PAUSE:${event.eventId}`); state = 'PAUSED'; }
      else if (event.kind === 'COMPLETED' || event.kind === 'FAILED') { if (state === 'NONE') faults.push(`MISSING_START:${event.eventId}`); state = event.kind; finished = true; }
      else if (state !== 'ACTIVE') faults.push(`INVALID_ACTIVE_EVENT:${event.eventId}`);
      previous = time; sequence = event.sequence;
    }
    if (first.kind !== 'STARTED') faults.push('MISSING_START');
    if (events.some(e => e.source === 'LEGACY')) faults.push('LEGACY_ACTIVITY_INTERVALS_UNKNOWN');
    if (truncated) faults.push('TRUNCATED_INPUT');
    if (issues.length) faults.push('INPUT_INTEGRITY_ISSUE');
    const last = events[events.length-1];
    // Open intervals are not extrapolated into measured execution time.
    // Wall time continues; active/suspended durations end at the last observation.
    const valid = faults.length === 0;
    runs.push({ runId:first.runId, chainId:first.chainId, mandateId:first.mandateId, componentId:first.componentId,
      componentKind:first.componentKind, departmentId:first.departmentId, status:state,
      activeMs:valid ? active : null, suspendedMs:valid ? suspended : null,
      wallMs:first.kind === 'STARTED' && !faults.some(x => x.startsWith('TIME_')) ? (finished ? Date.parse(last.occurredAt) : now)-Date.parse(first.occurredAt) : null,
      complete:valid && finished, issues:faults, events });
  }
  const all = runs.flatMap(r => r.events);
  const transfers = all.filter(e => e.kind === 'HANDOFF').map(e => ({ eventId:e.eventId, from:e.componentId, to:e.targetComponentId ?? null,
    acceptedByEventId:all.find(x => x.kind === 'STARTED' && x.parentEventId === e.eventId && x.componentId === e.targetComponentId && x.chainId === e.chainId && Date.parse(x.occurredAt) >= Date.parse(e.occurredAt))?.eventId ?? null, evidenceRef:e.evidenceRef }));
  const blocks = all.filter(e => e.kind === 'BLOCKED').map(e => ({ eventId:e.eventId, componentId:e.componentId,
    classification:e.block?.classification ?? 'UNREVIEWED', reason:e.block?.reason ?? 'No recorded assessment', decisionRef:e.block?.decisionRef ?? null, evidenceRef:e.evidenceRef }));
  const completed = runs.filter(r => r.complete && r.status === 'COMPLETED' && cohort(r.events[0]));
  const comparisons: Array<{ cohort:string; models:Array<{ model:string; samples:number; medianActiveMs:number; evidenceEventIds:string[] }>; comparable:boolean }> = [];
  for (const key of new Set(completed.map(r => cohort(r.events[0])!))) {
    const subset = completed.filter(r => cohort(r.events[0]) === key);
    const models = [...new Set(subset.map(r => modelKey(r.events[0])!))].map(model => {
      const samples = subset.filter(r => modelKey(r.events[0]) === model);
      return {model,samples:samples.length,medianActiveMs:median(samples.map(r => r.activeMs!)),evidenceEventIds:samples.map(r => r.events.at(-1)!.eventId)};
    });
    comparisons.push({cohort:key, models, comparable:models.filter(m => m.samples >= 3).length >= 2});
  }
  const signals: Array<{ kind:string; componentId:string; evidenceEventIds:string[]; detail:string }> = [];
  for (const componentId of new Set(runs.map(r => r.componentId))) {
    const current = runs.filter(r => r.componentId === componentId && r.status === 'ACTIVE' && r.issues.length === 0 && now-Date.parse(r.events.at(-1)!.occurredAt)<=90000);
    const stale=runs.filter(r=>r.componentId===componentId && r.status==='ACTIVE' && now-Date.parse(r.events.at(-1)!.occurredAt)>90000);
    if(stale.length)signals.push({kind:'TELEMETRY_STALE',componentId,evidenceEventIds:stale.map(r=>r.events.at(-1)!.eventId),detail:'Open execution without an observation for >90 seconds; availability and overload cannot be inferred.'});
    const capacities = [...new Set(current.map(r => r.events[0].capacity).filter((n): n is number => typeof n==='number' && Number.isInteger(n) && n>0))];
    if (capacities.length === 1 && current.length > capacities[0]) signals.push({kind:'OVERLOAD',componentId,evidenceEventIds:current.map(r=>r.events[0].eventId),detail:`${current.length} active runs / declared capacity ${capacities[0]}`});
    const failed = runs.filter(r => r.componentId === componentId && r.complete && r.status === 'FAILED');
    if (failed.length) signals.push({kind:'DEGRADATION',componentId,evidenceEventIds:failed.map(r=>r.events.at(-1)!.eventId),detail:`${failed.length} explicit failed runs in the observed window`});
    const candidates = completed.filter(r => r.componentId === componentId);
    for (const key of new Set(candidates.map(r => `${cohort(r.events[0])}|${modelKey(r.events[0])}`))) {
      const s = candidates.filter(r=>`${cohort(r.events[0])}|${modelKey(r.events[0])}`===key).sort((a,b)=>Date.parse(a.events[0].occurredAt)-Date.parse(b.events[0].occurredAt));
      if (s.length < 6) continue;
      const prior = s.slice(-6,-3), recent = s.slice(-3);
      const baseline = median(prior.map(r=>r.activeMs!)), latest = median(recent.map(r=>r.activeMs!));
      if (baseline > 0 && latest > baseline*1.25) signals.push({kind:'REGRESSION_CANDIDATE',componentId,evidenceEventIds:[...prior,...recent].map(r=>r.events.at(-1)!.eventId),detail:`Median active duration ${latest}ms exceeds prior ${baseline}ms by >25%; 3+3 equivalent runs; human review required`});
    }
  }
  return { contract:'agent-chain-performance.v1' as const, observedAt, policy:{staleAfterMs:90000,regressionRatio:1.25,minimumSamplesPerModel:3,openIntervals:'NOT_EXTRAPOLATED'}, coverage:'OBSERVED_EVENTS_ONLY' as const, truncated, issues, corrections, runs, transfers, blocks, comparisons, signals,
    departments:[...new Set(runs.map(r=>r.departmentId).filter((x): x is string => !!x))].map(id=>({id,runIds:runs.filter(r=>r.departmentId===id).map(r=>r.runId)})),
    chains:[...new Set(runs.map(r=>r.chainId))].map(id=>({id,runIds:runs.filter(r=>r.chainId===id).map(r=>r.runId),mandateIds:[...new Set(runs.filter(r=>r.chainId===id).map(r=>r.mandateId))]})) };
}
export type AcpmCoreSnapshot = ReturnType<typeof projectAcpmCore>;
