import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { CommunicationService } from './communication.service';
import { SendCommunicationDto } from './dto/communication.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard)
export class CommunicationController {
  constructor(private readonly service: CommunicationService) {}

  @Post('messages')
  async send(@Body() dto: SendCommunicationDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.service.send(dto.message, ctx), ctx.requestId);
  }

  @Post('messages/:messageId/retry')
  async retry(@Param('messageId') messageId: string, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.service.retry(messageId, ctx), ctx.requestId);
  }

  @Get('conversations')
  async list(@Query('channel') channel: string | undefined, @CurrentUser() user: RequestContext) {
    return responseEnvelope(await this.service.list(channel, user));
  }
}
