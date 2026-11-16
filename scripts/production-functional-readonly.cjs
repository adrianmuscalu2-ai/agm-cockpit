// Administrative read-only evidence. Never authenticates as an application user.
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const out = process.argv[2];
if (!out) throw new Error('Evidence directory required');
mkdirSync(out, { recursive: true });
const source = String.raw`
const {PrismaClient}=require('@prisma/client');
const {createHash}=require('node:crypto');
const p=new PrismaClient();
(async()=>{const data=await p.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 const q=s=>tx.$queryRawUnsafe(s);
 const governance=await q('SELECT * FROM agm_governance.governance_events ORDER BY recorded_at,event_id');
 let previous=null,chainErrors=0,digestErrors=0;
 for(const e of governance){
  if(e.previous_event_id!==(previous?.event_id??null)||e.previous_digest!==(previous?.event_digest??null))chainErrors++;
  const digest=createHash('sha256').update(JSON.stringify({eventId:e.event_id,eventType:e.event_type,entityType:e.entity_type,entityId:e.entity_id,previousDigest:e.previous_digest,payloadDigest:e.payload_digest,correlationId:e.correlation_id,actorId:e.actor_id})).digest('hex');
  if(digest!==e.event_digest)digestErrors++;previous=e;
 }
 return {
 governance:{events:governance.length,chainErrors,digestErrors,payloadsRecertified:false},
 versions:await q('SELECT id,commit_sha,status FROM agm_governance.version_records ORDER BY id'),
 journalCounts:await q('SELECT (SELECT count(*)::int FROM agm_governance.production_change_records) AS pcr,(SELECT count(*)::int FROM agm_governance.risk_knowledge_assessments) AS rk,(SELECT count(*)::int FROM "IncidentReport") AS incidents,(SELECT count(*)::int FROM "EvidenceMetadata") AS evidence'),
 target:await q('SELECT current_database() AS database'),
 runtimeProducers:await q('SELECT "agentId",count(*)::int AS count FROM "AgentRuntimeEvent" WHERE "recordedAt">now()-interval \'2 hours\' GROUP BY 1 ORDER BY 2 DESC'),
 counts:await q('SELECT (SELECT count(*)::int FROM "AgentChainPerformanceEvent") AS acpm,(SELECT count(*)::int FROM "AgentRuntimeEvent") AS runtime,(SELECT count(*)::int FROM "OperationalEvent") AS operational,(SELECT count(*)::int FROM "LunaEvaluationReservation") AS reservations,(SELECT count(*)::int FROM "LunaBudgetHandoff") AS handoffs'),
 streams:await q('SELECT count(*)::int AS inconsistent FROM "OperationalEventStream" s WHERE s."currentVersion"<>(SELECT coalesce(max(e."aggregateVersion"),-1) FROM "OperationalEvent" e WHERE e."streamRecordId"=s.id AND e."companyId"=s."companyId")'),
 migrations:await q('SELECT count(*)::int AS total,count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished FROM _prisma_migrations'),
 };
 });console.log(JSON.stringify({at:new Date().toISOString(),mode:'ADMINISTRATIVE_READ_ONLY_NOT_OWNER_E2E',config:{revision:process.env.BUILD_COMMIT||process.env.GIT_SHA||null,provider:process.env.AGMATCC_COPILOT_PROVIDER||'unset',enabled:process.env.AGMATCC_LUNA_PRODUCTION_ENABLED==='true',commanderBound:!!process.env.AGMATCC_LUNA_COMMANDER_FAMILY_SHA256,handoffPinned:!!process.env.AGMATCC_LUNA_HANDOFF_SHA256,targetPinned:!!process.env.AGMATCC_LUNA_PRODUCTION_DB_HOST},...data}));})().catch(e=>{console.error(JSON.stringify({code:e.code,meta:e.meta}));process.exitCode=1}).finally(()=>p.$disconnect());`;
const r=spawnSync('ssh',['-i','C:/Users/adria/.ssh/agm_release_operations_hetzner_ed25519','-o','BatchMode=yes','-o','ConnectTimeout=8','-o','StrictHostKeyChecking=yes','agmops@167.233.237.253','sudo -n docker exec -i agm-production-api node'],{input:source,encoding:'utf8',timeout:60000});
if(r.status!==0) throw new Error(r.stderr || 'Remote read failed');
const parsed=JSON.parse(r.stdout);
writeFileSync(join(out,'production-readonly.json'),JSON.stringify(parsed,null,2));
console.log(JSON.stringify(parsed,null,2));
