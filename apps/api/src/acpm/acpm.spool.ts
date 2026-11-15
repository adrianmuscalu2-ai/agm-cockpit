import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, writeFileSync, renameSync, readFileSync, readdirSync, unlinkSync, statSync, fsyncSync, lstatSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { AcpmEvent } from '@agm/shared';
import { canonicalAcpm } from './acpm.canonical';

type SpoolRecord = { version: 'acpm-spool.v1'; companyId: string; payload: AcpmEvent; payloadHash: string };
type SpoolStatus = { enabled: boolean; directory: string|null; owner: boolean; ready: number; acked: number; quarantined: number; error: string|null; directoryDurability:string; limits:string };

/** New-event durability only. This never reads an AGM history table or reconstructs old events. */
export class AcpmSpool {
  private readonly root:string|null;
  private readonly ready:string|null;
  private readonly ack:string|null;
  private readonly quarantine:string|null;
  private readonly lock:string|null;
  private owned=false;
  private quarantined=0;
  private error:string|null=null;
  readonly initialization:Promise<void>;
  constructor(directory=process.env.ACPM_SPOOL_DIR) {
    this.root=directory ? resolve(directory) : null;
    this.ready=this.root&&join(this.root,'ready'); this.ack=this.root&&join(this.root,'ack');
    this.quarantine=this.root&&join(this.root,'quarantine'); this.lock=this.root&&join(this.root,'.owner.lock');
    this.initialization=this.initialize();
  }
  private async initialize() {
    if(!this.root){this.error='ACPM_SPOOL_DIR_NOT_CONFIGURED';return;}
    try {
      mkdirSync(this.ready!,{recursive:true});mkdirSync(this.ack!,{recursive:true});mkdirSync(this.quarantine!,{recursive:true});
      if(lstatSync(this.root!).isSymbolicLink()) throw new Error('ACPM_SPOOL_REPARSE_POINT_REFUSED');
      // Never take over an existing owner lock automatically: doing so could
      // race a second process that has just acquired the lock.
      if(existsSync(this.lock!)) throw new Error('ACPM_SPOOL_OWNER_LOCK_EXISTS');
      writeFileSync(this.lock!,`${process.pid}\n`,{flag:'wx'});this.owned=true;
    } catch(error){this.error=error instanceof Error?error.message:'ACPM_SPOOL_INIT_FAILED';return;}
  }
  publish(companyId:string,payload:AcpmEvent) {
    if(!this.root||!this.ready||!this.initialized()) throw new Error(this.error??'ACPM_SPOOL_UNAVAILABLE');
    const body=canonicalAcpm(payload); const payloadHash=createHash('sha256').update(body).digest('hex');
    const record:SpoolRecord={version:'acpm-spool.v1',companyId,payload,payloadHash};
    const name=`${companyId}--${payload.eventId}.json`, temp=join(this.ready,`.${name}.${process.pid}.tmp`), target=join(this.ready,name);
    if(!existsSync(target)) {
      const existing=readdirSync(this.ready).filter(n=>n.endsWith('.json'));const bytes=existing.reduce((sum,n)=>sum+statSync(join(this.ready!,n)).size,0);
      if(existing.length>=4096||bytes+Buffer.byteLength(JSON.stringify(record),'utf8')>256*1024*1024) throw new Error('ACPM_SPOOL_LIMIT_REACHED');
      const fd=openSync(temp,'wx'); try { writeFileSync(fd,JSON.stringify(record)); fsyncSync(fd); } finally { closeSync(fd); } renameSync(temp,target);
    }
    else { const existing=JSON.parse(readFileSync(target,'utf8')) as SpoolRecord; if(existing.companyId!==companyId||existing.payloadHash!==payloadHash)throw new Error('ACPM_SPOOL_IDENTITY_CONFLICT'); }
    return {name,payloadHash};
  }
  private initialized(){return this.owned&&!!this.ready&&!!this.ack&&!!this.quarantine;}
  reportError(error:unknown){this.error=error instanceof Error?error.message:'ACPM_SPOOL_REPLAY_FAILED';}
  /** Explicit recovery only: caller must identify the PID recorded by the lock.
   * ESRCH is the sole proof accepted for a dead owner; EPERM and ambiguous states block.
   * The old lock is retained under a unique name before an exclusive new lock is created. */
  recoverStaleOwner(expectedPid:number) {
    if(!this.root||!this.lock||this.owned)throw new Error('ACPM_SPOOL_RECOVERY_STATE_INVALID');
    const guard=`${this.lock}.recovery`;
    mkdirSync(guard); // atomic single-recoverer gate; stale guard requires manual review
    try {
      const recorded=Number.parseInt(readFileSync(this.lock,'utf8').trim(),10);
      if(!Number.isInteger(expectedPid)||expectedPid<=0||recorded!==expectedPid)throw new Error('ACPM_SPOOL_RECOVERY_PID_MISMATCH');
      try { process.kill(recorded,0); throw new Error('ACPM_SPOOL_OWNER_STILL_ACTIVE'); }
      catch(error) { if(error instanceof Error&&error.message==='ACPM_SPOOL_OWNER_STILL_ACTIVE')throw error; if((error as NodeJS.ErrnoException)?.code!=='ESRCH')throw new Error('ACPM_SPOOL_OWNER_STATUS_AMBIGUOUS'); }
      // Re-read under the recovery gate immediately before the atomic rename.
      if(Number.parseInt(readFileSync(this.lock,'utf8').trim(),10)!==recorded)throw new Error('ACPM_SPOOL_OWNER_CHANGED');
      const retained=`${this.lock}.recovered.${recorded}.${Date.now()}`;
      renameSync(this.lock,retained);
      writeFileSync(this.lock,`${process.pid}\n`,{flag:'wx'});this.owned=true;this.error=null;
      return {retainedLock:retained,recoveredPid:recorded,newPid:process.pid};
    } finally { rmdirSync(guard); }
  }
  async replay(deliver:(companyId:string,payload:AcpmEvent,payloadHash:string)=>Promise<void>) {
    await this.initialization;if(!this.initialized())return;
    for(const name of readdirSync(this.ready!)){
      if(!name.endsWith('.json')||name.startsWith('.'))continue;
      const file=join(this.ready!,name);
      let record:SpoolRecord;
      try {
        record=JSON.parse(readFileSync(file,'utf8')) as SpoolRecord;
        const canonical=canonicalAcpm(record.payload);const digest=createHash('sha256').update(canonical).digest('hex');
        const separator=name.indexOf('--');const fileCompany=separator>0?name.slice(0,separator):'';const fileEvent=name.slice(separator+2).replace(/\.json$/,'');
        const p=record.payload as AcpmEvent; const kinds=['STARTED','WORKING','SUSPENDED','RESUMED','BLOCKED','HANDOFF','COMPLETED','FAILED'];
        if(record.version!=='acpm-spool.v1'||!record.companyId||record.companyId!==fileCompany||record.payloadHash!==digest||p.eventId!==fileEvent||!p.chainId||!p.mandateId||!p.runId||!p.componentId||!Number.isInteger(p.sequence)||p.sequence<1||!Number.isFinite(Date.parse(p.occurredAt))||!kinds.includes(p.kind)||p.source!=='ACP') throw new Error('ACPM_SPOOL_RECORD_INVALID');
      } catch(error){
        this.quarantined++;this.error=error instanceof Error?error.message:'ACPM_SPOOL_RECORD_FAILED';
        try { renameSync(file,join(this.quarantine!,`${name}.${Date.now()}.invalid`)); } catch { /* retain evidence if quarantine itself is unavailable */ }
        continue;
      }
      const ackFile=join(this.ack!,`${name}.ack`);
      if(existsSync(ackFile)) { if(readFileSync(ackFile,'utf8').trim()===record.payloadHash)continue; renameSync(ackFile,`${ackFile}.invalid.${Date.now()}`); }
      try {
        await deliver(record.companyId,record.payload,record.payloadHash);
        this.acknowledge(record.companyId,record.payload.eventId,record.payloadHash);
      } catch(error){ this.error=error instanceof Error?error.message:'ACPM_SPOOL_DELIVERY_FAILED'; return; }
    }
  }
  acknowledge(companyId:string,eventId:string,payloadHash:string) {
    if(!this.initialized())throw new Error(this.error??'ACPM_SPOOL_UNAVAILABLE');
    const name=`${companyId}--${eventId}.json`, ackFile=join(this.ack!,`${name}.ack`);
    if(existsSync(ackFile)) { if(readFileSync(ackFile,'utf8').trim()===payloadHash)return; throw new Error('ACPM_SPOOL_ACK_HASH_MISMATCH'); }
    const temp=`${ackFile}.${process.pid}.tmp`;writeFileSync(temp,`${payloadHash}\n`,{flag:'wx'});const fd=openSync(temp,'r+');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,ackFile);
  }
  status():SpoolStatus {
    const files=(dir:string|null,filter:(n:string)=>boolean)=>dir&&existsSync(dir)?readdirSync(dir).filter(filter).length:0;
    return {enabled:!!this.root,directory:this.root,owner:this.owned,ready:files(this.ready,n=>n.endsWith('.json')),acked:files(this.ack,n=>n.endsWith('.ack')),quarantined:this.quarantined,error:this.error,directoryDurability:'FILE_FSYNC_AND_ATOMIC_RENAME; DIRECTORY_FSYNC_LIMITED_ON_WINDOWS',limits:'4096_READY_FILES_OR_256MiB'};
  }
  close(){if(this.owned&&this.lock){try{unlinkSync(this.lock);}catch{/* preserve lock evidence on failure */}this.owned=false;}}
}
