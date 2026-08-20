import { chmod, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export type SuppressionAction='DELETE'|'ANONYMIZE'|'RESTRICT'|'PARTIAL_LEGAL_RESTRICTION'|'COMPACTION_CHECKPOINT';
export type SuppressionStatus='PREPARED'|'APPLIED';
export type SuppressionLedgerRecord={
  version:1;eventId:string;subjectPseudonym:string;action:SuppressionAction;effectiveAt:string;
  categories:string[];status:SuppressionStatus;applicationEvidence:string;previousMac:string;mac:string;
};
type Unsigned=Omit<SuppressionLedgerRecord,'mac'>;

const canonical=(record:Unsigned)=>JSON.stringify(record);
const mac=(record:Unsigned,key:Buffer)=>createHmac('sha256',key).update(canonical(record)).digest('hex');
export function ledgerKey(value:string|undefined){if(!value)throw new Error('SUPPRESSION_LEDGER_KEY_MISSING');const key=Buffer.from(value,'base64');if(key.length<32)throw new Error('SUPPRESSION_LEDGER_KEY_TOO_SHORT');return key;}
export function subjectPseudonym(companyId:string,subjectId:string,key:Buffer){return createHmac('sha256',key).update(`${companyId}:${subjectId}`).digest('hex');}

export async function readVerifiedLedger(path:string,key:Buffer){
  let raw:string;try{const info=await stat(path);if(process.platform!=='win32'&&(info.mode&0o077)!==0)throw new Error('SUPPRESSION_LEDGER_PERMISSIONS_TOO_BROAD');raw=await readFile(path,'utf8');}catch(error:any){if(error?.code==='ENOENT')throw new Error('SUPPRESSION_LEDGER_MISSING');throw error;}
  if(!raw.trim())throw new Error('SUPPRESSION_LEDGER_EMPTY');
  const records:SuppressionLedgerRecord[]=raw.trim().split(/\r?\n/).map((line,index)=>{try{return JSON.parse(line)}catch{throw new Error(`SUPPRESSION_LEDGER_INVALID_JSON_AT_${index+1}`)}});
  let previousMac='GENESIS';
  for(const [index,record] of records.entries()){
    const {mac:actual,...unsigned}=record;if(record.version!==1||record.previousMac!==previousMac||!/^[a-f0-9]{64}$/.test(actual??''))throw new Error(`SUPPRESSION_LEDGER_CHAIN_INVALID_AT_${index+1}`);
    const expected=mac(unsigned,key);if(!timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex')))throw new Error(`SUPPRESSION_LEDGER_MAC_INVALID_AT_${index+1}`);previousMac=actual;
  }
  return records;
}

export async function appendLedgerRecord(path:string,key:Buffer,input:Omit<Unsigned,'version'|'eventId'|'previousMac'>){
  let existing:SuppressionLedgerRecord[]=[];try{existing=await readVerifiedLedger(path,key)}catch(error:any){if(error.message!=='SUPPRESSION_LEDGER_MISSING')throw error;}
  const unsigned:Unsigned={version:1,eventId:randomUUID(),...input,previousMac:existing.at(-1)?.mac??'GENESIS'};const record={...unsigned,mac:mac(unsigned,key)};
  const handle=await open(path,'a',0o600);try{await handle.writeFile(`${JSON.stringify(record)}\n`);await handle.sync();}finally{await handle.close();}if(process.platform!=='win32')await chmod(path,0o600);return record;
}

export function effectiveActions(records:SuppressionLedgerRecord[]){
  const rank:Record<SuppressionAction,number>={COMPACTION_CHECKPOINT:0,RESTRICT:1,PARTIAL_LEGAL_RESTRICTION:2,ANONYMIZE:3,DELETE:4};const chosen=new Map<string,SuppressionLedgerRecord>();
  for(const record of records){if(record.action==='COMPACTION_CHECKPOINT')continue;const current=chosen.get(record.subjectPseudonym);if(!current||rank[record.action]>rank[current.action]||(rank[record.action]===rank[current.action]&&record.effectiveAt>current.effectiveAt))chosen.set(record.subjectPseudonym,record);}
  return [...chosen.values()];
}

export async function compactLedger(path:string,key:Buffer,cutoff:Date,dryRun=true){
  const records=await readVerifiedLedger(path,key);const removable=new Set(effectiveActions(records).filter(record=>new Date(record.effectiveAt)<cutoff).map(record=>record.subjectPseudonym));if(dryRun||!removable.size)return{affectedSubjects:removable.size,removedRecords:records.filter(record=>removable.has(record.subjectPseudonym)).length,dryRun};
  const retained=records.filter(record=>!removable.has(record.subjectPseudonym)&&record.action!=='COMPACTION_CHECKPOINT');const removedHash=createHmac('sha256',key).update(records.filter(record=>removable.has(record.subjectPseudonym)).map(record=>record.mac).join(':')).digest('hex');
  const source=retained.length?retained.map(record=>({subjectPseudonym:record.subjectPseudonym,action:record.action,effectiveAt:record.effectiveAt,categories:record.categories,status:record.status,applicationEvidence:record.applicationEvidence})):[{subjectPseudonym:'0'.repeat(64),action:'COMPACTION_CHECKPOINT' as SuppressionAction,effectiveAt:new Date().toISOString(),categories:[],status:'APPLIED' as SuppressionStatus,applicationEvidence:removedHash}];let previousMac='GENESIS';const rebuilt=source.map(input=>{const unsigned:Unsigned={version:1,eventId:randomUUID(),...input,previousMac};const record={...unsigned,mac:mac(unsigned,key)};previousMac=record.mac;return record;});const temporary=`${path}.compact-${randomUUID()}`;await writeFile(temporary,rebuilt.map(record=>JSON.stringify(record)).join('\n')+'\n',{mode:0o600});await rename(temporary,path);if(process.platform!=='win32')await chmod(path,0o600);return{affectedSubjects:removable.size,removedRecords:records.filter(record=>removable.has(record.subjectPseudonym)).length,dryRun:false};
}
