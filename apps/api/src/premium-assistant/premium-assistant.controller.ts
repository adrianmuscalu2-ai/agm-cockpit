import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PremiumAssistantRequestDto } from './dto/premium-assistant-request.dto';
import { PremiumAssistantService } from './premium-assistant.service';
import { SourceInvalidationDto } from './dto/source-invalidation.dto';

@Controller('premium-assistant')
@UseGuards(JwtAuthGuard)
export class PremiumAssistantController {
  constructor(private readonly assistant: PremiumAssistantService) {}
  @Post('respond') respond(@CurrentUser() user: RequestContext, @Body() request: PremiumAssistantRequestDto) {
    return this.assistant.respond(user, request).then(responseEnvelope);
  }
  @Get('sources/stats') sourceStats(@CurrentUser() user: RequestContext) {
    return responseEnvelope(this.assistant.sourceStats(user));
  }
  @Get('sources/:traceId') sourceTrace(@CurrentUser() user: RequestContext, @Param('traceId') traceId: string) {
    return responseEnvelope(this.assistant.sourceTrace(user, traceId));
  }
  @Post('sources/:sourceId/invalidate') invalidateSource(@CurrentUser() user: RequestContext, @Param('sourceId') sourceId: string, @Body() request: SourceInvalidationDto) {
    return responseEnvelope(this.assistant.invalidateSource(user, sourceId, request.reason));
  }
  @Post('sources/:sourceId/refresh') refreshSource(@CurrentUser() user: RequestContext, @Param('sourceId') sourceId: string) {
    return responseEnvelope(this.assistant.refreshSource(user, sourceId));
  }
}

