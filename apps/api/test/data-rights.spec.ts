import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataRightsService } from '../src/data-rights/data-rights.service';
import { mkdtemp,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('DataRightsService end-to-end workflow',()=>{
  const ctx={userId:'11111111-1111-1111-1111-111111111111',companyId:'22222222-2222-2222-2222-222222222222',roles:['USER'],requestId:'r',correlationId:'c'};
  const empty=()=>jest.fn().mockResolvedValue([]);
  function base(overrides:any={}){
    const request={findFirst:jest.fn().mockResolvedValue(null),findMany:empty(),create:jest.fn().mockResolvedValue({id:'request-1'}),update:jest.fn().mockResolvedValue({})};
    return {dataSubjectRequest:request,user:{findFirst:jest.fn().mockResolvedValue({id:ctx.userId}),update:jest.fn()},authSession:{findMany:empty(),updateMany:jest.fn(),deleteMany:jest.fn()},preDepartureSession:{findMany:empty()},incidentReport:{findMany:empty()},communicationMessage:{findMany:empty(),updateMany:jest.fn()},transportJob:{findMany:empty()},transportJobStateHistory:{findMany:empty()},financialLedger:{findMany:empty()},evidenceMetadata:{findMany:empty(),updateMany:jest.fn()},operationalEventStream:{findMany:empty()},operationalEvent:{findMany:empty()},carMoverJob:{findMany:empty()},auditEvent:{findMany:empty()},userRole:{deleteMany:jest.fn()},$transaction:jest.fn(async(fn:any)=>fn(overrides.tx??{authSession:{deleteMany:jest.fn()},userRole:{deleteMany:jest.fn()},communicationMessage:{updateMany:jest.fn()},evidenceMetadata:{updateMany:jest.fn()},user:{update:jest.fn()},dataSubjectRequest:{update:jest.fn()}})),...overrides};
  }

  it('executes access/export with an exhaustive subject manifest and proof hash',async()=>{
    const prisma:any=base();const result=await new DataRightsService(prisma).exportSelf(ctx);
    expect(result.schemaVersion).toBe('agm-data-export.v2');
    expect(Object.keys(result.data)).toEqual(expect.arrayContaining(['sessions','communications','transportStateActions','financialEntries','evidenceUploaded','operationalStreams','operationalEvents','auditEvents']));
    expect(prisma.dataSubjectRequest.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'COMPLETED',exportSha256:expect.stringMatching(/^[a-f0-9]{64}$/)})}));
  });

  it('returns not found and journals failure for a missing subject',async()=>{
    const prisma:any=base();prisma.user.findFirst.mockResolvedValue(null);
    await expect(new DataRightsService(prisma).exportSelf(ctx)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.dataSubjectRequest.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'FAILED'})}));
  });

  it('rejects a duplicate active request',async()=>{
    const prisma:any=base();prisma.dataSubjectRequest.findFirst.mockResolvedValue({id:'active'});
    await expect(new DataRightsService(prisma).exportSelf(ctx)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.dataSubjectRequest.create).not.toHaveBeenCalled();
  });

  it('rectifies only supported profile fields and logs field names, not values',async()=>{
    const prisma:any=base();const result=await new DataRightsService(prisma).rectifySelf(ctx,{displayName:'Updated',phoneNumber:null});
    expect(result.changedFields).toEqual(['displayName','phoneNumber']);
    expect(prisma.dataSubjectRequest.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({metadata:{changedFields:['displayName','phoneNumber'],auditContent:'FIELD_NAMES_ONLY'}})}));
  });

  it('restricts processing and revokes active sessions',async()=>{
    const prisma:any=base();const result=await new DataRightsService(prisma).restrictSelf(ctx,'accuracy dispute');
    expect(result.status).toBe('RESTRICTED');expect(prisma.authSession.updateMany).toHaveBeenCalled();expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({personalDataStatus:'ProcessingRestricted'})}));
  });

  it('does not anonymize records subject to a legal hold',async()=>{
    const prisma:any=base();prisma.user.findFirst.mockResolvedValue({id:ctx.userId,legalRetentionReason:'statutory',retentionUntil:null});
    const result=await new DataRightsService(prisma).deleteSelf(ctx);
    expect(result.status).toBe('RESTRICTED');expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes/anonymizes direct and linked content in one transaction',async()=>{
    const tx={authSession:{deleteMany:jest.fn()},userRole:{deleteMany:jest.fn()},communicationMessage:{updateMany:jest.fn()},evidenceMetadata:{updateMany:jest.fn()},user:{update:jest.fn()},dataSubjectRequest:{update:jest.fn()}};
    const prisma:any=base({tx});await expect(new DataRightsService(prisma).deleteSelf(ctx)).resolves.toEqual(expect.objectContaining({status:'COMPLETED'}));
    expect(tx.communicationMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({bodyText:'[deleted]'})}));expect(tx.evidenceMetadata.updateMany).toHaveBeenCalled();
  });

  it('writes PREPARED and APPLIED pseudonymized ledger events when the gate is required',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'agm-dsar-service-ledger-'));process.env.DSAR_SUPPRESSION_LEDGER_REQUIRED='true';process.env.DSAR_SUPPRESSION_LEDGER_PATH=join(dir,'ledger.jsonl');process.env.DSAR_SUPPRESSION_LEDGER_KEY=Buffer.alloc(32,9).toString('base64');
    try{const prisma:any=base();await new DataRightsService(prisma).deleteSelf(ctx);const lines=(await readFile(process.env.DSAR_SUPPRESSION_LEDGER_PATH,'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));expect(lines.map((row:any)=>row.status)).toEqual(['PREPARED','APPLIED']);expect(JSON.stringify(lines)).not.toContain(ctx.userId);expect(JSON.stringify(lines)).not.toContain(ctx.companyId);}finally{delete process.env.DSAR_SUPPRESSION_LEDGER_REQUIRED;delete process.env.DSAR_SUPPRESSION_LEDGER_PATH;delete process.env.DSAR_SUPPRESSION_LEDGER_KEY;}
  });

  it('records a retryable partial failure and resumes an authorized failed deletion',async()=>{
    const failingTx=jest.fn().mockRejectedValueOnce(new Error('DB_PARTIAL_FAILURE'));
    const prisma:any=base({$transaction:failingTx});
    await expect(new DataRightsService(prisma).deleteSelf(ctx)).rejects.toThrow('DB_PARTIAL_FAILURE');
    expect(prisma.dataSubjectRequest.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'FAILED'})}));
    const tx={authSession:{deleteMany:jest.fn()},userRole:{deleteMany:jest.fn()},communicationMessage:{updateMany:jest.fn()},evidenceMetadata:{updateMany:jest.fn()},user:{update:jest.fn()},dataSubjectRequest:{update:jest.fn()}};
    prisma.$transaction=jest.fn(async(fn:any)=>fn(tx));prisma.dataSubjectRequest.findFirst.mockResolvedValue({id:'request-1',metadata:{completedSteps:[]}});
    await expect(new DataRightsService(prisma).retryDelete(ctx,'request-1')).resolves.toEqual(expect.objectContaining({status:'COMPLETED'}));
  });
});
