import { Controller, Get, Headers, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { responseEnvelope } from '../common/response';
import { TurnAdminService } from '../turn-admin/turn-admin.service';
import { SecretTelemetryService } from './secret-telemetry.service';

@Controller('security/secrets')
@Throttle({ default: { limit: 12, ttl: 60_000, blockDuration: 60_000 } })
export class SecretTelemetryController {
  constructor(private readonly telemetry: SecretTelemetryService, private readonly turnAdmin: TurnAdminService) {}

  @Get('health')
  async health(@Headers('authorization') authorization: string | undefined, @Res({ passthrough: true }) response: Response) {
    await this.turnAdmin.requireOperationalAccess(authorization);
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.setHeader('Vary', 'Authorization');
    return responseEnvelope(this.telemetry.snapshot());
  }
}
