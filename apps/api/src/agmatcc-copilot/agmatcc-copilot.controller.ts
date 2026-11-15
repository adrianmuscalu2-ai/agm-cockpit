import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { requestIdFromHeader } from '../common/request-ids';
import { OperationalEventAccessGuard, RequireOperationalEventRight } from '../operational-event-store/operational-event-access';
import { AgmatccCopilotRequestDto } from './dto/agmatcc-copilot-request.dto';
import { AgmatccCopilotService } from './agmatcc-copilot.service';

@Controller('agmatcc-copilot')
@UseGuards(OperationalEventAccessGuard)
export class AgmatccCopilotController {
  constructor(private readonly copilot: AgmatccCopilotService) {}

  @Post('respond')
  @RequireOperationalEventRight('read')
  async respond(@CurrentUser() user: RequestContext, @Body() body: AgmatccCopilotRequestDto, @Headers('x-request-id') requestId?: string) {
    const context = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.copilot.respond(context, body.question, body.testMandateId), context.requestId);
  }
}
