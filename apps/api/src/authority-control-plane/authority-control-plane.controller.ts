import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { requestIdFromHeader } from '../common/request-ids';
import { responseEnvelope } from '../common/response';
import { AuthorityControlPlaneService } from './authority-control-plane.service';
import { AssessAuthorityGateDto, CreateDecisionDto, CreateMandateDto, ExecuteRecoveryDto, HandoffLeaseDto, IssueLeaseDto, RevokeLeaseDto, ValidateWriteDto } from './dto';
import { TurnAdminService } from '../turn-admin/turn-admin.service';

@Controller('authority-control-plane')
@UseGuards(JwtAuthGuard)
export class AuthorityControlPlaneController {
  constructor(private readonly service: AuthorityControlPlaneService, private readonly turnAdmin: TurnAdminService) {}

  @Get('dashboard')
  async dashboard(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string, @Headers('x-agm-turn-authorization') turnAuthorization?: string) {
    await this.turnAdmin.requireOperationalAccess(turnAuthorization);
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.dashboard(ctx), ctx.requestId);
  }

  @Get('network-registry')
  async registry(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string, @Headers('x-agm-turn-authorization') turnAuthorization?: string) {
    await this.turnAdmin.requireOperationalAccess(turnAuthorization);
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.registry(ctx), ctx.requestId);
  }

  @Post('inspections/run')
  async inspect(@CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.inspectOperationalCapabilities(ctx), ctx.requestId);
  }

  @Post('mandates')
  async mandate(@Body() dto: CreateMandateDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.createMandate(dto, ctx), ctx.requestId);
  }

  @Post('decisions')
  async decision(@Body() dto: CreateDecisionDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.createDecision(dto, ctx), ctx.requestId);
  }

  @Post('leases')
  async lease(@Body() dto: IssueLeaseDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.issueLease(dto, ctx), ctx.requestId);
  }

  @Post('leases/handoff')
  async handoff(@Body() dto: HandoffLeaseDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.handoff(dto, ctx), ctx.requestId);
  }

  @Post('leases/:leaseId/revoke')
  async revoke(@Param('leaseId') leaseId: string, @Body() dto: RevokeLeaseDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.revokeLease(leaseId, dto.reason, ctx), ctx.requestId);
  }

  @Post('write-boundary/validate')
  async validateWrite(@Body() dto: ValidateWriteDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.validateWrite(dto, ctx), ctx.requestId);
  }

  @Post('recovery/execute')
  async recovery(@Body() dto: ExecuteRecoveryDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.executeRecovery(dto, ctx), ctx.requestId);
  }

  @Post('gate/assess')
  async assessGate(@Body() dto: AssessAuthorityGateDto, @CurrentUser() user: RequestContext, @Headers('x-request-id') requestId?: string) {
    const ctx = context(user, requestId);
    return responseEnvelope(await this.service.assessGate(dto.baselineEvidenceRefs, ctx), ctx.requestId);
  }
}

function context(user: RequestContext, requestId?: string): RequestContext {
  return { ...user, requestId: requestIdFromHeader(requestId), correlationId: randomUUID() };
}
