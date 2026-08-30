import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { LiveAdapterService } from './live-adapter.service';
import { GeocodeLiveDto, MobilityInputDto, PlatformFeedDto, RouteLiveDto, TollLiveDto, TrafficLiveDto, TransitLiveDto } from './live-adapter.dto';

@Controller('live-adapters') @UseGuards(JwtAuthGuard)
export class LiveAdapterController {
  constructor(private readonly adapters:LiveAdapterService){}
  @Post('geocoding') geocode(@Body() dto:GeocodeLiveDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.resolve('GEOCODING',{query:dto.query,countrySet:dto.countrySet},ctx,dto.forceRefresh),ctx);}
  @Post('route') route(@Body() dto:RouteLiveDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.resolve('ROUTE',{origin:dto.origin,destination:dto.destination,departureTime:dto.departureTime,vehicle:dto.vehicle as never},ctx,dto.forceRefresh),ctx);}
  @Post('traffic') traffic(@Body() dto:TrafficLiveDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.resolve('TRAFFIC',{origin:dto.origin,destination:dto.destination},ctx,dto.forceRefresh),ctx);}
  @Post('toll') toll(@Body() dto:TollLiveDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.resolve('TOLL',{origin:dto.origin,destination:dto.destination,routeReference:dto.routeReference,tollRequired:dto.tollRequired,tollReason:dto.tollReason,departureTime:dto.departureTime,vehicle:dto.vehicle as never,authoritySources:dto.authoritySources,authorityScopeConfirmed:dto.authorityScopeConfirmed},ctx,dto.forceRefresh),ctx);}
  @Post('transit') transit(@Body() dto:TransitLiveDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.resolve('TRANSIT',{origin:dto.origin,destination:dto.destination,departureTime:dto.departureTime},ctx,dto.forceRefresh),ctx);}
  @Post('platform-feed') platform(@Body() dto:PlatformFeedDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.ingestPlatformFeed(dto,ctx),ctx);}
  @Post('opportunity-input') input(@Body() dto:MobilityInputDto,@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.opportunityInput(dto,ctx),ctx);}
  @Get('telemetry') telemetry(@CurrentUser() user:RequestContext,@Headers('x-request-id') id?:string){const ctx=this.ctx(user,id);return this.wrap(this.adapters.telemetrySnapshot(ctx),ctx);}
  private async wrap(value:Promise<unknown>,ctx:RequestContext){return responseEnvelope(await value,ctx.requestId);}
  private ctx(user:RequestContext,id?:string):RequestContext{return{...user,requestId:requestIdFromHeader(id),correlationId:randomUUID()};}
}
