import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PremiumAssistantRequestDto } from './dto/premium-assistant-request.dto';
import { PremiumAssistantService } from './premium-assistant.service';

@Controller('premium-assistant')
@UseGuards(JwtAuthGuard)
export class PremiumAssistantController {
  constructor(private readonly assistant: PremiumAssistantService) {}
  @Post('respond') respond(@CurrentUser() user: RequestContext, @Body() request: PremiumAssistantRequestDto) {
    return this.assistant.respond(user, request).then(responseEnvelope);
  }
}

