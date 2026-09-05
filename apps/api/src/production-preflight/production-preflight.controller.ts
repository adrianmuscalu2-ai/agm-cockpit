import { Controller, Get, Headers, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { responseEnvelope } from '../common/response';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import { ProductionPreflightService } from './production-preflight.service';

@Controller('operations/production-preflight')
@Throttle({ default: { limit: 12, ttl: 60_000, blockDuration: 60_000 } })
export class ProductionPreflightController {
  constructor(private readonly service: ProductionPreflightService, private readonly turnAdmin: TurnAdminService) {}

  @Get()
  async snapshot(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.setHeader('Vary', 'Authorization');
    return responseEnvelope(await this.service.snapshot());
  }
}
