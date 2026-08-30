import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const library=path.join(root,'CAR_MOVER');
const registry=readJson('.codex/agents/registry.json');
const index=readJson('CAR_MOVER/INDEX.json');
const issues=readJson('CAR_MOVER/CONFLICTS_AND_GAPS.json');
const baseline=readJson('CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json');
const categories=['ARCHITECTURE','GOVERNANCE','REQUIREMENTS','API','JOB_FILE','ROUTING','TOLL','FIELD','COPILOT','OPPORTUNITY_INTELLIGENCE','OCR_DOCUMENTS','ANDROID','WEB','TESTS','INCIDENTS','RELEASES','EVIDENCE','DECISIONS','RUNBOOKS','ARCHIVE'];
const statuses=new Set(['CURRENT','SUPERSEDED','HISTORICAL','DRAFT','EVIDENCE']);
const managedSourcePaths=new Set(['CAR_MOVER/GOVERNANCE/AGM_CENTRAL_LIBRARIAN_CONTRACT.md','CAR_MOVER/GOVERNANCE/OWNER_MANDATE_AGM_LIBRARY_2026-08-29.md','CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json']);

assert(registry.agents.filter((agent)=>agent.id==='agm-central-librarian').length===1,'CENTRAL_LIBRARIAN_REGISTRY_COUNT');
assert(new Set(registry.agents.map((agent)=>agent.id)).size===registry.agents.length,'AGENT_REGISTRY_DUPLICATE_ID');
const central=registry.agents.find((agent)=>agent.id==='agm-central-librarian');
assert(central.status==='OFFICIAL_PERSISTENT','CENTRAL_LIBRARIAN_NOT_OFFICIAL');
assert(central.runtimeAuthority==='NONE'&&central.publicationAuthority==='NONE','CENTRAL_LIBRARIAN_AUTHORITY_BOUNDARY');
assert(central.id!==baseline.basicAgent.id,'BASIC_CENTRAL_ID_COLLISION');
assert(!read('apps/web/src/agent-governance.registry.ts').includes('agm-central-librarian'),'BASIC_RUNTIME_REGISTRY_WAS_MODIFIED_FOR_CENTRAL_AGENT');

for(const protectedFile of baseline.protectedHashes){
  assert(sha(protectedFile.path)===protectedFile.sha256,'BASIC_LIBRARIAN_BASELINE_CHANGED:'+protectedFile.path);
}

assert(index.agentId==='agm-central-librarian','INDEX_CUSTODIAN_MISMATCH');
assert(index.sourceMode==='REFERENCE_ONLY_NON_DESTRUCTIVE','INDEX_NOT_REFERENCE_ONLY');
assert(index.records.length>0,'INDEX_EMPTY');
assert(index.corpus.records===index.records.length,'INDEX_COUNT_MISMATCH');
for(const category of categories)assert(existsSync(path.join(library,category,'README.md')),'CATEGORY_MISSING:'+category);
for(const record of index.records){
  for(const field of ['id','path','category','sha256','sourceDate','version','status','owner','lastModified'])assert(record[field]!==undefined&&record[field]!==null&&String(record[field]).length>0,'RECORD_METADATA_MISSING:'+field+':'+record.path);
  assert(statuses.has(record.status),'RECORD_STATUS_INVALID:'+record.path);
  assert(record.originalPreserved===true&&record.libraryCopyCreated===false,'ORIGINAL_PRESERVATION_FLAG_INVALID:'+record.path);
  assert(!record.path.startsWith('CAR_MOVER/')||managedSourcePaths.has(record.path),'LIBRARY_RECURSION_DETECTED:'+record.path);
  assert(existsSync(path.join(root,record.path)),'SOURCE_MISSING:'+record.path);
  assert(sha(record.path)===record.sha256,'SOURCE_HASH_MISMATCH:'+record.path);
  for(const evidence of record.evidenceRefs)assert(existsSync(path.join(root,evidence)),'EVIDENCE_REFERENCE_MISSING:'+evidence);
  for(const predecessor of record.supersedes)assert(index.records.some((item)=>item.path===predecessor),'SUPERSEDES_REFERENCE_MISSING:'+predecessor);
  for(const successor of record.supersededBy)assert(index.records.some((item)=>item.path===successor),'SUPERSEDED_BY_REFERENCE_MISSING:'+successor);
}

for(const requiredCategory of categories){
  assert(index.records.some((record)=>record.category===requiredCategory),'REQUIRED_CATEGORY_EMPTY:'+requiredCategory);
}
assert(issues.conflicts.length>0,'CONFLICT_REGISTER_EMPTY');
assert(issues.conflicts.every((item)=>item.status==='CONFLICT DETECTED → OWNER/INSPECTOR REVIEW'&&item.automaticResolution===false),'CONFLICT_POLICY_INVALID');
assert(issues.missing.length>0,'MISSING_DOCUMENT_REGISTER_EMPTY');
assert(issues.missing.every((item)=>item.status!=='PASS'),'MISSING_DOCUMENT_FALSE_PASS');

const manifestLines=read('CAR_MOVER/SOURCE_MANIFEST.sha256').trim().split(/\r?\n/);
assert(manifestLines.length===index.records.length,'SOURCE_MANIFEST_COUNT_MISMATCH');
for(const record of index.records)assert(manifestLines.includes(`${record.sha256}  ${record.path}`),'SOURCE_MANIFEST_ENTRY_MISSING:'+record.path);

console.log('AGM_CENTRAL_LIBRARIAN=IMPLEMENTED');
console.log('BASIC_LIBRARIAN=UNCHANGED');
console.log(`CAR_MOVER_ARCHIVE=CONSOLIDATED records=${index.records.length}`);
console.log(`TRACEABILITY=PASS manifest=${manifestLines.length}`);
console.log('HISTORICAL_EVIDENCE=PRESERVED');
console.log(`CONFLICTS_REQUIRING_REVIEW=${issues.conflicts.length}`);
console.log(`MISSING_OR_PARTIAL_DOCUMENTS=${issues.missing.length}`);

function readJson(rel){return JSON.parse(read(rel));}
function read(rel){return readFileSync(path.join(root,rel),'utf8');}
function sha(rel){const absolute=path.join(root,rel);assert(statSync(absolute).isFile(),'NOT_A_FILE:'+rel);return createHash('sha256').update(readFileSync(absolute)).digest('hex');}
function assert(value,message){if(!value)throw new Error(message);}
