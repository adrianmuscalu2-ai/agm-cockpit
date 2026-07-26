import { Body, Controller, Get, Headers, Param, Post, Put, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { CreatePreDepartureSessionDto, UpdatePreDepartureSessionDto } from './dto/pre-departure-sync.dto';
import { PreDepartureSyncService } from './pre-departure-sync.service';

@Controller('pre-departure/sessions')
@UseGuards(JwtAuthGuard)
export class PreDepartureSyncController {
  constructor(private readonly sync: PreDepartureSyncService) {}

  @Post()
  async create(@Body() dto: CreatePreDepartureSessionDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId: string | undefined) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.sync.create(dto.session, ctx), ctx.requestId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId: string | undefined) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.sync.get(id, ctx), ctx.requestId);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePreDepartureSessionDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId: string | undefined) {
    const ctx = this.context(user, requestId);
    return responseEnvelope(await this.sync.update(id, dto.session, dto.expectedServerRevision, ctx), ctx.requestId);
  }

  private context(user: RequestContext, requestId: string | undefined): RequestContext {
    return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
  }
}
