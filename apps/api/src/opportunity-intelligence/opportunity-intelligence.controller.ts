import { Body, Controller, Get, Headers, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { AnalyzeOpportunityDto, DecideOpportunityDto, IntakeOpportunityDto } from './opportunity-intelligence.dto';
import { OpportunityIntelligenceService } from './opportunity-intelligence.service';
import { OpportunityTelemetryInterceptor } from './opportunity-telemetry.interceptor';

@Controller('opportunity-intelligence')
@UseGuards(JwtAuthGuard)
@UseInterceptors(OpportunityTelemetryInterceptor)
export class OpportunityIntelligenceController {
  constructor(private readonly opportunities: OpportunityIntelligenceService) {}

  @Post('intake')
  async intake(@Body() dto: IntakeOpportunityDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.intake(dto, ctx), ctx.requestId);
  }

  @Post('intake/import-existing')
  async importExisting(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.importExistingOffers(ctx), ctx.requestId);
  }

  @Get('opportunities')
  async list(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.list(ctx), ctx.requestId);
  }

  @Post('analyze')
  async analyze(@Body() dto: AnalyzeOpportunityDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.analyze(dto, ctx), ctx.requestId);
  }

  @Get('planning')
  async planning(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.planning(ctx), ctx.requestId);
  }

  @Get('copilot')
  async copilot(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.copilot(ctx), ctx.requestId);
  }

  @Post('verdicts/:id/decide')
  async decide(@Param('id') id: string, @Body() dto: DecideOpportunityDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.decide(id, dto, ctx), ctx.requestId);
  }

  @Get('telemetry')
  async telemetry(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.opportunities.telemetrySnapshot(ctx), ctx.requestId);
  }

  private context(user: RequestContext, requestId?: string): RequestContext {
    return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
  }
}
