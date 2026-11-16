import { createHash } from 'node:crypto';
import { projectAcp, embedText, cosine, foldText, queryConceptSet, SEMANTIC_INDEX_VERSION, type AcpmEvent } from '@agm/shared';
import { canonicalAcpm } from './acpm.canonical';

const hash = (value: unknown) => createHash('sha256').update(canonicalAcpm(value)).digest('hex');
const words = (value: string) => foldText(value).split(' ').filter(Boolean);
const stop = new Set(words('arata arata-mi aratami care sunt cauta cautare dupa pentru ale al si cu din de la in pe un o toate executiile executii executia agent agentul model modelul mandat mandatul incident incidentul show find search the for of by with all executions execution agent model mandate incident'));
for(const word of words('agentului agentilor agenti agentii modelului modele modelele mandatului mandatele mandatelor incidentului incidentele incidentelor lant lantul lantului departament departamentul departamentului')) stop.add(word);
const concepts: Record<string, string[]> = {
  blocked: words('blocked block blocks blocaj blocaje blocajele blocat blocate blocata blocarile'),
  failed: words('failed failure error errors esuat esuate esec esecuri eroare erori'),
  completed: words('completed finished done finalizat finalizate terminate finalizari'),
  suspended: words('suspended paused interrupted intrerupt intrerupte suspendat suspendate pauza opriri oprit oprite'),
  handoff: words('handoff transfer transferred transferuri predare transferate'),
  justified: words('justified justificat justificate'),
  unjustified: words('unjustified nejustificat nejustificate'),
  unreviewed: words('unreviewed neevaluat neevaluate'),
};
const concept = (word: string) => Object.keys(concepts).find(key => concepts[key].includes(word)) ?? word;
export type SemanticQuery = { q?: string; agent?: string; model?: string; mandate?: string; incident?: string; chain?: string; limit?: number; includeHistory?: boolean };
type Document = { id: string; event: AcpmEvent; sourceHash: string; terms: string[]; sharedConcepts:Set<string>; incidentRefs: string[]; missing: string[] };

/** Disposable tenant projection using the existing shared semantic-hash engine.
 * ACPM lifecycle facets prevent justified/unjustified similarity from becoming a
 * false match. No source mutation, paid calls or inferred model identities. */
export class AcpmSemanticIndex {
  private documents = new Map<string, Document>();
  private coverage = { truncated: false, issues: [] as string[] };
  private observedAt = '';
  private trustedProviderIds = new Set<string>();
  constructor(readonly companyId: string) {}

  sync(events: AcpmEvent[], observedAt: string, truncated = false, issues: string[] = [],trustedProviderIds:string[]=[]) {
    if (!Number.isFinite(Date.parse(observedAt))) throw new Error('ACPM_INVALID_OBSERVATION_TIME');
    const next = new Map<string, Document>();
    let added = 0, reused = 0;
    for (const source of events) {
      const sourceHash = hash(source);
      const id = `acpm:${hash([this.companyId, source.source, source.eventId])}`;
      const existing = this.documents.get(id) ?? next.get(id);
      if (existing && existing.sourceHash !== sourceHash) throw new Error('ACPM_SEMANTIC_SOURCE_CONFLICT');
      if (next.has(id)) continue;
      if (existing) { next.set(id, existing); reused++; continue; }
      const event = JSON.parse(canonicalAcpm(source)) as AcpmEvent;
      const references = [event.evidenceRef, event.block?.decisionRef ?? ''];
      const incidentRefs = [...new Set(references.flatMap(ref => [...ref.matchAll(/(?:incident:|incidents?\/)([a-zA-Z0-9_-]+)/g)].map(m => m[1])))];
      const missing = ['model', 'departmentId', 'workload'].filter(key => !event[key as keyof AcpmEvent]);
      const text = [event.componentId, event.componentKind, event.chainId, event.mandateId, event.runId,event.execution?.runtimeSessionId,event.execution?.orchestratorId,event.providerExecution?.requestedModel,event.providerExecution?.executedModel,
        event.kind, event.departmentId, event.model?.provider, event.model?.name, event.model?.version,
        event.block?.classification, event.block?.reason, event.targetComponentId, ...references].filter(Boolean).join(' ');
      const terms = [...new Set(words(text).map(concept))];
      next.set(id, { id, event, sourceHash, terms,sharedConcepts:queryConceptSet(text),incidentRefs, missing });
      added++;
    }
    // Replace only the derived view. A bounded source window cannot assert full history.
    const removedFromView = [...this.documents.keys()].filter(id => !next.has(id)).length;
    this.documents = next;
    this.trustedProviderIds=new Set(trustedProviderIds);
    this.observedAt = observedAt;
    this.coverage = { truncated, issues: [...issues] };
    return { added, reused, removedFromView, size: next.size, sourceWrites: 0, ...this.status() };
  }

  status() {
    return { contract: 'acpm-semantic-index.v1', algorithm: 'SHARED_SEMANTIC_HASH_WITH_ACPM_STATE_FACETS',sharedEngine:SEMANTIC_INDEX_VERSION,
      observedAt: this.observedAt, coverage: this.coverage, sourceOfTruth: false,
      sourceEvidenceContentVerified: false, modelIdentityInferred: false,
      documentSetHash: hash([...this.documents.values()].map(d => [d.id, d.sourceHash]).sort((a,b) => a[0].localeCompare(b[0]))) };
  }

  search(query: SemanticQuery = {}) {
    if ((query.q?.length ?? 0) > 500 || (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100))) throw new Error('ACPM_INVALID_SEMANTIC_QUERY');
    const terms = [...new Set(words(query.q ?? '').filter(w => !stop.has(w)).map(concept))];
    const vector = embedText(terms.join(' '));
    const scores = new Map<string,number>();
    const score = (d:Document) => {
      if (!terms.length) return 0;
      let value=scores.get(d.id);
      if(value===undefined){value=Number(cosine(vector,embedText(d.terms.join(' '))).toFixed(6));scores.set(d.id,value);}
      return value;
    };
    const superseded = new Set([...this.documents.values()].map(d => d.event.supersedesEventId).filter(Boolean));
    const matches = [...this.documents.values()].filter(d => {
      const e = d.event;
      return (query.includeHistory || !superseded.has(e.eventId)) && (!query.agent || e.componentId === query.agent)
        && (!query.model || e.model?.name === query.model||e.providerExecution?.requestedModel===query.model||e.providerExecution?.executedModel===query.model) && (!query.mandate || e.mandateId === query.mandate)
        && (!query.chain || e.chainId === query.chain) && (!query.incident || d.incidentRefs.includes(query.incident))
        && terms.every(term => d.terms.includes(term) || (!concepts[term] && [...queryConceptSet(term)].some(c=>d.sharedConcepts.has(c))));
    }).sort((a,b) => score(b)-score(a) || b.event.occurredAt.localeCompare(a.event.occurredAt) || a.id.localeCompare(b.id));
    return { ...this.status(), query, interpretedTerms: terms, total: matches.length, results: matches.slice(0, query.limit ?? 30).map(d => ({
      id: d.id, event: d.event, labels: { agent: d.event.componentId, mandate: d.event.mandateId, chain: d.event.chainId,
        model: d.event.model ?? null, department: d.event.departmentId ?? null, incidentReferences: d.incidentRefs },
      missingMetadata: d.missing, matchedTerms: terms,score:score(d),scoreMeaning:'Similarity, not factual confidence or authority',
      provenance: { eventId: d.event.eventId, source: d.event.source, projectedPayloadHash: d.sourceHash, evidenceRef: d.event.evidenceRef,
        evidenceHash: d.event.evidenceHash ?? null, labelsDerivedFrom: 'EVENT_FIELDS_ONLY', modelEvidence: 'PRODUCER_REPORTED_NOT_PROVIDER_ATTESTED' },
    })) };
  }

  chain(chainId: string) {
    const events = [...this.documents.values()].filter(d => d.event.chainId === chainId).map(d => d.event);
    const snapshot = projectAcp(events, this.observedAt, this.coverage.truncated || this.coverage.issues.length > 0);
    const ids = new Set(events.map(e => e.eventId));
    const missingParents = events.filter(e => e.parentEventId && !ids.has(e.parentEventId)).map(e => ({ eventId: e.eventId, parentEventId: e.parentEventId }));
    return { ...this.status(), chainId, snapshot, missingParents,
      correlation:snapshot.runs.map(run=>({mandateId:run.mandateId,agentId:run.componentId,runId:run.runId,
        orchestrators:[...new Set(run.events.flatMap(e=>e.execution?.orchestratorId?[e.execution.orchestratorId]:[]))],
        runtimeSessions:[...new Set(run.events.flatMap(e=>e.execution?[e.execution.runtimeSessionId]:[]))],
        providerExecutions:run.events.filter(e=>this.trustedProviderIds.has(e.eventId)&&e.providerExecution?.source==='PROVIDER_RESPONSE').map(e=>({eventId:e.eventId,...e.providerExecution})),
        eventIds:run.events.map(e=>e.eventId),result:run.status,unknownFields:['orchestrator','runtimeSession','executedModel'].filter(field=>field==='orchestrator'?!run.events.some(e=>e.execution?.orchestratorId):field==='runtimeSession'?!run.events.some(e=>e.execution):!run.events.some(e=>this.trustedProviderIds.has(e.eventId)&&e.providerExecution?.executedModel)),
        provenance:'Canonical event fields only; absent historical metadata is UNKNOWN'})),
      persistedCoverage:this.coverage.truncated?'PARTIAL':'COMPLETE_CANONICAL_SNAPSHOT',
      completeness: !events.length ? 'UNKNOWN' : snapshot.truncated || snapshot.issues.length || missingParents.length || snapshot.runs.some(r => !r.complete) || snapshot.transfers.some(t => !t.acceptedByEventId) ? 'PARTIAL' : 'COMPLETE_OBSERVED_CHAIN',
      scope: 'Completeness refers only to recorded chain membership; undeclared work cannot be inferred.' };
  }

  modelState(name: string) {
    const all = [...this.documents.values()].map(d => d.event);
    const key = (e: AcpmEvent) => canonicalAcpm([e.chainId,e.runId,e.componentId]);
    const matchingRuns = new Set(all.filter(e => e.model?.name === name||e.providerExecution?.requestedModel===name||e.providerExecution?.executedModel===name).map(key));
    // Retain terminal/pause events even when a producer tags the model only at STARTED.
    const events = all.filter(e => matchingRuns.has(key(e)));
    const snapshot = projectAcp(events, this.observedAt, this.coverage.truncated || this.coverage.issues.length > 0);
    const chronology = events.slice().sort((a,b) => a.occurredAt.localeCompare(b.occurredAt));
    const responses=chronology.filter(e=>this.trustedProviderIds.has(e.eventId)&&e.providerExecution?.source==='PROVIDER_RESPONSE');
    const lastResponse=responses.at(-1);
    return { ...this.status(), requestedModel: name, verdict: events.length ? 'PARTIAL' : 'UNKNOWN',
      lastObservedEvent: chronology.at(-1) ?? null, currentSession: 'UNKNOWN', providerReportedModel: lastResponse?.providerExecution?.executedModel??null,
      demonstratedProviderModel: lastResponse?.providerExecution?.executedModel??null,providerVersion:null,
      providerVersionReason:lastResponse?.providerExecution?.providerVersionReason??'UNKNOWN: no persisted provider response metadata',
      providerResponseEvidence:responses.map(e=>({eventId:e.eventId,evidenceRef:e.evidenceRef,...e.providerExecution})),
      producerReportedModels: [...new Map(events.filter(e=>e.model).map(e=>[canonicalAcpm(e.model),e.model])).values()],
      runs: snapshot.runs, transfers: snapshot.transfers, blocks: snapshot.blocks, signals: snapshot.signals, comparisons: snapshot.comparisons,
      inactivity: 'UNKNOWN: absence of observations does not prove idleness or interruption',
      limitation: 'Only internal ledger provider-response records identify an executed model. Process sessions are telemetry, not authentication or provider conversation sessions; historical unknowns are retained.' };
  }
}
