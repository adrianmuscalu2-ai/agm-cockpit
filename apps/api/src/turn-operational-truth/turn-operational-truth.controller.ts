import { Body, Controller, Get, Headers, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { responseEnvelope } from '../common/response';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import { TurnFunctionalOverviewService } from './turn-functional-overview.service';
import { TurnOperationalTruthService } from './turn-operational-truth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestContext } from '../common/request-context';
import { RecordTurnFeatureTelemetryDto } from './turn-feature-telemetry.dto';
import { AuthorityControlPlaneService } from '../authority-control-plane/authority-control-plane.service';
import { GITHUB_ACTIONS_PROVISIONING_CONTRACT } from '../machine-auth/github-actions-oidc.contract';
import { randomUUID } from 'node:crypto';

@Controller('operations/turn')
export class TurnOperationalTruthController {
  constructor(
    private readonly truth: TurnOperationalTruthService,
    private readonly functionalOverview: TurnFunctionalOverviewService,
    private readonly turnAdmin: TurnAdminService,
    private readonly authority: AuthorityControlPlaneService,
  ) {}

  @Get('operational-truth')
  @Throttle({ default: { limit: 60, ttl: 60_000, blockDuration: 60_000 } })
  async snapshot(@Res({ passthrough: true }) response: Response) {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return responseEnvelope(await this.truth.snapshot());
  }

  @Get('functional-overview')
  @Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 60_000 } })
  async productOverview(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.setHeader('Vary', 'Authorization');
    return responseEnvelope(await this.functionalOverview.snapshot());
  }

  @Post('feature-telemetry')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000, blockDuration: 60_000 } })
  async recordFeatureTelemetry(@Body() dto: RecordTurnFeatureTelemetryDto, @CurrentUser() user: RequestContext) {
    return responseEnvelope(await this.functionalOverview.recordBasicFeature(dto, user));
  }

  @Get('operational-dashboard')
  @Throttle({ default: { limit: 20, ttl: 60_000, blockDuration: 60_000 } })
  async operationalDashboard(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.setHeader('Vary', 'Authorization');
    return responseEnvelope(await this.authority.dashboard(ownerContext()));
  }

  @Post('operational-inspections')
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  async operationalInspections(@Headers('authorization') authorization: string | undefined) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    return responseEnvelope(await this.authority.inspectOperationalCapabilities(ownerContext()));
  }
}

function ownerContext(): RequestContext {
  return { companyId: GITHUB_ACTIONS_PROVISIONING_CONTRACT.companyId, userId: '00000000-0000-0000-0000-000000000001', roles: ['PRODUCT_OWNER'], requestId: randomUUID(), correlationId: randomUUID() };
}
