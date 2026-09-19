import { Body, Controller, Delete, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { requestIdFromHeader } from '../common/request-ids';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { CreateSharedArchiveRecordDto, QuerySharedArchiveDto, RevokeSharedArchiveRecordDto } from './shared-archive.dto';
import { SharedArchiveService } from './shared-archive.service';

@Controller('shared-archive')
@UseGuards(JwtAuthGuard)
export class SharedArchiveController {
  constructor(private readonly archive: SharedArchiveService) {}

  @Post('records')
  create(@CurrentUser() user: RequestContext, @Body() dto: CreateSharedArchiveRecordDto, @Headers('x-request-id') requestId?: string) {
    return this.archive.create(withRequest(user, requestId), dto).then(responseEnvelope);
  }

  @Post('query')
  query(@CurrentUser() user: RequestContext, @Body() dto: QuerySharedArchiveDto, @Headers('x-request-id') requestId?: string) {
    return this.archive.query(withRequest(user, requestId), dto).then(responseEnvelope);
  }

  @Post('records/:id/revoke')
  revoke(@CurrentUser() user: RequestContext, @Param('id') id: string, @Body() dto: RevokeSharedArchiveRecordDto, @Headers('x-request-id') requestId?: string) {
    return this.archive.revoke(withRequest(user, requestId), id, dto.reason).then(responseEnvelope);
  }

  @Delete('records/:id')
  delete(@CurrentUser() user: RequestContext, @Param('id') id: string, @Headers('x-request-id') requestId?: string) {
    return this.archive.delete(withRequest(user, requestId), id).then(responseEnvelope);
  }
}

function withRequest(user: RequestContext, requestId?: string): RequestContext {
  return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
}
