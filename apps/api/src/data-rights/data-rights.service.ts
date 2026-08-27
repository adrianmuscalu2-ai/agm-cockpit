import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { appendLedgerRecord, ledgerKey, subjectPseudonym, type SuppressionAction } from './suppression-ledger';

const EXPORT_VERSION = 'agm-data-export.v2';
type RightType = 'ACCESS_EXPORT'|'RECTIFICATION'|'DELETE_ACCOUNT'|'RESTRICTION'|'OBJECTION'|'PORTABILITY';

@Injectable()
export class DataRightsService {
  constructor(private readonly prisma: PrismaService) {}

  private async suppressionLedger(ctx:RequestContext,action:SuppressionAction,status:'PREPARED'|'APPLIED',requestId:string){
    if(process.env.DSAR_SUPPRESSION_LEDGER_REQUIRED!=='true')return;
    const path=process.env.DSAR_SUPPRESSION_LEDGER_PATH;if(!path)throw new Error('SUPPRESSION_LEDGER_PATH_MISSING');const key=ledgerKey(process.env.DSAR_SUPPRESSION_LEDGER_KEY);
    await appendLedgerRecord(path,key,{subjectPseudonym:subjectPseudonym(ctx.companyId,ctx.userId,key),action,effectiveAt:new Date().toISOString(),categories:['ACCOUNT','AUTH','COMMUNICATIONS','EVIDENCE','RELATIONAL','JSON','AUDIT','OPERATIONAL'],status,applicationEvidence:createHash('sha256').update(requestId).digest('hex')});
  }

  private dueAt(from = new Date()) { const value=new Date(from); value.setUTCMonth(value.getUTCMonth()+1); return value.toISOString(); }
  private async start(ctx:RequestContext,type:RightType) {
    const duplicate=await this.prisma.dataSubjectRequest.findFirst({where:{companyId:ctx.companyId,requestedByUserId:ctx.userId,requestType:type,status:{in:['RECEIVED','PROCESSING','RETRYING']}}});
    if(duplicate) throw new ConflictException('DSAR_DUPLICATE_ACTIVE_REQUEST');
    return this.prisma.dataSubjectRequest.create({data:{companyId:ctx.companyId,requestedByUserId:ctx.userId,requestType:type,status:'PROCESSING',metadata:{dueAt:this.dueAt(),identityVerification:'AUTHENTICATED_ACCOUNT_SESSION',auditContent:'STATUS_AND_COUNTS_ONLY'}}});
  }
  private async fail(id:string,error:unknown,completedSteps:string[]) {
    await this.prisma.dataSubjectRequest.update({where:{id},data:{status:'FAILED',metadata:{retryable:true,completedSteps,errorCode:error instanceof Error?error.message:'DSAR_OPERATION_FAILED',auditContent:'NO_REQUEST_PAYLOAD'}}});
  }

  async listSelf(ctx:RequestContext){return this.prisma.dataSubjectRequest.findMany({where:{companyId:ctx.companyId,requestedByUserId:ctx.userId},select:{id:true,requestType:true,status:true,requestedAt:true,completedAt:true,refusalReason:true,exportSchemaVersion:true,exportSha256:true,metadata:true},orderBy:{requestedAt:'desc'}});}

  async exportSelf(ctx: RequestContext) {
    const request=await this.start(ctx,'ACCESS_EXPORT');
    try {
      const [user,sessions,preDeparture,incidentsReported,communications,transportsCreated,transportStateActions,financialEntries,evidenceUploaded,operationalStreams,operationalEvents,carMoverCreated,carMoverAssigned,auditEvents]=await Promise.all([
        this.prisma.user.findFirst({where:{id:ctx.userId,companyId:ctx.companyId},select:{id:true,companyId:true,displayName:true,email:true,phoneNumber:true,status:true,personalDataStatus:true,createdAt:true,updatedAt:true,lastLoginAt:true,roles:{select:{assignedAt:true,role:{select:{code:true,displayName:true}}}}}}),
        this.prisma.authSession.findMany({where:{userId:ctx.userId,companyId:ctx.companyId},select:{id:true,familyId:true,generation:true,expiresAt:true,revokedAt:true,replacedAt:true,reuseDetectedAt:true,lastUsedAt:true,createdAt:true}}),
        this.prisma.preDepartureSession.findMany({where:{driverUserId:ctx.userId,companyId:ctx.companyId},include:{answers:true}}),
        this.prisma.incidentReport.findMany({where:{companyId:ctx.companyId,OR:[{reportedByUserId:ctx.userId},{resolvedByUserId:ctx.userId}]}}),
        this.prisma.communicationMessage.findMany({where:{createdByUserId:ctx.userId,companyId:ctx.companyId}}),
        this.prisma.transportJob.findMany({where:{companyId:ctx.companyId,OR:[{createdByUserId:ctx.userId},{updatedByUserId:ctx.userId}]}}),
        this.prisma.transportJobStateHistory.findMany({where:{companyId:ctx.companyId,OR:[{transitionedByUserId:ctx.userId},{approvedByUserId:ctx.userId}]}}),
        this.prisma.financialLedger.findMany({where:{companyId:ctx.companyId,recordedByUserId:ctx.userId}}),
        this.prisma.evidenceMetadata.findMany({where:{companyId:ctx.companyId,uploadedByUserId:ctx.userId}}),
        this.prisma.operationalEventStream.findMany({where:{companyId:ctx.companyId,subjectId:ctx.userId}}),
        this.prisma.operationalEvent.findMany({where:{companyId:ctx.companyId,subjectId:ctx.userId}}),
        this.prisma.carMoverJob.findMany({where:{createdByUserId:ctx.userId,companyId:ctx.companyId},include:{vehicleSubject:true}}),
        this.prisma.carMoverJob.findMany({where:{assignedDriverUserId:ctx.userId,companyId:ctx.companyId},include:{vehicleSubject:true}}),
        this.prisma.auditEvent.findMany({where:{companyId:ctx.companyId,OR:[{actorUserId:ctx.userId},{subjectId:ctx.userId}]}}),
      ]);
      if(!user) throw new NotFoundException('DATA_SUBJECT_NOT_FOUND');
      const data={sessions,preDeparture,incidentsReported,communications,transportsCreated,transportStateActions,financialEntries,evidenceUploaded,operationalStreams,operationalEvents,carMoverCreated,carMoverAssigned,auditEvents};
      const payload={schemaVersion:EXPORT_VERSION,requestId:request.id,generatedAt:new Date().toISOString(),subject:user,data};
      const exportSha256=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const recordCounts=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,value.length]));
      await this.prisma.dataSubjectRequest.update({where:{id:request.id},data:{status:'COMPLETED',completedAt:new Date(),exportSchemaVersion:EXPORT_VERSION,exportSha256,metadata:{recordCounts,dueAt:this.dueAt(),identityVerification:'AUTHENTICATED_ACCOUNT_SESSION',auditContent:'STATUS_HASH_AND_COUNTS_ONLY'}}});
      return payload;
    }catch(error){await this.fail(request.id,error,[]);throw error;}
  }

  async rectifySelf(ctx:RequestContext,input:{displayName?:string;phoneNumber?:string|null}){
    const request=await this.start(ctx,'RECTIFICATION');
    const data:{displayName?:string;phoneNumber?:string|null}={};
    if(typeof input.displayName==='string'){const value=input.displayName.trim();if(!value||value.length>160)throw new ConflictException('RECTIFICATION_DISPLAY_NAME_INVALID');data.displayName=value;}
    if(input.phoneNumber===null)data.phoneNumber=null;else if(typeof input.phoneNumber==='string'){const value=input.phoneNumber.trim();if(value.length>40)throw new ConflictException('RECTIFICATION_PHONE_INVALID');data.phoneNumber=value||null;}
    if(!Object.keys(data).length)throw new ConflictException('RECTIFICATION_NO_SUPPORTED_FIELDS');
    try{await this.prisma.user.update({where:{id:ctx.userId},data});await this.prisma.dataSubjectRequest.update({where:{id:request.id},data:{status:'COMPLETED',completedAt:new Date(),metadata:{changedFields:Object.keys(data),auditContent:'FIELD_NAMES_ONLY'}}});return{requestId:request.id,status:'COMPLETED',changedFields:Object.keys(data)};}catch(error){await this.fail(request.id,error,[]);throw error;}
  }

  async restrictSelf(ctx:RequestContext,reason:string){return this.setRestriction(ctx,'RESTRICTION',reason);}
  async objectSelf(ctx:RequestContext,reason:string){return this.setRestriction(ctx,'OBJECTION',reason);}
  private async setRestriction(ctx:RequestContext,type:'RESTRICTION'|'OBJECTION',reason:string){
    const request=await this.start(ctx,type);const safeReason=reason.trim();if(!safeReason||safeReason.length>500)throw new ConflictException('DSAR_REASON_INVALID');
    try{await this.suppressionLedger(ctx,'RESTRICT','PREPARED',request.id);await this.prisma.authSession.updateMany({where:{userId:ctx.userId,companyId:ctx.companyId,revokedAt:null},data:{revokedAt:new Date()}});await this.prisma.user.update({where:{id:ctx.userId},data:{status:'Restricted',personalDataStatus:type==='OBJECTION'?'ObjectionPending':'ProcessingRestricted'}});await this.prisma.dataSubjectRequest.update({where:{id:request.id},data:{status:'RESTRICTED',completedAt:new Date(),metadata:{reasonSha256:createHash('sha256').update(safeReason).digest('hex'),auditContent:'REASON_HASH_ONLY'}}});await this.suppressionLedger(ctx,'RESTRICT','APPLIED',request.id);return{requestId:request.id,status:'RESTRICTED'};}catch(error){await this.fail(request.id,error,[]);throw error;}
  }

  async deleteSelf(ctx:RequestContext){const user=await this.prisma.user.findFirst({where:{id:ctx.userId,companyId:ctx.companyId}});if(!user)throw new NotFoundException('DATA_SUBJECT_NOT_FOUND');const request=await this.start(ctx,'DELETE_ACCOUNT');return this.executeDelete(ctx,user,request.id,[]);}
  async retryDelete(ctx:RequestContext,requestId:string){const request=await this.prisma.dataSubjectRequest.findFirst({where:{id:requestId,companyId:ctx.companyId,requestedByUserId:ctx.userId,requestType:'DELETE_ACCOUNT',status:'FAILED'}});if(!request)throw new NotFoundException('DSAR_RETRY_NOT_AVAILABLE');const user=await this.prisma.user.findFirst({where:{id:ctx.userId,companyId:ctx.companyId}});if(!user)throw new NotFoundException('DATA_SUBJECT_NOT_FOUND');const metadata=isRecord(request.metadata)?request.metadata:{};const completedSteps=Array.isArray(metadata.completedSteps)?metadata.completedSteps.filter((value):value is string=>typeof value==='string'):[];await this.prisma.dataSubjectRequest.update({where:{id:requestId},data:{status:'RETRYING'}});return this.executeDelete(ctx,user,requestId,completedSteps);}
  private async executeDelete(ctx:RequestContext,user:User,requestId:string,completedSteps:string[]){
    if(user.legalRetentionReason||(user.retentionUntil&&user.retentionUntil>new Date())){await this.suppressionLedger(ctx,'PARTIAL_LEGAL_RESTRICTION','PREPARED',requestId);await this.prisma.dataSubjectRequest.update({where:{id:requestId},data:{status:'RESTRICTED',refusalReason:'LEGAL_RETENTION_ACTIVE',completedAt:new Date(),metadata:{legalRetention:true,auditContent:'NO_PERSONAL_CONTENT'}}});await this.prisma.authSession.updateMany({where:{userId:ctx.userId,companyId:ctx.companyId,revokedAt:null},data:{revokedAt:new Date()}});await this.prisma.user.update({where:{id:ctx.userId},data:{status:'Restricted',personalDataStatus:'DeletionRestricted'}});await this.suppressionLedger(ctx,'PARTIAL_LEGAL_RESTRICTION','APPLIED',requestId);return{requestId,status:'RESTRICTED',reason:'LEGAL_RETENTION_ACTIVE'};}
    const anonymous=`deleted-${randomUUID()}@deleted.invalid`;
    try{await this.suppressionLedger(ctx,'DELETE','PREPARED',requestId);
      await this.prisma.$transaction(async(tx:Prisma.TransactionClient)=>{
        await tx.authSession.deleteMany({where:{userId:ctx.userId,companyId:ctx.companyId}});
        await tx.userRole.deleteMany({where:{userId:ctx.userId,companyId:ctx.companyId}});
        await tx.communicationMessage.updateMany({where:{createdByUserId:ctx.userId,companyId:ctx.companyId},data:{fromAddress:anonymous,toAddress:anonymous,subject:null,bodyText:'[deleted]',createdByUserId:null,metadata:{anonymized:true}}});
        await tx.evidenceMetadata.updateMany({where:{uploadedByUserId:ctx.userId,companyId:ctx.companyId},data:{originalFileName:null,description:null,metadata:{anonymized:true}}});
        await tx.user.update({where:{id:ctx.userId},data:{displayName:'Deleted user',email:anonymous,phoneNumber:null,passwordHash:'ACCOUNT_DELETED',status:'Deleted',personalDataStatus:'Anonymized',anonymizedAt:new Date(),lastLoginAt:null}});
        await tx.dataSubjectRequest.update({where:{id:requestId},data:{status:'COMPLETED',completedAt:new Date(),metadata:{method:'DIRECT_IDENTIFIERS_AND_LINKED_CONTENT_ANONYMIZED',completedSteps:['sessions','roles','communications','evidenceMetadata','user'],auditContent:'STATUS_AND_STEP_NAMES_ONLY'}}});
      });
      await this.suppressionLedger(ctx,'DELETE','APPLIED',requestId);return{requestId,status:'COMPLETED'};
    }catch(error){await this.fail(requestId,error,completedSteps);throw error;}
  }
}

function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
