import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { responseEnvelope } from '../common/response';
import { EvaluateCanonicalAuthorityDto } from './canonical-authority.dto';
import { CanonicalAuthorityService } from './canonical-authority.service';

@Controller('canonical-authority')
@UseGuards(JwtAuthGuard)
export class CanonicalAuthorityController {
  constructor(private readonly authority: CanonicalAuthorityService) {}
  @Post('evaluate') evaluate(@Body() dto: EvaluateCanonicalAuthorityDto) {
    return responseEnvelope(this.authority.evaluate(dto));
  }
}
