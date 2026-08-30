import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { CarMoverRoutingTelemetryService } from './car-mover-routing-telemetry.service';
import { RecordRoutingObservationDto } from './dto/record-routing-observation.dto';

@Controller('car-mover/routing')
@UseGuards(JwtAuthGuard)
export class CarMoverRoutingController {
  constructor(private readonly telemetry:CarMoverRoutingTelemetryService){}
  @Get('field-protocol')async protocol(@CurrentUser()user:RequestContext,@Headers('x-request-id')requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.telemetry.protocol(ctx),ctx.requestId);}
  @Post('observations')async observe(@Body()dto:RecordRoutingObservationDto,@CurrentUser()user:RequestContext,@Headers('x-request-id')requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.telemetry.record(dto,ctx),ctx.requestId);}
  @Get('telemetry')async report(@CurrentUser()user:RequestContext,@Query('from')from?:string,@Query('to')to?:string,@Headers('x-request-id')requestId?:string){const ctx=this.context(user,requestId);return responseEnvelope(await this.telemetry.report(ctx,from,to),ctx.requestId);}
  private context(user:RequestContext,requestId?:string):RequestContext{return{...user,requestId:requestIdFromHeader(requestId),correlationId:randomUUID()};}
}
