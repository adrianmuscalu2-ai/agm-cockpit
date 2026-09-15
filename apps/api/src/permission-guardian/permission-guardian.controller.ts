import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { PermissionGuardianRequestDto } from './permission-guardian.dto';
import { PermissionGuardianService } from './permission-guardian.service';

@Controller('security/permission-guardian')
@UseGuards(JwtAuthGuard)
export class PermissionGuardianController {
  constructor(private readonly guardian: PermissionGuardianService) {}
  @Post('evaluate') evaluate(@CurrentUser() user: RequestContext, @Body() request: PermissionGuardianRequestDto, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return this.guardian.evaluate(ctx, request).then((result) => responseEnvelope(result, ctx.requestId));
  }
  @Get('status') status(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = this.context(user, requestId);
    return this.guardian.status(ctx).then((result) => responseEnvelope(result, ctx.requestId));
  }

  private context(user: RequestContext, requestId?: string): RequestContext {
    return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
  }
}
