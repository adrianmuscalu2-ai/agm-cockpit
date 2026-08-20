import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { CarMoverService } from './car-mover.service';
import { CreateCarMoverJobDto } from './dto/create-car-mover-job.dto';
import { TransitionCarMoverJobDto } from './dto/transition-car-mover-job.dto';
import { RecordCarMoverProtocolDto } from './dto/record-car-mover-protocol.dto';

@Controller('car-mover/jobs')
@UseGuards(JwtAuthGuard)
export class CarMoverController {
  constructor(private readonly jobs:CarMoverService){}
  @Post() async create(@Body() dto:CreateCarMoverJobDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.jobs.create(dto,ctx),ctx.requestId);}
  @Get() async list(@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.jobs.list(ctx),ctx.requestId);}
  @Get(':id') async get(@Param('id') id:string,@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.jobs.getJobFile(id,ctx),ctx.requestId);}
  @Post(':id/transitions') async transition(@Param('id') id:string,@Body() dto:TransitionCarMoverJobDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.jobs.transition(id,dto,ctx),ctx.requestId);}
  @Post(':id/protocols') async protocol(@Param('id') id:string,@Body() dto:RecordCarMoverProtocolDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.jobs.recordProtocol(id,dto,ctx),ctx.requestId);}
  private context(user:RequestContext,requestId?:string):RequestContext{return{...user,requestId:requestIdFromHeader(requestId),correlationId:randomUUID()};}
}
