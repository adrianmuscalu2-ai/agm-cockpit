import type { AcpmEvent, AcpmKind } from './acpm.engine';

/** Producer adapter: the caller supplies its existing authorized transport and evidence.
 * No credentials, clock overrides, authority decisions or business actions are created here.
 * If transport fails, retryPending reuses the same event ID and timestamp.
 */
export class AcpmRecorder {
  private sequence=0;
  private pending: AcpmEvent | null=null;
  private state:'NEW'|'ACTIVE'|'PAUSED'|'TERMINAL'='NEW';
  private inFlight=false;
  constructor(private readonly identity:Pick<AcpmEvent,'chainId'|'mandateId'|'runId'|'componentId'|'componentKind'|'departmentId'>,
    private readonly append:(event:AcpmEvent)=>Promise<unknown>) {}
  async record(kind:AcpmKind, evidence:Pick<AcpmEvent,'evidenceRef'|'evidenceHash'>,
    metadata:Partial<Pick<AcpmEvent,'parentEventId'|'targetComponentId'|'block'|'model'|'workload'|'capacity'>>={}) {
    if(this.pending || this.inFlight)throw new Error('ACP_PENDING_EVENT_MUST_BE_RETRIED');
    const allowed=this.state==='NEW'?['STARTED']:this.state==='ACTIVE'?['WORKING','SUSPENDED','BLOCKED','HANDOFF','COMPLETED','FAILED']:this.state==='PAUSED'?['RESUMED','COMPLETED','FAILED']:[];
    if(!allowed.includes(kind))throw new Error('ACP_INVALID_PRODUCER_TRANSITION');
    this.pending={...this.identity,...metadata,...evidence,kind,eventId:globalThis.crypto.randomUUID(),sequence:this.sequence+1,occurredAt:new Date().toISOString(),source:'ACP'};
    return this.retryPending();
  }
  async retryPending() {
    if(!this.pending || this.inFlight)throw new Error('ACP_NO_RETRYABLE_EVENT');
    this.inFlight=true;
    try {
      const event=this.pending;
      await this.append(event);
      this.sequence=event.sequence;
      this.state=event.kind==='COMPLETED'||event.kind==='FAILED'?'TERMINAL':event.kind==='SUSPENDED'||event.kind==='BLOCKED'?'PAUSED':'ACTIVE';
      this.pending=null;return event;
    } finally {this.inFlight=false;}
  }
}
