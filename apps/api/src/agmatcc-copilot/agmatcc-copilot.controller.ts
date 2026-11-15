import { Body, Controller, Headers, Post, UseGuards, Req, Get, ForbiddenException } from '@nestjs/common';
import { LunaProductionAccessGuard, VERIFIED_LUNA_COMMANDER, type CommanderBinding } from './luna-production-access.guard';
import { randomUUID, createHash } from 'node:crypto';
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

  // Read the CURRENT caller's binding only, after canonical TURN authentication.
  // No session enumeration, token disclosure, role change or activation occurs here.
  @Get('session')
  @RequireOperationalEventRight('read')
  session(@CurrentUser() user:RequestContext,@Headers('authorization') authorization:string) {
    if(!user.roles.includes('TURN_ADMIN_SESSION'))throw new ForbiddenException('LUNA_COMMANDER_SESSION_REQUIRED');
    const payload=JSON.parse(Buffer.from(authorization.slice(7).split('.')[1],'base64url').toString('utf8'));
    return responseEnvelope({familySha256:createHash('sha256').update(payload.familyId).digest('hex'),activationGranted:false},user.requestId);
  }

  @Post('respond')
  @UseGuards(LunaProductionAccessGuard)
  @RequireOperationalEventRight('read')
  async respond(@CurrentUser() user: RequestContext, @Body() body: AgmatccCopilotRequestDto, @Req() request: { [VERIFIED_LUNA_COMMANDER]?: CommanderBinding }, @Headers('x-request-id') requestId?: string) {
    const context = { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
    return responseEnvelope(await this.copilot.respond(context, body.question, body.testMandateId, request[VERIFIED_LUNA_COMMANDER]), context.requestId);
  }
}
