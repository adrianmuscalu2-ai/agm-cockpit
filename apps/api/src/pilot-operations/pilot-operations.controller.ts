import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { PilotOperationsService } from './pilot-operations.service';

@Controller('provider-pilot') @UseGuards(JwtAuthGuard)
export class PilotOperationsController {
  constructor(private readonly pilot:PilotOperationsService){}
  @Get('providers') async providers(@CurrentUser() user:RequestContext){return responseEnvelope(await this.pilot.list(user));}
  @Post('providers/:providerId/state') async state(@Param('providerId') providerId:string,@Body() body:{state:'ACTIVE'|'SUSPENDED'|'READY';reason?:string},@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx={...user,requestId:requestIdFromHeader(requestId),correlationId:randomUUID()};return responseEnvelope(await this.pilot.setState(providerId,body.state,body.reason,ctx),ctx.requestId);}
  @Post('providers/:providerId/billing') async billing(@Param('providerId') providerId:string,@Body() body:{actualCostMicros:number;currencyCode:string;periodStart:string;periodEnd:string},@CurrentUser() user:RequestContext,@Headers('x-request-id') requestId?:string){const ctx={...user,requestId:requestIdFromHeader(requestId),correlationId:randomUUID()};return responseEnvelope(await this.pilot.recordBilling(providerId,body.actualCostMicros,body.currencyCode,body.periodStart,body.periodEnd,ctx),ctx.requestId);}
  @Get('report') async report(@Query('from') from:string|undefined,@Query('to') to:string|undefined,@CurrentUser() user:RequestContext){return responseEnvelope(await this.pilot.report(user,from,to));}
}
