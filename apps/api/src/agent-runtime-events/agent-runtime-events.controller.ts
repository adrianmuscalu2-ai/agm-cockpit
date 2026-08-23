import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { AgentRuntimeEventsService } from './agent-runtime-events.service';
import { AppendAgentRuntimeEventDto } from './dto/append-agent-runtime-event.dto';
import { ExecuteAgentInspectorDto } from './dto/execute-agent-inspector.dto';

@Controller('agent-runtime-events')
@UseGuards(JwtAuthGuard)
export class AgentRuntimeEventsController {
  constructor(private readonly service: AgentRuntimeEventsService) {}

  @Post()
  async append(@Body() dto: AppendAgentRuntimeEventDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.service.append(dto, ctx), ctx.requestId);
  }

  @Get()
  async read(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string, @Query('mandateId') mandateId?: string, @Query('after') after?: string, @Query('limit') limit?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.service.read(ctx, { mandateId: mandateId?.trim() || undefined, after, limit: limit ? Number(limit) : undefined }), ctx.requestId);
  }

  @Post('execute-inspector')
  async executeInspector(@Body() dto: ExecuteAgentInspectorDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.service.executeInspector(dto.expectedOutcome, ctx), ctx.requestId);
  }
}
