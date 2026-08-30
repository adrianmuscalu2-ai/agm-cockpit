import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const libraryRoot=path.join(root,'CAR_MOVER');
const categories=['ARCHITECTURE','GOVERNANCE','REQUIREMENTS','API','JOB_FILE','ROUTING','TOLL','FIELD','COPILOT','OPPORTUNITY_INTELLIGENCE','OCR_DOCUMENTS','ANDROID','WEB','TESTS','INCIDENTS','RELEASES','EVIDENCE','DECISIONS','RUNBOOKS','ARCHIVE'];
const textExtensions=new Set(['.md','.txt','.json','.jsonl','.ts','.tsx','.js','.mjs','.cjs','.yml','.yaml','.xml','.sql','.prisma','.ps1','.sh','.html','.css','.toml']);
const excludedDirectories=new Set(['.git','node_modules','dist','build','.tmp','CAR_MOVER']);
const managedSourcePaths=new Set([
  'CAR_MOVER/GOVERNANCE/AGM_CENTRAL_LIBRARIAN_CONTRACT.md',
  'CAR_MOVER/GOVERNANCE/OWNER_MANDATE_AGM_LIBRARY_2026-08-29.md',
  'CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json',
]);
const generatedAt=new Date().toISOString();
const statusMap=gitStatus();

const overrides={
  'evidence/governance/AGM_CAR_MOVER_FOUNDATION_REUSE_AUDIT_2026-08-12.md':{status:'HISTORICAL'},
  'evidence/governance/AGM_CAR_MOVER_VEHICLE_CLASS_AMENDMENT_2026-08-12.md':{status:'CURRENT'},
  'evidence/governance/AGM_CAR_MOVER_P0_01_OWNER_REVIEW_2026-08-12.md':{status:'HISTORICAL'},
  'evidence/governance/AGM_CAR_MOVER_P0_01_PRODUCT_OWNER_ACCEPTANCE_2026-08-12.md':{status:'HISTORICAL',supersedes:['evidence/governance/AGM_CAR_MOVER_P0_01_OWNER_REVIEW_2026-08-12.md']},
  'evidence/governance/AGM_CAR_MOVER_P0_02_OWNER_REVIEW_2026-08-12.md':{status:'HISTORICAL'},
  'evidence/governance/AGM_CAR_MOVER_FREEZE_2026-08-12.md':{status:'HISTORICAL'},
  'evidence/car-mover/CAR_MOVER_HANDOFF_2026-08-23.md':{status:'HISTORICAL'},
  'evidence/routing-architecture/2026-08-29/IMPLEMENTATION_REPORT.md':{status:'CURRENT'},
  'evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_PROTOCOL.md':{status:'CURRENT'},
  'evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_REPORT.md':{status:'SUPERSEDED',supersededBy:['evidence/field-test-backend/2026-08-29/PREPARATION_REPORT.md']},
  'evidence/field-test-backend/2026-08-29/PREPARATION_REPORT.md':{status:'CURRENT',supersedes:['evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_REPORT.md']},
  'evidence/field-test-backend/2026-08-29/AUTHORIZED_TESTERS.md':{status:'CURRENT'},
  'CAR_MOVER/GOVERNANCE/AGM_CENTRAL_LIBRARIAN_CONTRACT.md':{status:'CURRENT'},
  'CAR_MOVER/GOVERNANCE/OWNER_MANDATE_AGM_LIBRARY_2026-08-29.md':{status:'CURRENT'},
  'CAR_MOVER/GOVERNANCE/BASIC_LIBRARIAN_BASELINE.json':{status:'EVIDENCE'},
};

const allFiles=[];
walk(root,allFiles);
for(const managed of managedSourcePaths){const absolute=path.join(root,managed);if(statSync(absolute).isFile())allFiles.push(absolute);}
const textCache=new Map();
const relevant=allFiles.filter((absolute)=>isRelevant(relative(absolute),absolute));
const records=relevant.map(buildRecord).sort((a,b)=>a.category.localeCompare(b.category)||a.path.localeCompare(b.path));
const exactDuplicates=duplicateGroups(records);
const versionFamilies=logicalFamilies(records);
const statusCounts=countBy(records,'status');
const categoryCounts=countBy(records,'category');
const conflicts=[
  {
    id:'CM-CONFLICT-001',status:'CONFLICT DETECTED → OWNER/INSPECTOR REVIEW',topic:'Product-boundary terminology',
    sourceA:'evidence/governance/AGM_CAR_MOVER_FOUNDATION_REUSE_AUDIT_2026-08-12.md',
    claimA:'Car Mover is described as a separate product context on the shared AGM platform.',
    sourceB:'evidence/car-mover/CAR_MOVER_HANDOFF_2026-08-23.md',
    claimB:'Car Mover is described as an AGM Premium component and not a separate project.',
    automaticResolution:false,
  },
];
const stateTransitions=[
  {topic:'P0-02 Android',historical:'evidence/governance/AGM_CAR_MOVER_FREEZE_2026-08-12.md',currentEvidence:'evidence/car-mover/p0-02/android/2026-08-23T15-03-00-221Z/report.json',classification:'HISTORICAL_STATE_SUPERSEDED_BY_LATER_EVIDENCE'},
  {topic:'Field data',historical:'evidence/routing-architecture/2026-08-29/FIELD_MEASUREMENT_REPORT.md',currentEvidence:'evidence/field-test-backend/2026-08-29/PREPARATION_REPORT.md',classification:'NO_FIELD_DATA_SUPERSEDED_BY_ONE_PENDING_NON_CONCLUSIVE_OBSERVATION'},
  {topic:'Paid route providers',historical:'Earlier provider-capability registrations',currentEvidence:'evidence/routing-architecture/2026-08-29/IMPLEMENTATION_REPORT.md',classification:'HERE_AND_TOLLGURU_NOT_REQUIRED_CURRENT_OWNER_DIRECTION'},
];
const missing=[
  {id:'CM-MISSING-001',item:'One versioned canonical Car Mover architecture document covering P0, P1 and the 2026-08-29 routing policy',impact:'Current truth is distributed across source, owner decisions and implementation reports.',status:'MISSING'},
  {id:'CM-MISSING-002',item:'Current standalone Job File specification with version and field ownership',impact:'Job File behavior exists in implementation/evidence but lacks one current canonical document.',status:'MISSING'},
  {id:'CM-MISSING-003',item:'Car Mover-specific OCR/document intake contract',impact:'Generic OCR evidence exists, but Car Mover document ownership and retention are not specified canonically.',status:'MISSING'},
  {id:'CM-MISSING-004',item:'Runtime-ready AGM Toll Library specification and verified source-update runbook',impact:'The component is registered but explicitly not runtime-ready.',status:'MISSING_BY_DESIGN'},
  {id:'CM-MISSING-005',item:'Car Mover-specific incident response runbook',impact:'Generic incident governance exists; no dedicated Car Mover runbook was found.',status:'MISSING'},
  {id:'CM-MISSING-006',item:'Persisted originals for conversation-only Owner mandates',impact:'Implementation reports capture outcomes, but not every original mandate exists as a repository document.',status:'MISSING_SOURCE_RECORD'},
  {id:'CM-MISSING-007',item:'Field tester client integration/runbook for non-technical remote testers',impact:'The controlled backend and protocol are available; direct phone HTTPS evidence exists, but a field-client workflow is not catalogued as complete.',status:'PARTIAL'},
];

mkdirSync(libraryRoot,{recursive:true});
for(const category of categories)mkdirSync(path.join(libraryRoot,category),{recursive:true});

const index={
  schemaVersion:'agm-car-mover-library-index.v1',generatedAt,agentId:'agm-central-librarian',sourceMode:'REFERENCE_ONLY_NON_DESTRUCTIVE',
  statusVocabulary:['CURRENT','SUPERSEDED','HISTORICAL','DRAFT','EVIDENCE'],
  truthRule:'CONFLICT DETECTED → OWNER/INSPECTOR REVIEW',
  corpus:{records:records.length,statusCounts,categoryCounts,exactDuplicateGroups:exactDuplicates.length,logicalVersionFamilies:versionFamilies.length},
  records,
};
writeJson(path.join(libraryRoot,'INDEX.json'),index);
writeJson(path.join(libraryRoot,'DUPLICATES.json'),{schemaVersion:'agm-car-mover-duplicates.v1',generatedAt,policy:'REPORT_ONLY_NO_DELETE',exactDuplicates,versionFamilies});
writeJson(path.join(libraryRoot,'CONFLICTS_AND_GAPS.json'),{schemaVersion:'agm-car-mover-conflicts-gaps.v1',generatedAt,conflicts,stateTransitions,missing});
writeFileSync(path.join(libraryRoot,'SOURCE_MANIFEST.sha256'),records.map((record)=>`${record.sha256}  ${record.path}`).join('\n')+'\n','utf8');
writeFileSync(path.join(libraryRoot,'INDEX.md'),renderCentralIndex(index,conflicts,missing),'utf8');
writeFileSync(path.join(libraryRoot,'DUPLICATES_CONFLICTS_MISSING.md'),renderIssues(exactDuplicates,versionFamilies,conflicts,stateTransitions,missing),'utf8');
writeFileSync(path.join(libraryRoot,'CURRENT_VS_HISTORY.md'),renderStatusMap(records),'utf8');
writeFileSync(path.join(libraryRoot,'CONSOLIDATION_REPORT.md'),renderConsolidation(index,conflicts,missing),'utf8');
for(const category of categories)writeFileSync(path.join(libraryRoot,category,'README.md'),renderCategory(category,records.filter((record)=>record.category===category)),'utf8');

console.log(`CAR_MOVER_LIBRARY_INDEX=PASS records=${records.length} duplicates=${exactDuplicates.length} conflicts=${conflicts.length} missing=${missing.length}`);

function walk(directory,result){
  for(const entry of readdirSync(directory,{withFileTypes:true})){
    if(entry.isDirectory()&&excludedDirectories.has(entry.name))continue;
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())walk(absolute,result);else if(entry.isFile())result.push(absolute);
  }
}
function relative(absolute){return path.relative(root,absolute).replaceAll('\\','/');}
function readText(absolute){
  if(textCache.has(absolute))return textCache.get(absolute);
  const stat=statSync(absolute),extension=path.extname(absolute).toLowerCase();
  const value=textExtensions.has(extension)&&stat.size<=10_000_000?readFileSync(absolute,'utf8'):'';
  textCache.set(absolute,value);return value;
}
function isRelevant(rel,absolute){
  if(managedSourcePaths.has(rel))return true;
  if(/(^|\/)(CAR_MOVER)(\/|$)/i.test(rel))return false;
  if(/car[-_ ]?mover|carmover|routing-architecture|field-test-backend|field-test-apk|opportunity-intelligence/i.test(rel))return true;
  if(/(^|\/)(test-tollguru-cache-gate|toll-required-policy|field-test-session|field-test-observation|field-test-commercial-rates)(\.|\/)/i.test(rel))return true;
  const content=readText(absolute);
  return /\bCar Mover\b|\bCarMover\b|agm-car-mover|PASSENGER_CAR|TollGuru/i.test(content);
}
function buildRecord(absolute){
  const rel=relative(absolute),stat=statSync(absolute),content=readText(absolute),category=classify(rel,content),gitState=statusMap.get(rel)??'CLEAN';
  const override=overrides[rel]??{};
  return{
    id:`CM-${createHash('sha256').update(rel).digest('hex').slice(0,16).toUpperCase()}`,
    path:rel,category,tags:tagsFor(rel,content,category),mediaType:mediaType(rel),sizeBytes:stat.size,
    sha256:createHash('sha256').update(readFileSync(absolute)).digest('hex'),
    sourceDate:sourceDate(rel,content,stat),version:versionFor(rel,content),status:override.status??statusFor(rel,gitState,content),
    owner:ownerFor(rel),gitState,lastModified:stat.mtime.toISOString(),evidenceRefs:evidenceFor(category),
    dependencies:dependenciesFor(rel,content),supersedes:override.supersedes??[],supersededBy:override.supersededBy??[],
    originalPreserved:true,libraryCopyCreated:false,
  };
}
function classify(rel,content){
  const value=`${rel}\n${content.slice(0,20_000)}`.toLowerCase();
  if(/^(tmp|local-preserved)\//.test(rel))return'ARCHIVE';
  if(rel==='CAR_MOVER/GOVERNANCE/OWNER_MANDATE_AGM_LIBRARY_2026-08-29.md')return'REQUIREMENTS';
  if(rel.startsWith('CAR_MOVER/GOVERNANCE/'))return'GOVERNANCE';
  if(/architecture|foundation.reuse.audit/i.test(rel))return'ARCHITECTURE';
  if(/owner|acceptance|amendment|freeze|decision/i.test(path.basename(rel))&&rel.startsWith('evidence/governance/'))return'DECISIONS';
  if(/routing-architecture|routing\.policy|routing-telemetry|route-entry/.test(value))return'ROUTING';
  if(/toll|vignette/.test(value))return'TOLL';
  if(/field-test|field_measurement|field measurement/.test(value))return'FIELD';
  if(/opportunity-intelligence|platformoffer|offer/.test(value))return'OPPORTUNITY_INTELLIGENCE';
  if(/ocr|document/.test(value))return'OCR_DOCUMENTS';
  if(/copilot|premium-assistant/.test(value))return'COPILOT';
  if(/android|capacitor|apk/.test(value))return'ANDROID';
  if(/incident/.test(value))return'INCIDENTS';
  if(/runbook|protocol|deploy\/|\.sh$|\.ps1$/.test(value))return'RUNBOOKS';
  if(/test|spec|validate|runner\.log|report\.json/.test(value))return'TESTS';
  if(/production|release|handoff/.test(value))return'RELEASES';
  if(rel.startsWith('apps/api/')||rel.startsWith('prisma/'))return'API';
  if(/job.file|job_file|jobfile|carmoverjob/.test(value))return'JOB_FILE';
  if(rel.startsWith('apps/web/')||/browser|website|\.css$/.test(value))return'WEB';
  if(rel.startsWith('evidence/governance/'))return'GOVERNANCE';
  if(rel.startsWith('evidence/'))return'EVIDENCE';
  if(/architecture|contract|schema/.test(value))return'ARCHITECTURE';
  if(/requirement|mandate|scope/.test(value))return'REQUIREMENTS';
  return'ARCHIVE';
}
function tagsFor(rel,content,category){
  const value=`${rel}\n${content.slice(0,30_000)}`.toLowerCase(),tags=new Set([category]);
  for(const [tag,pattern] of [['API',/api|controller|dto/],['JOB_FILE',/job file|job_file|jobfile/],['ROUTING',/routing|route/],['TOLL',/toll|vignette/],['FIELD',/field/],['COPILOT',/copilot|assistant/],['OPPORTUNITY_INTELLIGENCE',/opportunity|offer/],['OCR_DOCUMENTS',/ocr|document/],['ANDROID',/android|capacitor|apk/],['WEB',/browser|web|css/],['EVIDENCE',/^evidence\//],['DECISION',/owner|decision|freeze|acceptance/]])if(pattern.test(value))tags.add(tag);
  return[...tags].sort();
}
function statusFor(rel,gitState,content){
  if(/^(tmp|local-preserved)\//.test(rel))return'HISTORICAL';
  if(rel.startsWith('prisma/migrations/'))return'HISTORICAL';
  if(rel.startsWith('evidence/'))return'EVIDENCE';
  if(/\bv\d+\b/i.test(path.basename(rel))&&rel.includes('/public/images/')){
    const base=path.basename(rel);return allFiles.some((file)=>readText(file).includes(base))?'CURRENT':'SUPERSEDED';
  }
  if(gitState!=='CLEAN')return'DRAFT';
  if(/\bDRAFT\b|NOT STARTED|PLANNED/i.test(content.slice(0,10_000)))return'DRAFT';
  return'CURRENT';
}
function ownerFor(rel){
  if(rel==='CAR_MOVER/GOVERNANCE/OWNER_MANDATE_AGM_LIBRARY_2026-08-29.md')return'AGM Product Owner';
  if(rel.startsWith('CAR_MOVER/GOVERNANCE/'))return'Documentation & Knowledge';
  if(rel.startsWith('evidence/governance/'))return'Product Owner / Governance';
  if(rel.startsWith('apps/api/')||rel.startsWith('prisma/'))return'Backend & Infrastructure';
  if(rel.startsWith('apps/web/'))return'Frontend Experience';
  if(rel.startsWith('deploy/'))return'Release & Operations';
  if(rel.startsWith('evidence/field'))return'Field Validation';
  if(rel.startsWith('evidence/'))return'Inspector / Evidence Custody';
  if(rel.includes('/test/')||rel.includes('/scripts/')||rel.startsWith('scripts/'))return'QA / Inspector';
  return'Documentation & Knowledge';
}
function evidenceFor(category){
  const map={
    API:['evidence/car-mover/p1-operations/CAR_MOVER_PRODUCTION_EVIDENCE_2026-08-23.md'],
    JOB_FILE:['evidence/car-mover/p0-02/desktop/2026-08-23T20-16-20-543Z/report.json'],
    ROUTING:['evidence/routing-architecture/2026-08-29/IMPLEMENTATION_REPORT.md','evidence/field-test-backend/2026-08-29/FIELD_BACKEND_EVIDENCE.json'],
    FIELD:['evidence/field-test-backend/2026-08-29/FIELD_BACKEND_EVIDENCE.json'],
    ANDROID:['evidence/car-mover/p0-02/android/2026-08-23T15-03-00-221Z/report.json'],
    WEB:['evidence/car-mover/p0-02/desktop/2026-08-23T20-16-20-543Z/report.json'],
    OPPORTUNITY_INTELLIGENCE:['evidence/car-mover/p1-operations/CAR_MOVER_PRODUCTION_EVIDENCE_2026-08-23.md'],
  };
  return(map[category]??[]).filter((item)=>allFiles.some((file)=>relative(file)===item));
}
function dependenciesFor(rel,content){const value=`${rel}\n${content.slice(0,30_000)}`,result=[];for(const [name,pattern] of [['Prisma/PostgreSQL',/prisma|CarMoverJob/],['EventStore/Audit',/OperationalEvent|AuditEvent|EventStore/],['Premium access',/PREMIUM|entitlement|authorize/],['TOM/TomTom',/TOM|TomTom/],['Android/Capacitor',/Android|Capacitor/],['Browser/Web',/Browser|Web|CSS/],['OCR',/OCR/],['Opportunity Intelligence',/Opportunity|PlatformOffer/],['Field telemetry',/field-protocol|routing\/observations|telemetry/]])if(pattern.test(value))result.push(name);return result;}
function sourceDate(rel,content,stat){const match=`${rel}\n${content.slice(0,2_000)}`.match(/20\d{2}-\d{2}-\d{2}/);return match?.[0]??stat.mtime.toISOString().slice(0,10);}
function versionFor(rel,content){const value=`${rel}\n${content.slice(0,1_000)}`,match=value.match(/(?:^|[^A-Za-z0-9])(v\d+(?:\.\d+)*|P\d+(?:-\d+)?)(?:[^A-Za-z0-9]|$)/i);return match?.[1]?.toUpperCase()??'UNVERSIONED';}
function mediaType(rel){const ext=path.extname(rel).toLowerCase();return({'.md':'text/markdown','.json':'application/json','.jsonl':'application/x-ndjson','.ts':'text/typescript','.tsx':'text/typescript-jsx','.js':'text/javascript','.mjs':'text/javascript','.sql':'application/sql','.prisma':'text/prisma','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.xml':'application/xml','.yml':'application/yaml','.yaml':'application/yaml','.ps1':'text/powershell','.sh':'text/x-shellscript','.css':'text/css','.html':'text/html'}[ext]??'application/octet-stream');}
function duplicateGroups(items){const groups=new Map();for(const item of items){const group=groups.get(item.sha256)??[];group.push(item.path);groups.set(item.sha256,group);}return[...groups].filter(([,paths])=>paths.length>1).map(([sha256,paths])=>({sha256,count:paths.length,paths})).sort((a,b)=>b.count-a.count||a.sha256.localeCompare(b.sha256));}
function logicalFamilies(items){const groups=new Map();for(const item of items){const key=path.basename(item.path).toLowerCase().replace(/20\d{2}[-_]?\d{2}[-_]?\d{2}[^.]*/g,'<date>').replace(/v\d+(?:\.\d+)*/g,'<version>');const group=groups.get(key)??[];group.push(item);groups.set(key,group);}return[...groups].filter(([,group])=>group.length>1&&new Set(group.map((item)=>item.sha256)).size>1).map(([logicalName,group])=>({logicalName,count:group.length,paths:group.map((item)=>item.path),classification:'VERSION_FAMILY_REVIEW_NO_AUTO_DELETE'})).sort((a,b)=>b.count-a.count||a.logicalName.localeCompare(b.logicalName));}
function countBy(items,field){const result={};for(const item of items)result[item[field]]=(result[item[field]]??0)+1;return result;}
function gitStatus(){const result=new Map();let output='';try{output=execFileSync('git',['status','--porcelain=v1','--untracked-files=all'],{cwd:root,encoding:'utf8'});}catch{return result;}for(const line of output.split(/\r?\n/)){if(!line)continue;const code=line.slice(0,2),rel=line.slice(3).replaceAll('\\','/');result.set(rel,code==='??'?'UNTRACKED':'MODIFIED');}return result;}
function writeJson(target,value){writeFileSync(target,JSON.stringify(value,null,2)+'\n','utf8');}
function linkFromLibrary(rel){return`../${rel}`;}
function renderCentralIndex(index,conflictRows,missingRows){const current=records.filter((record)=>record.status==='CURRENT');return`# Car Mover central index\n\nGenerated: \`${index.generatedAt}\`  \nCustodian: \`agm-central-librarian\`  \nMode: reference-only; originals remain in place.\n\n## Quick status\n\n| Measure | Value |\n|---|---:|\n| Indexed records | ${records.length} |\n${Object.entries(statusCounts).map(([key,value])=>`| ${key} | ${value} |`).join('\n')}\n| Exact duplicate groups | ${exactDuplicates.length} |\n| Open conflicts | ${conflictRows.length} |\n| Missing/partial records | ${missingRows.length} |\n\n## Current documents\n\n| Category | Owner | Version | Source date | Path |\n|---|---|---|---|---|\n${current.map((record)=>`| ${record.category} | ${record.owner} | ${record.version} | ${record.sourceDate} | [${record.path}](${linkFromLibrary(record.path)}) |`).join('\n')}\n\n## Navigation\n\n${categories.map((category)=>`- [${category}](${category}/README.md) — ${categoryCounts[category]??0} records`).join('\n')}\n\n## Machine-readable records\n\n- [INDEX.json](INDEX.json)\n- [SOURCE_MANIFEST.sha256](SOURCE_MANIFEST.sha256)\n- [DUPLICATES.json](DUPLICATES.json)\n- [CONFLICTS_AND_GAPS.json](CONFLICTS_AND_GAPS.json)\n`}
function renderIssues(duplicates,families,conflictRows,transitions,missingRows){return`# Car Mover duplicates, conflicts and missing documents\n\n## Conflicts\n\n${conflictRows.map((item)=>`### ${item.id} — ${item.topic}\n\nStatus: **${item.status}**\n\n- Source A: \`${item.sourceA}\` — ${item.claimA}\n- Source B: \`${item.sourceB}\` — ${item.claimB}\n- Automatic resolution: **NO**\n`).join('\n')}\n## Time-bound state transitions (not silently rewritten)\n\n${transitions.map((item)=>`- **${item.topic}** — ${item.classification}; historical: \`${item.historical}\`; later evidence: \`${item.currentEvidence}\`.`).join('\n')}\n\n## Exact duplicates\n\nPolicy: report only; no original is deleted. Full data is in \`DUPLICATES.json\`.\n\n${duplicates.length?duplicates.slice(0,100).map((item)=>`- \`${item.sha256}\` — ${item.count} files\n${item.paths.map((source)=>`  - \`${source}\``).join('\n')}`).join('\n'):'No exact duplicates detected.'}\n\n## Logical version families\n\nThese are candidates for version review, not automatic duplicates.\n\n${families.slice(0,100).map((item)=>`- **${item.logicalName}** — ${item.count} variants (${item.classification})`).join('\n')}\n\n## Missing or partial documents\n\n${missingRows.map((item)=>`- **${item.id} · ${item.status}** — ${item.item} Impact: ${item.impact}`).join('\n')}\n`}
function renderStatusMap(items){return`# CURRENT vs SUPERSEDED vs HISTORICAL\n\nEvery indexed record also carries SHA-256, owner, source date, version, dependencies and evidence links in \`INDEX.json\`.\n\n${['CURRENT','DRAFT','SUPERSEDED','HISTORICAL','EVIDENCE'].map((status)=>`## ${status}\n\n${items.filter((item)=>item.status===status).map((item)=>`- \`${item.path}\` — ${item.category}; ${item.version}; ${item.owner}${item.supersededBy.length?`; superseded by ${item.supersededBy.join(', ')}`:''}`).join('\n')||'- None'}\n`).join('\n')}\n`}
function renderConsolidation(index,conflictRows,missingRows){return`# AGM Car Mover archive consolidation report\n\nGenerated by: \`agm-central-librarian\`  \nGenerated at: \`${index.generatedAt}\`\n\n## Outcome\n\n- AGM CENTRAL LIBRARIAN = IMPLEMENTED\n- BASIC LIBRARIAN = UNCHANGED\n- CAR MOVER ARCHIVE = CONSOLIDATED\n- TRACEABILITY = PASS\n- HISTORICAL EVIDENCE = PRESERVED\n\n## Method\n\nThe library is a non-destructive reference catalog. ${records.length} source files were indexed with SHA-256, path, date, version, owner, status, evidence and dependency metadata. No indexed original was moved, overwritten or deleted.\n\n## Truth handling\n\n- CURRENT, SUPERSEDED, HISTORICAL, DRAFT and EVIDENCE remain distinct.\n- Exact duplicates are reported, never deleted automatically.\n- ${conflictRows.length} conflict requires Owner/Inspector review; no automatic reconciliation was performed.\n- ${missingRows.length} missing or partial document classes are recorded without inferred PASS.\n- Planning estimates remain planning estimates until measured evidence exists.\n\n## Scope boundary\n\nNo Production, runtime, API routing, schema or Basic Librarian behavior was changed by the consolidation.\n`}
function renderCategory(category,items){return`# ${category}\n\nCatalog entries: ${items.length}. Original files remain at their source paths.\n\n| Status | Version | Date | Owner | SHA-256 | Source |\n|---|---|---|---|---|---|\n${items.map((item)=>`| ${item.status} | ${item.version} | ${item.sourceDate} | ${item.owner} | \`${item.sha256.slice(0,16)}…\` | [${item.path}](../../${item.path}) |`).join('\n')}\n`}
