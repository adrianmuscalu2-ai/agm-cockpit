import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OperationalEventAccessGuard, RequireOperationalEventRight } from './operational-event-access';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { SyncOperationalEventsDto } from './dto/sync-events.dto';
import { OperationalEventStoreService } from './operational-event-store.service';
import { OperationalEventSemanticSearchService } from './operational-event-semantic-search.service';

@Controller('operational-events')
@UseGuards(OperationalEventAccessGuard)
export class OperationalEventStoreController {
  constructor(private readonly store: OperationalEventStoreService, private readonly semantic: OperationalEventSemanticSearchService) {}
  @Get('search/semantic') @RequireOperationalEventRight('read') async semanticSearch(@Query('q') q: string | undefined, @Query('limit') limit: string | undefined, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    const text = (q ?? '').trim();
    if (text.length < 2 || text.length > 200) throw new BadRequestException('q must be 2-200 characters');
    const parsed = Number(limit ?? 20);
    const bounded = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 50) : 20;
    return responseEnvelope(await this.semantic.search(text, bounded, ctx), ctx.requestId);
  }
  @Post('sync') @RequireOperationalEventRight('sync') async sync(@Body() dto: SyncOperationalEventsDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.store.sync(dto.events, ctx), ctx.requestId);
  }
  @Get(':streamId') @RequireOperationalEventRight('read') async read(@Param('streamId') streamId: string, @Query('afterVersion') after: string | undefined, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    const version = after === undefined ? -1 : Number(after);
    return responseEnvelope(await this.store.read(streamId, Number.isInteger(version) ? version : -1, ctx), ctx.requestId);
  }
}
