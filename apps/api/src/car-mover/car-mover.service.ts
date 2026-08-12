import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { CAR_MOVER_SCOPE, canTransitionCarMoverJob, type CarMoverJobFile, type CarMoverState } from './car-mover.contract';
import type { CreateCarMoverJobDto } from './dto/create-car-mover-job.dto';
import type { TransitionCarMoverJobDto } from './dto/transition-car-mover-job.dto';

@Injectable()
export class CarMoverService {
  constructor(private readonly prisma:PrismaService, private readonly audit:AuditService) {}

  async create(dto:CreateCarMoverJobDto, ctx:RequestContext) {
    this.authorize(ctx);
    return this.prisma.$transaction(async tx => {
      const vehicle=await tx.carMoverVehicleSubject.create({data:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,...dto.vehicle,details:dto.vehicle.details as Prisma.InputJsonValue|undefined,createdByUserId:ctx.userId}});
      const job=await tx.carMoverJob.create({data:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,vehicleSubjectId:vehicle.id,pickupSnapshot:dto.pickup as unknown as Prisma.InputJsonValue,destinationSnapshot:dto.destination as unknown as Prisma.InputJsonValue,sourceType:'manual',sourceReference:dto.sourceReference,createdByUserId:ctx.userId}});
      const event=await this.appendEvent(tx,job.id,0,'CAR_MOVER_JOB_CREATED',{vehicleSubjectId:vehicle.id,vehicleClass:vehicle.vehicleClass,vehicleType:vehicle.vehicleType,state:job.currentState},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-job-created',entityType:CAR_MOVER_SCOPE.subjectType,entityId:job.id,reason:'Controlled manual Car Mover job intake.',afterSnapshot:job,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:job.id},ctx,tx);
      return {jobId:job.id,vehicleSubjectId:vehicle.id,state:job.currentState,eventId:event.eventId,auditEventId:audit.id,productId:job.productId};
    });
  }

  async list(ctx:RequestContext) { this.authorize(ctx); return this.prisma.carMoverJob.findMany({where:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId},include:{vehicleSubject:true},orderBy:{updatedAt:'desc'}}); }

  async getJobFile(id:string,ctx:RequestContext):Promise<CarMoverJobFile> {
    this.authorize(ctx);
    const job=await this.prisma.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId},include:{vehicleSubject:true}});
    if(!job)throw new NotFoundException('Car Mover job not found.');
    const [timeline,audits]=await Promise.all([
      this.prisma.operationalEvent.findMany({where:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},orderBy:{aggregateVersion:'asc'}}),
      this.prisma.auditEvent.findMany({where:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},orderBy:{occurredAt:'asc'}}),
    ]);
    return {contractVersion:'car-mover-job-file.v1',productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id,job:job as unknown as Record<string,unknown>,vehicle:job.vehicleSubject as unknown as Record<string,unknown>,timeline:timeline as unknown as Record<string,unknown>[],evidenceReferences:audits.map(item=>item.evidenceMetadataId).filter((value):value is string=>Boolean(value)),auditReferences:audits.map(item=>item.id)};
  }

  async transition(id:string,dto:TransitionCarMoverJobDto,ctx:RequestContext) {
    this.authorize(ctx);
    return this.prisma.$transaction(async tx=>{
      const current=await tx.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});
      if(!current)throw new NotFoundException('Car Mover job not found.');
      if(!canTransitionCarMoverJob(current.currentState as CarMoverState,dto.toState))throw new BadRequestException('Car Mover lifecycle transition denied.');
      if(dto.toState==='ASSIGNED'&&!dto.assignedDriverUserId)throw new BadRequestException('Assigned driver is required.');
      const job=await tx.carMoverJob.update({where:{id},data:{currentState:dto.toState,lifecycleVersion:{increment:1},assignedDriverUserId:dto.assignedDriverUserId??current.assignedDriverUserId}});
      const event=await this.appendEvent(tx,id,job.lifecycleVersion,'CAR_MOVER_JOB_STATE_CHANGED',{from:current.currentState,to:job.currentState,reason:dto.reason??null,assignedDriverUserId:job.assignedDriverUserId},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-job-state-changed',entityType:CAR_MOVER_SCOPE.subjectType,entityId:id,reason:dto.reason??`${current.currentState} -> ${job.currentState}`,beforeSnapshot:current,afterSnapshot:job,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},ctx,tx);
      return {jobId:id,from:current.currentState,to:job.currentState,lifecycleVersion:job.lifecycleVersion,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  private authorize(ctx:RequestContext){if(!ctx.roles.some(role=>(CAR_MOVER_SCOPE.requiredRoles as readonly string[]).includes(role)))throw new ForbiddenException('Car Mover entitlement required.');}

  private async appendEvent(tx:Prisma.TransactionClient,jobId:string,version:number,eventType:string,payload:Record<string,unknown>,ctx:RequestContext){
    const stream=version===0
      ? await tx.operationalEventStream.create({data:{companyId:ctx.companyId,streamId:jobId,aggregateType:CAR_MOVER_SCOPE.subjectType,currentVersion:0,projection:{state:String(payload.state??'DRAFT'),version:0},productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId}})
      : await tx.operationalEventStream.update({where:{companyId_streamId:{companyId:ctx.companyId,streamId:jobId}},data:{currentVersion:version,projection:{state:String(payload.to),version}}});
    const eventId=randomUUID(),operationId=randomUUID(),now=new Date();
    const envelope={schemaVersion:'operational-event.v1',eventId,eventType,eventVersion:1,occurredAt:now.toISOString(),recordedAt:now.toISOString(),aggregateType:CAR_MOVER_SCOPE.subjectType,aggregateId:jobId,aggregateVersion:version,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId,actor:{type:'user',id:ctx.userId},operationId,correlationId:ctx.correlationId,payload};
    return tx.operationalEvent.create({data:{companyId:ctx.companyId,streamRecordId:stream.id,eventId,idempotencyKey:operationId,schemaVersion:'operational-event.v1',eventType,eventVersion:1,aggregateVersion:version,deviceId:ctx.userId,deviceSequence:version+1,operationId,correlationId:ctx.correlationId,occurredAt:now,recordedAt:now,payload:payload as Prisma.InputJsonValue,envelope:envelope as Prisma.InputJsonValue,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId}});
  }
}
