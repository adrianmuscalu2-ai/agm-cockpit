import { Controller, Get, Headers, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { responseEnvelope } from '../common/response';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import { TurnFunctionalOverviewService } from './turn-functional-overview.service';
import { TurnOperationalTruthService } from './turn-operational-truth.service';

@Controller('operations/turn')
export class TurnOperationalTruthController {
  constructor(
    private readonly truth: TurnOperationalTruthService,
    private readonly functionalOverview: TurnFunctionalOverviewService,
    private readonly turnAdmin: TurnAdminService,
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
}
