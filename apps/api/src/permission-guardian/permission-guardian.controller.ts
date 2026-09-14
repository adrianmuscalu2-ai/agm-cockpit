import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { responseEnvelope } from '../common/response';
import { PermissionGuardianRequestDto } from './permission-guardian.dto';
import { PermissionGuardianService } from './permission-guardian.service';

@Controller('security/permission-guardian')
@UseGuards(JwtAuthGuard)
export class PermissionGuardianController {
  constructor(private readonly guardian: PermissionGuardianService) {}
  @Post('evaluate') evaluate(@CurrentUser() ctx: RequestContext, @Body() request: PermissionGuardianRequestDto) {
    return this.guardian.evaluate(ctx, request).then(responseEnvelope);
  }
  @Get('status') status(@CurrentUser() ctx: RequestContext) {
    return this.guardian.status(ctx).then(responseEnvelope);
  }
}
