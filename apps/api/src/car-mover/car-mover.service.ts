import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';
import { PilotOperationsService } from '../pilot-operations/pilot-operations.service';
import { CAR_MOVER_SCOPE, canTransitionCarMoverJob, type CarMoverJobFile, type CarMoverState } from './car-mover.contract';
import type { CreateCarMoverJobDto } from './dto/create-car-mover-job.dto';
import type { TransitionCarMoverJobDto } from './dto/transition-car-mover-job.dto';
import type { RecordCarMoverProtocolDto } from './dto/record-car-mover-protocol.dto';
import type { RecordCarMoverFinanceDto } from './dto/record-car-mover-finance.dto';
import type { RecordCarMoverInvoiceDto } from './dto/record-car-mover-invoice.dto';
import type { ReviewCarMoverOfferDto } from './dto/review-car-mover-offer.dto';

@Injectable()
export class CarMoverService {
  constructor(private readonly prisma:PrismaService, private readonly audit:AuditService, @Optional() private readonly pilot?:PilotOperationsService) {}

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
    const [timeline,audits,financialEntries,invoices,communications]=await Promise.all([
      this.prisma.operationalEvent.findMany({where:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},orderBy:{aggregateVersion:'asc'}}),
      this.prisma.auditEvent.findMany({where:{companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},orderBy:{occurredAt:'asc'}}),
      this.prisma.carMoverFinancialEntry.findMany({where:{companyId:ctx.companyId,jobId:id},orderBy:{occurredAt:'asc'}}),
      this.prisma.carMoverInvoice.findMany({where:{companyId:ctx.companyId,jobId:id},orderBy:{issueDate:'asc'}}),
      this.prisma.communicationConversation.findMany({where:{companyId:ctx.companyId,tripId:id},include:{messages:{orderBy:{occurredAt:'asc'}}},orderBy:{lastMessageAt:'asc'}}),
    ]);
    return {contractVersion:'car-mover-job-file.v1',productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id,job:job as unknown as Record<string,unknown>,vehicle:job.vehicleSubject as unknown as Record<string,unknown>,timeline:timeline as unknown as Record<string,unknown>[],evidenceReferences:audits.map(item=>item.evidenceMetadataId).filter((value):value is string=>Boolean(value)),auditReferences:audits.map(item=>item.id),financialEntries:financialEntries as unknown as Record<string,unknown>[],invoices:invoices as unknown as Record<string,unknown>[],communications:communications as unknown as Record<string,unknown>[],analysis:this.financialAnalysis(financialEntries)};
  }

  async recordFinance(id:string,dto:RecordCarMoverFinanceDto,ctx:RequestContext) {
    this.authorize(ctx);
    const requested=new Prisma.Decimal(dto.amount);
    if(requested.isZero())throw new BadRequestException('Financial amount must not be zero.');
    if(dto.entryType!=='REVERSAL'&&requested.isNegative())throw new BadRequestException('Non-reversal financial amount must be positive.');
    if(dto.entryType==='REVERSAL'&&!dto.reversalOfId)throw new BadRequestException('Reversal reference is required.');
    return this.prisma.$transaction(async tx=>{
      const job=await tx.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});
      if(!job)throw new NotFoundException('Car Mover job not found.');
      let amount=requested;
      if(dto.entryType==='REVERSAL'){
        const original=await tx.carMoverFinancialEntry.findFirst({where:{id:dto.reversalOfId,companyId:ctx.companyId,jobId:id}});
        if(!original)throw new BadRequestException('Financial entry selected for reversal was not found.');
        const prior=await tx.carMoverFinancialEntry.findFirst({where:{companyId:ctx.companyId,jobId:id,reversalOfId:original.id}});
        if(prior)throw new BadRequestException('Financial entry was already reversed.');
        amount=new Prisma.Decimal(original.amount).negated();
      }
      const entry=await tx.carMoverFinancialEntry.create({data:{companyId:ctx.companyId,jobId:id,entryType:dto.entryType,category:dto.category.trim(),amount,currencyCode:dto.currencyCode.toUpperCase(),occurredAt:new Date(dto.occurredAt),description:dto.description?.trim(),sourceReference:dto.sourceReference?.trim(),reversalOfId:dto.reversalOfId,createdByUserId:ctx.userId}});
      const version=job.lifecycleVersion+1;
      await tx.carMoverJob.update({where:{id},data:{lifecycleVersion:version}});
      const event=await this.appendEvent(tx,id,version,'CAR_MOVER_FINANCIAL_ENTRY_RECORDED',{entryId:entry.id,entryType:entry.entryType,category:entry.category,amount:entry.amount.toString(),currencyCode:entry.currencyCode,reversalOfId:entry.reversalOfId},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-financial-entry-recorded',entityType:'CarMoverFinancialEntry',entityId:entry.id,reason:'Immutable primary accounting entry recorded.',afterSnapshot:entry,productId:CAR_MOVER_SCOPE.productId,moduleId:'primary-accounting',subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},ctx,tx);
      return {entry,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  async recordInvoice(id:string,dto:RecordCarMoverInvoiceDto,ctx:RequestContext) {
    this.authorize(ctx);
    const amount=new Prisma.Decimal(dto.amount);
    if(!amount.isPositive())throw new BadRequestException('Invoice amount must be positive.');
    return this.prisma.$transaction(async tx=>{
      const job=await tx.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});
      if(!job)throw new NotFoundException('Car Mover job not found.');
      const invoice=await tx.carMoverInvoice.create({data:{companyId:ctx.companyId,jobId:id,direction:dto.direction,invoiceNumber:dto.invoiceNumber.trim(),counterparty:dto.counterparty.trim(),issueDate:new Date(dto.issueDate),dueDate:dto.dueDate?new Date(dto.dueDate):undefined,amount,currencyCode:dto.currencyCode.toUpperCase(),evidenceReference:dto.evidenceReference?.trim(),externalAccountingReference:dto.externalAccountingReference?.trim(),createdByUserId:ctx.userId}});
      const version=job.lifecycleVersion+1;
      await tx.carMoverJob.update({where:{id},data:{lifecycleVersion:version}});
      const event=await this.appendEvent(tx,id,version,'CAR_MOVER_INVOICE_RECORDED',{invoiceId:invoice.id,direction:invoice.direction,invoiceNumber:invoice.invoiceNumber,amount:invoice.amount.toString(),currencyCode:invoice.currencyCode,evidenceReference:invoice.evidenceReference},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-invoice-recorded',entityType:'CarMoverInvoice',entityId:invoice.id,reason:'Primary accounting invoice metadata recorded.',afterSnapshot:invoice,productId:CAR_MOVER_SCOPE.productId,moduleId:'primary-accounting',subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},ctx,tx);
      return {invoice,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  async analyzeInboundOffers(ctx:RequestContext) {
    this.authorize(ctx);
    const pending=await this.prisma.carMoverPlatformOffer.findMany({where:{companyId:ctx.companyId,status:'NEW'},orderBy:{createdAt:'asc'},take:200});
    let reclassified=0;
    for(const offer of pending){
      const source=await this.prisma.communicationMessage.findFirst({where:{id:offer.sourceMessageId,companyId:ctx.companyId}});
      if(!source)continue;
      const current=parsePlatformOffer(`${source.subject??''}\n${source.bodyText}`,source.provider,source.fromAddress);
      if(current.isOffer)continue;
      await this.prisma.$transaction(async tx=>{
        const updated=await tx.carMoverPlatformOffer.update({where:{id:offer.id},data:{status:'DISMISSED',version:{increment:1}}});
        await this.appendOfferEvent(tx,offer.id,updated.version,'CAR_MOVER_PLATFORM_OFFER_RECLASSIFIED',{from:offer.status,to:'DISMISSED',reason:'PARSER_FALSE_POSITIVE_REJECTED'},ctx);
        await this.audit.create({actionCode:'car-mover-platform-offer-reclassified',entityType:'CarMoverPlatformOffer',entityId:offer.id,reason:'Parser revalidation rejected a previously extracted false positive.',beforeSnapshot:offer,afterSnapshot:updated,productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:offer.id},ctx,tx);
      });
      reclassified++;
    }
    const messages=await this.prisma.communicationMessage.findMany({where:{companyId:ctx.companyId,direction:'inbound',channel:{in:['email','whatsapp']}},orderBy:{occurredAt:'desc'},take:200});
    let created=0,updated=0,duplicates=0,gmailProcessed=0,gmailRelevant=0,gmailCreated=0,gmailDuplicates=0,gmailParsingErrors=0;
    for(const message of messages){
      if(message.provider==='gmail')gmailProcessed++;
      let parsed:ReturnType<typeof parsePlatformOffer>;
      try{parsed=parsePlatformOffer(`${message.subject??''}\n${message.bodyText}`,message.provider,message.fromAddress);}catch{if(message.provider==='gmail')gmailParsingErrors++;continue;}
      if(!parsed.isOffer)continue;
      if(message.provider==='gmail')gmailRelevant++;
      const rawMessageSha256=createHash('sha256').update(`${message.subject??''}\n${message.bodyText}`).digest('hex');
      const correlatedOffer=await this.prisma.carMoverPlatformOffer.findFirst({where:{companyId:ctx.companyId,status:{in:['NEW','REVIEWED']},OR:[...(parsed.externalReference?[{platformName:parsed.platformName,externalReference:parsed.externalReference}]:[]),{rawMessageSha256}]},orderBy:{updatedAt:'desc'}});
      if(correlatedOffer){
        const correlatedSource=await this.prisma.communicationMessage.findFirst({where:{id:correlatedOffer.sourceMessageId,companyId:ctx.companyId}});
        const correlation=classifyOfferCorrelation(correlatedOffer.rawMessageSha256,correlatedSource?.occurredAt,message.occurredAt,rawMessageSha256);
        if(correlation!=='UPDATE'){duplicates++;if(message.provider==='gmail')gmailDuplicates++;continue;}
        await this.prisma.$transaction(async tx=>{
          const next=await tx.carMoverPlatformOffer.update({where:{id:correlatedOffer.id},data:{sourceMessageId:message.id,channel:message.channel,pickupLabel:parsed.pickupLabel,destinationLabel:parsed.destinationLabel,pickupAt:parsed.pickupAt,vehicleDescription:parsed.vehicleDescription,offeredAmount:parsed.offeredAmount?new Prisma.Decimal(parsed.offeredAmount):null,currencyCode:parsed.currencyCode??null,estimatedKm:parsed.estimatedKm??null,score:parsed.score,extractionConfidence:parsed.confidence,analysis:{...parsed.analysis,correlatedUpdate:true,previousSourceMessageId:correlatedOffer.sourceMessageId} as Prisma.InputJsonValue,rawMessageSha256,version:{increment:1}}});
          await this.appendOfferEvent(tx,next.id,next.version,'CAR_MOVER_PLATFORM_OFFER_UPDATED',{sourceMessageId:message.id,previousSourceMessageId:correlatedOffer.sourceMessageId,platformName:next.platformName,externalReference:next.externalReference,changedInput:true},ctx);
          await this.audit.create({actionCode:'car-mover-platform-offer-updated',entityType:'CarMoverPlatformOffer',entityId:next.id,reason:'A newer source message changed an already correlated offer.',beforeSnapshot:correlatedOffer,afterSnapshot:next,productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:next.id},ctx,tx);
        });
        updated++;
        continue;
      }
      const existing=await this.prisma.carMoverPlatformOffer.findUnique({where:{companyId_sourceMessageId:{companyId:ctx.companyId,sourceMessageId:message.id}}});
      if(existing){duplicates++;if(message.provider==='gmail')gmailDuplicates++;continue;}
      await this.prisma.$transaction(async tx=>{
        const offer=await tx.carMoverPlatformOffer.create({data:{companyId:ctx.companyId,sourceMessageId:message.id,channel:message.channel,platformName:parsed.platformName,externalReference:parsed.externalReference,pickupLabel:parsed.pickupLabel,destinationLabel:parsed.destinationLabel,pickupAt:parsed.pickupAt,vehicleDescription:parsed.vehicleDescription,offeredAmount:parsed.offeredAmount?new Prisma.Decimal(parsed.offeredAmount):undefined,currencyCode:parsed.currencyCode,estimatedKm:parsed.estimatedKm,score:parsed.score,extractionConfidence:parsed.confidence,analysis:parsed.analysis as Prisma.InputJsonValue,rawMessageSha256}});
        const event=await this.appendOfferEvent(tx,offer.id,0,'CAR_MOVER_PLATFORM_OFFER_EXTRACTED',{sourceMessageId:message.id,channel:message.channel,platformName:offer.platformName,score:offer.score,confidence:offer.extractionConfidence},ctx);
        await this.audit.create({actionCode:'car-mover-platform-offer-extracted',entityType:'CarMoverPlatformOffer',entityId:offer.id,reason:'Inbound platform alert extracted for human review.',afterSnapshot:{...offer,rawMessageSha256:offer.rawMessageSha256},productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:offer.id},ctx,tx);
        void event;
      });
      created++;
      if(message.provider==='gmail')gmailCreated++;
    }
    if(this.pilot){const totalGmail=await this.prisma.communicationMessage.count({where:{companyId:ctx.companyId,direction:'inbound',channel:'email',provider:'gmail'}});await this.pilot.recordGmailAnalysis(ctx,{processed:gmailProcessed,relevant:gmailRelevant,created:gmailCreated,duplicates:gmailDuplicates,parsingErrors:gmailParsingErrors,backlog:Math.max(0,totalGmail-gmailProcessed)});}
    return {scanned:messages.length,created,updated,duplicates,reclassified,automaticAcceptance:false};
  }

  async listOffers(ctx:RequestContext){this.authorize(ctx);return this.prisma.carMoverPlatformOffer.findMany({where:{companyId:ctx.companyId},orderBy:[{status:'asc'},{score:'desc'},{createdAt:'desc'}]});}

  async reviewOffer(id:string,dto:ReviewCarMoverOfferDto,ctx:RequestContext){
    this.authorize(ctx);
    return this.prisma.$transaction(async tx=>{
      const current=await tx.carMoverPlatformOffer.findFirst({where:{id,companyId:ctx.companyId}});
      if(!current)throw new NotFoundException('Car Mover platform offer not found.');
      if(dto.linkedJobId){const job=await tx.carMoverJob.findFirst({where:{id:dto.linkedJobId,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});if(!job)throw new BadRequestException('Linked Car Mover job not found.');}
      const offer=await tx.carMoverPlatformOffer.update({where:{id},data:{status:dto.status,linkedJobId:dto.linkedJobId,version:{increment:1}}});
      const event=await this.appendOfferEvent(tx,id,offer.version,'CAR_MOVER_PLATFORM_OFFER_REVIEWED',{from:current.status,to:offer.status,linkedJobId:offer.linkedJobId},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-platform-offer-reviewed',entityType:'CarMoverPlatformOffer',entityId:id,reason:'Human review of extracted platform alert.',beforeSnapshot:current,afterSnapshot:offer,productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:id},ctx,tx);
      return {offer,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  async transition(id:string,dto:TransitionCarMoverJobDto,ctx:RequestContext) {
    this.authorize(ctx);
    return this.prisma.$transaction(async tx=>{
      const current=await tx.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});
      if(!current)throw new NotFoundException('Car Mover job not found.');
      if(!canTransitionCarMoverJob(current.currentState as CarMoverState,dto.toState))throw new BadRequestException('Car Mover lifecycle transition denied.');
      if(dto.toState==='ASSIGNED'&&!dto.assignedDriverUserId)throw new BadRequestException('Assigned driver is required.');
      if(dto.toState==='IN_PROGRESS')await this.requireProtocol(tx,id,ctx.companyId,'CAR_MOVER_TAKEOVER_RECORDED');
      if(dto.toState==='COMPLETED')await this.requireProtocol(tx,id,ctx.companyId,'CAR_MOVER_HANDOVER_RECORDED');
      const job=await tx.carMoverJob.update({where:{id},data:{currentState:dto.toState,lifecycleVersion:{increment:1},assignedDriverUserId:dto.assignedDriverUserId??current.assignedDriverUserId}});
      const event=await this.appendEvent(tx,id,job.lifecycleVersion,'CAR_MOVER_JOB_STATE_CHANGED',{from:current.currentState,to:job.currentState,reason:dto.reason??null,assignedDriverUserId:job.assignedDriverUserId},ctx);
      const audit=await this.audit.create({actionCode:'car-mover-job-state-changed',entityType:CAR_MOVER_SCOPE.subjectType,entityId:id,reason:dto.reason??`${current.currentState} -> ${job.currentState}`,beforeSnapshot:current,afterSnapshot:job,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},ctx,tx);
      return {jobId:id,from:current.currentState,to:job.currentState,lifecycleVersion:job.lifecycleVersion,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  async recordProtocol(id:string,dto:RecordCarMoverProtocolDto,ctx:RequestContext) {
    this.authorize(ctx);
    return this.prisma.$transaction(async tx=>{
      const current=await tx.carMoverJob.findFirst({where:{id,companyId:ctx.companyId,productId:CAR_MOVER_SCOPE.productId}});
      if(!current)throw new NotFoundException('Car Mover job not found.');
      const allowed=dto.protocolType==='TAKEOVER'?['ACCEPTED','IN_PROGRESS']:['ARRIVED','HANDOVER_PENDING'];
      if(!allowed.includes(current.currentState))throw new BadRequestException('Protocol is not allowed in the current state.');
      const job=await tx.carMoverJob.update({where:{id},data:{lifecycleVersion:{increment:1}}});
      const payload={protocolVersion:'car-mover-protocol.v1',...dto,currentState:current.currentState,photoCount:dto.photoDigests.length};
      const event=await this.appendEvent(tx,id,job.lifecycleVersion,`CAR_MOVER_${dto.protocolType}_RECORDED`,payload,ctx);
      const audit=await this.audit.create({actionCode:`car-mover-${dto.protocolType.toLowerCase()}-recorded`,entityType:CAR_MOVER_SCOPE.subjectType,entityId:id,reason:'Controlled Car Mover protocol confirmation.',afterSnapshot:payload,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:id},ctx,tx);
      return {jobId:id,protocolType:dto.protocolType,lifecycleVersion:job.lifecycleVersion,eventId:event.eventId,auditEventId:audit.id};
    });
  }

  private authorize(ctx:RequestContext){if(!ctx.roles.some(role=>(CAR_MOVER_SCOPE.requiredRoles as readonly string[]).includes(role)))throw new ForbiddenException('Car Mover entitlement required.');}

  private financialAnalysis(entries:Array<{entryType:string;amount:Prisma.Decimal;currencyCode:string}>){
    const currencies=[...new Set(entries.map(item=>item.currencyCode))];
    const sum=(types:string[])=>entries.filter(item=>types.includes(item.entryType)).reduce((total,item)=>total.plus(item.amount),new Prisma.Decimal(0));
    const revenue=sum(['REVENUE']);const cost=sum(['COST']);const payments=sum(['PAYMENT']);
    return {revenue:revenue.toFixed(2),cost:cost.toFixed(2),payments:payments.toFixed(2),margin:revenue.minus(cost).toFixed(2),currencyCode:currencies.length===1?currencies[0]:null,entryCount:entries.length};
  }

  private async requireProtocol(tx:Prisma.TransactionClient,jobId:string,companyId:string,eventType:string){
    const protocol=await tx.operationalEvent.findFirst({where:{companyId,productId:CAR_MOVER_SCOPE.productId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId,eventType}});
    if(!protocol)throw new BadRequestException(eventType==='CAR_MOVER_TAKEOVER_RECORDED'?'Takeover protocol is required before starting the job.':'Handover protocol is required before completing the job.');
  }

  private async appendEvent(tx:Prisma.TransactionClient,jobId:string,version:number,eventType:string,payload:Record<string,unknown>,ctx:RequestContext){
    const stream=version===0
      ? await tx.operationalEventStream.create({data:{companyId:ctx.companyId,streamId:jobId,aggregateType:CAR_MOVER_SCOPE.subjectType,currentVersion:0,projection:{state:String(payload.state??'DRAFT'),version:0},productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId}})
      : await tx.operationalEventStream.update({where:{companyId_streamId:{companyId:ctx.companyId,streamId:jobId}},data:{currentVersion:version,projection:{state:String(payload.to??payload.currentState??payload.state),version}}});
    const eventId=randomUUID(),operationId=randomUUID(),now=new Date();
    const envelope={schemaVersion:'operational-event.v1',eventId,eventType,eventVersion:1,occurredAt:now.toISOString(),recordedAt:now.toISOString(),aggregateType:CAR_MOVER_SCOPE.subjectType,aggregateId:jobId,aggregateVersion:version,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId,actor:{type:'user',id:ctx.userId},operationId,correlationId:ctx.correlationId,payload};
    return tx.operationalEvent.create({data:{companyId:ctx.companyId,streamRecordId:stream.id,eventId,idempotencyKey:operationId,schemaVersion:'operational-event.v1',eventType,eventVersion:1,aggregateVersion:version,deviceId:ctx.userId,deviceSequence:version+1,operationId,correlationId:ctx.correlationId,occurredAt:now,recordedAt:now,payload:payload as Prisma.InputJsonValue,envelope:envelope as Prisma.InputJsonValue,productId:CAR_MOVER_SCOPE.productId,moduleId:CAR_MOVER_SCOPE.moduleId,subjectType:CAR_MOVER_SCOPE.subjectType,subjectId:jobId}});
  }

  private async appendOfferEvent(tx:Prisma.TransactionClient,offerId:string,version:number,eventType:string,payload:Record<string,unknown>,ctx:RequestContext){
    const stream=version===0
      ?await tx.operationalEventStream.create({data:{companyId:ctx.companyId,streamId:offerId,aggregateType:'CarMoverPlatformOffer',currentVersion:0,projection:{status:'NEW',score:payload.score??0,version:0},productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:offerId}})
      :await tx.operationalEventStream.update({where:{companyId_streamId:{companyId:ctx.companyId,streamId:offerId}},data:{currentVersion:version,projection:{status:String(payload.to??'REVIEWED'),version}}});
    const eventId=randomUUID(),operationId=randomUUID(),now=new Date();
    const envelope={schemaVersion:'operational-event.v1',eventId,eventType,eventVersion:1,occurredAt:now.toISOString(),recordedAt:now.toISOString(),aggregateType:'CarMoverPlatformOffer',aggregateId:offerId,aggregateVersion:version,productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:offerId,actor:{type:'user',id:ctx.userId},operationId,correlationId:ctx.correlationId,payload};
    return tx.operationalEvent.create({data:{companyId:ctx.companyId,streamRecordId:stream.id,eventId,idempotencyKey:operationId,schemaVersion:'operational-event.v1',eventType,eventVersion:1,aggregateVersion:version,deviceId:ctx.userId,deviceSequence:version+1,operationId,correlationId:ctx.correlationId,occurredAt:now,recordedAt:now,payload:payload as Prisma.InputJsonValue,envelope:envelope as Prisma.InputJsonValue,productId:CAR_MOVER_SCOPE.productId,moduleId:'platform-alerts',subjectType:'CarMoverPlatformOffer',subjectId:offerId}});
  }
}

export function parsePlatformOffer(text:string,provider:string,from:string){
  const compact=text.replace(/\r/g,'').trim();
  const platformName=/onlogist/i.test(compact)?'Onlogist':/mocca/i.test(compact)?'MOCCA':provider==='gmail'?'Gmail alert':provider.includes('whatsapp')?'WhatsApp alert':from;
  const route=compact.match(/(?:from|de la|von)\s+([^\n,;]+?)\s+(?:to|la|nach)\s+([^\n,;]+)/i)??compact.match(/([^\n,;]{2,80})\s*(?:→|->)\s*([^\n,;]{2,80})/);
  const amount=compact.match(/(?:€|eur\s*)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur)/i);
  const km=compact.match(/(\d{1,5})\s*km\b/i);
  const reference=compact.match(/(?:order|auftrag|comand[aă]|ref(?:erence)?)\b[\s:#-]+([a-z0-9-]{3,40})/i);
  const vehicle=compact.match(/(?:vehicle|fahrzeug|vehicul)[\s:=-]+([^\n,;]{2,120})/i);
  const signals=[Boolean(route),Boolean(amount),Boolean(reference),Boolean(vehicle),/pickup|abholung|preluare|delivery|livrare|transport|curs[ăa]/i.test(compact)];
  const confidence=Math.min(100,signals.filter(Boolean).length*20);
  const score=Math.min(100,(route?35:0)+(amount?25:0)+(km?15:0)+(vehicle?15:0)+(reference?10:0));
  const currencyCode=amount?'EUR':undefined;
  const offeredAmount=amount?String(amount[1]??amount[2]).replace(',','.'):undefined;
  const isOffer=Boolean(route)&&(Boolean(amount)||Boolean(vehicle)||Boolean(reference));
  return {isOffer,platformName,externalReference:reference?.[1],pickupLabel:route?.[1]?.trim(),destinationLabel:route?.[2]?.trim(),pickupAt:undefined,vehicleDescription:vehicle?.[1]?.trim(),offeredAmount,currencyCode,estimatedKm:km?Number(km[1]):undefined,score,confidence,analysis:{contractVersion:'car-mover-offer-analysis.v1',signals:{route:Boolean(route),amount:Boolean(amount),distance:Boolean(km),vehicle:Boolean(vehicle),reference:Boolean(reference)},reason:score>=70?'Date suficiente pentru evaluare umană.':'Ofertă incompletă; necesită verificare.',automaticDecision:false,sourceProvider:provider,sourceAddressHash:createHash('sha256').update(from.toLowerCase()).digest('hex')}};
}

export function classifyOfferCorrelation(existingHash:string,existingTimestamp:Date|undefined,incomingTimestamp:Date,incomingHash:string):'DUPLICATE'|'OUTDATED_DUPLICATE'|'UPDATE'{
  if(existingHash===incomingHash)return'DUPLICATE';
  if(existingTimestamp&&incomingTimestamp<=existingTimestamp)return'OUTDATED_DUPLICATE';
  return'UPDATE';
}
