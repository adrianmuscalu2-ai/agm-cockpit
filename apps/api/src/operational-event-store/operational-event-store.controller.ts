import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { SyncOperationalEventsDto } from './dto/sync-events.dto';
import { OperationalEventStoreService } from './operational-event-store.service';

@Controller('operational-events')
@UseGuards(JwtAuthGuard)
export class OperationalEventStoreController {
  constructor(private readonly store: OperationalEventStoreService) {}
  @Post('sync') async sync(@Body() dto: SyncOperationalEventsDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.store.sync(dto.events, ctx), ctx.requestId);
  }
  @Get(':streamId') async read(@Param('streamId') streamId: string, @Query('afterVersion') after: string | undefined, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    const version = after === undefined ? -1 : Number(after);
    return responseEnvelope(await this.store.read(streamId, Number.isInteger(version) ? version : -1, ctx), ctx.requestId);
  }
}
