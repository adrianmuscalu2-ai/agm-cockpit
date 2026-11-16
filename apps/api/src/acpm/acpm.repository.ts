import type { AcpmEvent } from '@agm/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { legacyAcp } from './acpm.service';

type NativeRow={eventId:string;cursorAt:string;recordedBy:string;payload:AcpmEvent;payloadHash:string};
type LegacyRow=Parameters<typeof legacyAcp>[0]&{cursorAt:string};
/** Keyset pagination uses the existing tenant/eventId unique indexes. A repeatable-read
 * snapshot prevents concurrent appends from moving the boundary during a scan.
 * Every subsequent scan starts from the canonical ledger, including late arrivals.
 * Only the page size is bounded; there is no 10k history cutoff or source mutation. */
export async function readAcpmHistory(prisma:PrismaService,companyId:string,pageSize=1000) {
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const observations:NativeRow[]=[],legacy:LegacyRow[]=[];
    let nativePages=0,legacyPages=0;
    let cursorId='';
    for(;;){
      const rows:NativeRow[]=cursorId
        ? await tx.$queryRaw<NativeRow[]>`SELECT "eventId","recordedAt"::text AS "cursorAt","recordedBy",payload,"payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${companyId}::uuid AND "eventId">${cursorId}::uuid ORDER BY "eventId" LIMIT ${pageSize}`
        : await tx.$queryRaw<NativeRow[]>`SELECT "eventId","recordedAt"::text AS "cursorAt","recordedBy",payload,"payloadHash" FROM "AgentChainPerformanceEvent" WHERE "companyId"=${companyId}::uuid ORDER BY "eventId" LIMIT ${pageSize}`;
      nativePages++;observations.push(...rows);if(rows.length<pageSize)break;
      const last=rows[rows.length-1];if(cursorId===last.eventId)throw Error('ACPM_CURSOR_DID_NOT_ADVANCE');cursorId=last.eventId;
    }
    cursorId='';
    for(;;){
      const rows:LegacyRow[]=cursorId
        ? await tx.$queryRaw<LegacyRow[]>`SELECT "eventId","recordedAt"::text AS "cursorAt","mandateId","agentId","dossierId",lifecycle,sequence,"occurredAt","evidenceRef","evidenceHash" FROM "AgentRuntimeEvent" WHERE "companyId"=${companyId}::uuid AND "eventId">${cursorId}::uuid ORDER BY "eventId" LIMIT ${pageSize}`
        : await tx.$queryRaw<LegacyRow[]>`SELECT "eventId","recordedAt"::text AS "cursorAt","mandateId","agentId","dossierId",lifecycle,sequence,"occurredAt","evidenceRef","evidenceHash" FROM "AgentRuntimeEvent" WHERE "companyId"=${companyId}::uuid ORDER BY "eventId" LIMIT ${pageSize}`;
      legacyPages++;legacy.push(...rows);if(rows.length<pageSize)break;
      const last=rows[rows.length-1];if(cursorId===last.eventId)throw Error('ACPM_CURSOR_DID_NOT_ADVANCE');cursorId=last.eventId;
    }
    // Restore chronological source order after efficient ID-keyset retrieval.
    // PostgreSQL text preserves sub-millisecond precision for ties.
    const order=(a:{cursorAt:string;eventId:string},b:{cursorAt:string;eventId:string})=>Date.parse(a.cursorAt)-Date.parse(b.cursorAt)||(a.cursorAt<b.cursorAt?-1:a.cursorAt>b.cursorAt?1:a.eventId.localeCompare(b.eventId));
    observations.sort(order);legacy.sort(order);
    return {observations,legacy,pagination:{pageSize,nativePages,legacyPages,nativeRows:observations.length,legacyRows:legacy.length,complete:true,snapshotIsolation:'REPEATABLE_READ',order:'recordedAt,eventId ASC',retrieval:'eventId KEYSET via existing unique index',sourceWrites:0}};
  },{isolationLevel:'RepeatableRead',maxWait:10000,timeout:60000});
}
